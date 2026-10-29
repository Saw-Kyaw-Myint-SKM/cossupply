<?php

namespace App\Services\Quotation;

use App\Enums\QuotationAction as QuotationActionEnum;
use App\Enums\QuotationRequestStatus;
use App\Enums\QuotationVersionStatus;
use App\Models\Customer;
use App\Models\Order;
use App\Models\Quotation;
use App\Models\QuotationAction;
use App\Models\QuotationRequest;
use App\Services\Notification\NotificationService;
use App\Services\Order\OrderConversionService;
use App\Services\Status\StatusTransitionService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Customer-facing quotation review and decisions (LogicFlow §8).
 *
 * Ownership is always resolved through the authenticated customer. Only the
 * current, unexpired version in SENT/VIEWED can be accepted, rejected or sent
 * back for a change; every action is written to the append-only
 * `quotation_actions` trail in the same transaction as the status change.
 */
class CustomerQuotationService
{
    public function __construct(
        private readonly StatusTransitionService $statuses,
        private readonly OrderConversionService $orders,
        private readonly NotificationService $notifications,
    ) {}

    /**
     * Find one request owned by the customer. A foreign or unknown id is
     * indistinguishable (null) so existence is never leaked.
     */
    public function findOwnedRequest(Customer $customer, int $requestId): ?QuotationRequest
    {
        return QuotationRequest::query()
            ->whereKey($requestId)
            ->where('customer_id', $customer->id)
            ->first();
    }

    /**
     * Find one quotation version whose request belongs to the customer.
     */
    public function findOwnedQuotation(Customer $customer, int $quotationId): ?Quotation
    {
        return Quotation::query()
            ->whereKey($quotationId)
            ->whereHas('quotationRequest', fn ($query) => $query->where('customer_id', $customer->id))
            ->first();
    }

    /**
     * Load a request detail and apply the first-view rule: opening the current
     * sent quotation moves the version to VIEWED, the request to
     * CUSTOMER_REVIEWING, and records one VIEWED action.
     *
     * Expired current versions are moved to EXPIRED first; repeated views are
     * idempotent (no duplicate action rows).
     */
    public function openDetail(
        Customer $customer,
        int $requestId,
        ?string $ip = null,
    ): ?QuotationRequest {
        $request = $this->findOwnedRequest($customer, $requestId);

        if ($request === null) {
            return null;
        }

        $currentId = $request->quotations()
            ->where('is_current', true)
            ->value('id');

        if ($currentId !== null) {
            DB::transaction(function () use ($currentId, $request, $ip, $customer): void {
                $version = Quotation::query()->whereKey($currentId)->lockForUpdate()->first();

                // Lock the request after the version, matching the admin send
                // path so concurrent customer/admin updates share a lock order.
                $lockedRequest = QuotationRequest::query()
                    ->whereKey($request->id)
                    ->lockForUpdate()
                    ->firstOrFail();

                if ($version === null) {
                    return;
                }

                if ($this->isExpired($version)) {
                    $this->expire($version, $lockedRequest);

                    return;
                }

                if (! $version->is_current || $version->status !== QuotationVersionStatus::SENT) {
                    return;
                }

                $this->statuses->assertTransition(
                    StatusTransitionService::DOMAIN_QUOTATION_VERSION,
                    QuotationVersionStatus::SENT->value,
                    QuotationVersionStatus::VIEWED->value,
                );

                $version->update([
                    'status' => QuotationVersionStatus::VIEWED->value,
                    'viewed_at' => now(),
                ]);

                $this->moveRequestTo($lockedRequest, QuotationRequestStatus::CUSTOMER_REVIEWING);

                $this->recordAction($version, QuotationActionEnum::VIEWED, null, $ip, $customer);
            });
        }

        return $request->refresh();
    }

    /**
     * Accept the current valid quotation version and convert it into exactly
     * one order (LogicFlow §9).
     *
     * The version and request are locked first, so a second concurrent
     * accept waits, then fails the actionable check instead of creating a
     * second order. The order conversion shares this transaction, so a
     * failure leaves no partial order, payment or delivery rows.
     *
     * @return array{quotation: Quotation, quotation_request: QuotationRequest, order: Order}
     */
    public function accept(
        Customer $customer,
        Quotation $quotation,
        ?string $ip = null,
    ): array {
        $this->expireIfNeeded($quotation);

        $result = DB::transaction(function () use ($customer, $quotation, $ip): array {
            [$version, $request] = $this->lockVersionAndRequest($quotation);

            $this->assertOwnedBy($customer, $request);
            $this->assertActionable($version, 'accepted');

            $this->statuses->assertTransition(
                StatusTransitionService::DOMAIN_QUOTATION_VERSION,
                $version->status->value,
                QuotationVersionStatus::ACCEPTED->value,
            );

            $version->update([
                'status' => QuotationVersionStatus::ACCEPTED->value,
                'accepted_at' => now(),
            ]);

            $this->moveRequestTo($request, QuotationRequestStatus::ACCEPTED);

            $this->recordAction($version, QuotationActionEnum::ACCEPTED, null, $ip, $customer);

            $order = $this->orders->convert($customer, $version, $request);

            return [
                'quotation' => $version->fresh(['items.supplier']),
                'quotation_request' => $request->refresh(),
                'order' => $order,
            ];
        });

        $this->notifications->quotationAccepted($result['quotation'], $customer, $result['order']);

        return $result;
    }

    /**
     * Reject the current valid quotation version, optionally with a note.
     *
     * @return array{quotation: Quotation, quotation_request: QuotationRequest}
     */
    public function reject(
        Customer $customer,
        Quotation $quotation,
        ?string $note = null,
        ?string $ip = null,
    ): array {
        $this->expireIfNeeded($quotation);

        $result = DB::transaction(function () use ($customer, $quotation, $note, $ip): array {
            [$version, $request] = $this->lockVersionAndRequest($quotation);

            $this->assertOwnedBy($customer, $request);
            $this->assertActionable($version, 'rejected');

            $this->statuses->assertTransition(
                StatusTransitionService::DOMAIN_QUOTATION_VERSION,
                $version->status->value,
                QuotationVersionStatus::REJECTED->value,
            );

            $version->update([
                'status' => QuotationVersionStatus::REJECTED->value,
                'rejected_at' => now(),
            ]);

            $this->moveRequestTo($request, QuotationRequestStatus::REJECTED);

            $this->recordAction($version, QuotationActionEnum::REJECTED, $note, $ip, $customer);

            return [
                'quotation' => $version->fresh(['items.supplier']),
                'quotation_request' => $request->refresh(),
            ];
        });

        $this->notifications->quotationRejected($result['quotation'], $customer);

        return $result;
    }

    /**
     * Ask Admin to revise the current quotation. The customer note is
     * mandatory and travels with the action record.
     *
     * @return array{quotation: Quotation, quotation_request: QuotationRequest}
     */
    public function requestChange(
        Customer $customer,
        Quotation $quotation,
        string $note,
        ?string $ip = null,
    ): array {
        $this->expireIfNeeded($quotation);

        $result = DB::transaction(function () use ($customer, $quotation, $note, $ip): array {
            [$version, $request] = $this->lockVersionAndRequest($quotation);

            $this->assertOwnedBy($customer, $request);
            $this->assertActionable($version, 'changed');

            $this->statuses->assertTransition(
                StatusTransitionService::DOMAIN_QUOTATION_VERSION,
                $version->status->value,
                QuotationVersionStatus::CHANGE_REQUESTED->value,
            );

            $version->update(['status' => QuotationVersionStatus::CHANGE_REQUESTED->value]);

            $this->moveRequestTo($request, QuotationRequestStatus::CHANGE_REQUESTED);

            $this->recordAction(
                $version,
                QuotationActionEnum::REQUESTED_CHANGE,
                trim($note),
                $ip,
                $customer,
            );

            return [
                'quotation' => $version->fresh(['items.supplier']),
                'quotation_request' => $request->refresh(),
            ];
        });

        $this->notifications->quotationChangeRequested($result['quotation'], $customer, trim($note));

        return $result;
    }

    /**
     * Lock a version and its request in the same order as the admin workflow.
     *
     * @return array{0: Quotation, 1: QuotationRequest}
     */
    private function lockVersionAndRequest(Quotation $quotation): array
    {
        $version = Quotation::query()
            ->whereKey($quotation->id)
            ->lockForUpdate()
            ->firstOrFail();

        $request = QuotationRequest::query()
            ->whereKey($version->quotation_request_id)
            ->lockForUpdate()
            ->firstOrFail();

        return [$version, $request];
    }

    /**
     * Defense in depth: ownership is already checked when the controller
     * resolves the quotation, but re-check it inside the transaction.
     */
    private function assertOwnedBy(Customer $customer, QuotationRequest $request): void
    {
        if ($request->customer_id !== $customer->id) {
            throw ValidationException::withMessages([
                'quotation' => ['Quotation not found.'],
            ]);
        }
    }

    /**
     * Explain why a version cannot receive a customer decision.
     */
    private function assertActionable(Quotation $version, string $verb): void
    {
        if ($this->isExpired($version) || $version->status === QuotationVersionStatus::EXPIRED) {
            $until = $version->valid_until?->toDateString() ?? 'its validity date';

            throw ValidationException::withMessages([
                'quotation' => ["This quotation expired on {$until} and can no longer be {$verb}."],
            ]);
        }

        if (! $version->is_current) {
            throw ValidationException::withMessages([
                'quotation' => ['Only the current quotation version can be acted on.'],
            ]);
        }

        if (! in_array($version->status, [
            QuotationVersionStatus::SENT,
            QuotationVersionStatus::VIEWED,
        ], true)) {
            throw ValidationException::withMessages([
                'quotation' => ["This quotation can no longer be {$verb}."],
            ]);
        }
    }

    /**
     * Persist expiry for a current version that is past its validity date.
     */
    private function expireIfNeeded(Quotation $quotation): void
    {
        DB::transaction(function () use ($quotation): void {
            [$version, $request] = $this->lockVersionAndRequest($quotation);

            if ($this->isExpired($version)) {
                $this->expire($version, $request);
            }
        });
    }

    /**
     * Move an expired version and its open request to EXPIRED.
     */
    private function expire(Quotation $version, QuotationRequest $request): void
    {
        if (! in_array($version->status, [
            QuotationVersionStatus::SENT,
            QuotationVersionStatus::VIEWED,
        ], true)) {
            return;
        }

        $this->statuses->assertTransition(
            StatusTransitionService::DOMAIN_QUOTATION_VERSION,
            $version->status->value,
            QuotationVersionStatus::EXPIRED->value,
        );

        $version->update(['status' => QuotationVersionStatus::EXPIRED->value]);

        if (in_array($request->status, [
            QuotationRequestStatus::QUOTATION_SENT,
            QuotationRequestStatus::CUSTOMER_REVIEWING,
        ], true)) {
            $this->statuses->assertTransition(
                StatusTransitionService::DOMAIN_QUOTATION_REQUEST,
                $request->status->value,
                QuotationRequestStatus::EXPIRED->value,
            );

            $request->update(['status' => QuotationRequestStatus::EXPIRED->value]);
        }
    }

    /**
     * A date-only `valid_until` remains valid through the end of that day.
     */
    private function isExpired(Quotation $quotation): bool
    {
        return $quotation->valid_until !== null
            && $quotation->valid_until->toDateString() < now()->toDateString();
    }

    /**
     * Move a request along a valid transition path, skipping the update when
     * it is already in the target status.
     */
    private function moveRequestTo(
        QuotationRequest $request,
        QuotationRequestStatus $target,
    ): void {
        $from = $request->status->value;

        if ($from === $target->value) {
            return;
        }

        $path = $this->statuses->path(
            StatusTransitionService::DOMAIN_QUOTATION_REQUEST,
            $from,
            $target->value,
        );

        if ($path === null) {
            throw ValidationException::withMessages([
                'status' => ["The request cannot move from {$from} to {$target->value}."],
            ]);
        }

        $request->update(['status' => $target->value]);
    }

    /**
     * Append one customer action to the immutable trail.
     */
    private function recordAction(
        Quotation $version,
        QuotationActionEnum $action,
        ?string $note,
        ?string $ip,
        ?Customer $customer = null,
    ): QuotationAction {
        return QuotationAction::create([
            'quotation_id' => $version->id,
            'action' => $action->value,
            'customer_note' => $note !== null && $note !== '' ? $note : null,
            'actor_type' => 'CUSTOMER',
            'actor_id' => $customer?->id,
            'ip_address' => $ip,
        ]);
    }
}
