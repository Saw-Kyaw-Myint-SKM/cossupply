<?php

namespace App\Services\Quotation;

use App\Enums\QuotationAction as QuotationActionEnum;
use App\Enums\QuotationRequestStatus;
use App\Enums\QuotationVersionStatus;
use App\Exceptions\ResourceConflictException;
use App\Models\Customer;
use App\Models\Order;
use App\Models\Quotation;
use App\Models\QuotationAction;
use App\Models\QuotationRequest;
use App\Services\Order\OrderConversionService;
use App\Services\Status\StatusTransitionService;
use Illuminate\Support\Facades\DB;

/**
 * Customer-facing quotation review actions (LogicFlow §8).
 *
 * Every read and write is scoped to the authenticated Customer. State
 * changes run inside a transaction with the quotation row locked and are
 * only applied through StatusTransitionService. Expiry is evaluated lazily
 * at request time (no scheduler in the MVP).
 */
class CustomerQuotationActionService
{
    /**
     * Request statuses in which the current quotation may be answered.
     */
    private const REVIEWABLE_REQUEST_STATUSES = [
        QuotationRequestStatus::QUOTATION_SENT,
        QuotationRequestStatus::CUSTOMER_REVIEWING,
    ];

    /**
     * Version statuses in which the current quotation may be answered.
     */
    private const REVIEWABLE_VERSION_STATUSES = [
        QuotationVersionStatus::SENT,
        QuotationVersionStatus::VIEWED,
    ];

    public function __construct(
        private readonly StatusTransitionService $statuses,
        private readonly OrderConversionService $orders,
    ) {}

    /**
     * Eager-load everything the customer detail/actions payload needs.
     */
    public function loadDetail(QuotationRequest $quotationRequest): QuotationRequest
    {
        return $quotationRequest->load([
            'items',
            'currentQuotation.order',
            'quotations' => fn ($query) => $query
                ->where('status', '!=', QuotationVersionStatus::DRAFT->value)
                ->with([
                    'items',
                    'actions' => fn ($actions) => $actions->orderBy('id'),
                ])
                ->orderByDesc('version'),
        ]);
    }

    /**
     * Record that the customer opened the current quotation.
     *
     * Returns null when the request is not owned by the customer (404).
     * Calling this repeatedly is safe: only the first effective view moves
     * SENT to VIEWED and appends exactly one VIEWED action.
     */
    public function view(Customer $customer, QuotationRequest $quotationRequest, ?string $ip = null): ?QuotationRequest
    {
        $viewed = DB::transaction(function () use ($customer, $quotationRequest, $ip): bool {
            $request = QuotationRequest::query()
                ->whereKey($quotationRequest->id)
                ->lockForUpdate()
                ->first();

            if ($request === null || (int) $request->customer_id !== (int) $customer->id) {
                return false;
            }

            $version = $this->currentVersionForUpdate($request);

            if ($version === null) {
                return true;
            }

            if ($this->expireIfNeeded($version, $request)) {
                return true;
            }

            if ($version->status !== QuotationVersionStatus::SENT) {
                return true;
            }

            $this->statuses->assertTransition(
                StatusTransitionService::DOMAIN_QUOTATION_VERSION,
                $version->status->value,
                QuotationVersionStatus::VIEWED->value,
            );

            $version->update([
                'status' => QuotationVersionStatus::VIEWED->value,
                'viewed_at' => now(),
            ]);

            // A newer request state (for example CHANGE_REQUESTED) is never
            // regressed by a later view of the same version.
            if ($request->status === QuotationRequestStatus::QUOTATION_SENT) {
                $this->statuses->assertTransition(
                    StatusTransitionService::DOMAIN_QUOTATION_REQUEST,
                    $request->status->value,
                    QuotationRequestStatus::CUSTOMER_REVIEWING->value,
                );

                $request->update(['status' => QuotationRequestStatus::CUSTOMER_REVIEWING->value]);
            }

            $alreadyViewed = QuotationAction::query()
                ->where('quotation_id', $version->id)
                ->where('action', QuotationActionEnum::VIEWED->value)
                ->exists();

            if (! $alreadyViewed) {
                $this->recordAction($version, QuotationActionEnum::VIEWED, null, $customer, $ip);
            }

            return true;
        });

        return $viewed ? $quotationRequest->refresh() : null;
    }

    /**
     * Accept the current quotation and convert it into exactly one order.
     *
     * @return array{quotation: Quotation, request: QuotationRequest, order: Order}|null
     */
    public function accept(
        Customer $customer,
        Quotation $quotation,
        bool $codTermsAccepted,
        ?string $ip = null,
    ): ?array {
        if (! $codTermsAccepted) {
            throw new ResourceConflictException('Cash on Delivery terms must be accepted.');
        }

        return $this->applyAction(
            $customer,
            $quotation,
            QuotationActionEnum::ACCEPTED,
            QuotationVersionStatus::ACCEPTED,
            QuotationRequestStatus::ACCEPTED,
            null,
            $ip,
            accepted: true,
        );
    }

    /**
     * Reject the current quotation.
     *
     * @return array{quotation: Quotation, request: QuotationRequest}|null
     */
    public function reject(
        Customer $customer,
        Quotation $quotation,
        ?string $customerNote,
        ?string $ip = null,
    ): ?array {
        return $this->applyAction(
            $customer,
            $quotation,
            QuotationActionEnum::REJECTED,
            QuotationVersionStatus::REJECTED,
            QuotationRequestStatus::REJECTED,
            $customerNote,
            $ip,
            rejected: true,
        );
    }

    /**
     * Ask Admin to prepare a revised quotation version.
     *
     * @return array{quotation: Quotation, request: QuotationRequest}|null
     */
    public function requestChange(
        Customer $customer,
        Quotation $quotation,
        string $customerNote,
        ?string $ip = null,
    ): ?array {
        return $this->applyAction(
            $customer,
            $quotation,
            QuotationActionEnum::REQUESTED_CHANGE,
            QuotationVersionStatus::CHANGE_REQUESTED,
            QuotationRequestStatus::CHANGE_REQUESTED,
            $customerNote,
            $ip,
        );
    }

    /**
     * Shared accept/reject/change-request transaction.
     *
     * @return array{quotation: Quotation, request: QuotationRequest, order?: Order}|null
     */
    private function applyAction(
        Customer $customer,
        Quotation $quotation,
        QuotationActionEnum $action,
        QuotationVersionStatus $versionStatus,
        QuotationRequestStatus $requestStatus,
        ?string $customerNote,
        ?string $ip,
        bool $accepted = false,
        bool $rejected = false,
    ): ?array {
        return DB::transaction(function () use (
            $customer,
            $quotation,
            $action,
            $versionStatus,
            $requestStatus,
            $customerNote,
            $ip,
            $accepted,
            $rejected,
        ): ?array {
            $request = QuotationRequest::query()
                ->whereKey($quotation->quotation_request_id)
                ->lockForUpdate()
                ->first();

            if ($request === null || (int) $request->customer_id !== (int) $customer->id) {
                return null;
            }

            $version = Quotation::query()
                ->whereKey($quotation->id)
                ->lockForUpdate()
                ->first();

            if ($version === null || (int) $version->quotation_request_id !== (int) $request->id) {
                return null;
            }

            $this->assertActionable($version, $request);

            if ($accepted) {
                // One quotation version converts to at most one order. The
                // unique orders.quotation_id index remains the final guard
                // for concurrent accepts.
                $this->orders->assertQuotationHasNoOrder($version);
            }

            $this->statuses->assertTransition(
                StatusTransitionService::DOMAIN_QUOTATION_VERSION,
                $version->status->value,
                $versionStatus->value,
            );
            $this->statuses->assertTransition(
                StatusTransitionService::DOMAIN_QUOTATION_REQUEST,
                $request->status->value,
                $requestStatus->value,
            );

            $attributes = ['status' => $versionStatus->value];

            if ($accepted) {
                $attributes['accepted_at'] = now();
            }

            if ($rejected) {
                $attributes['rejected_at'] = now();
            }

            $version->update($attributes);
            $request->update(['status' => $requestStatus->value]);

            $this->recordAction($version, $action, $customerNote, $customer, $ip);

            $result = [
                'quotation' => $version->refresh(),
                'request' => $request->refresh(),
            ];

            if ($accepted) {
                $result['order'] = $this->orders->createFromQuotation(
                    $customer,
                    $version,
                    $request,
                );
            }

            return $result;
        });
    }

    /**
     * Guard every customer response against stale, foreign or expired state.
     *
     * @throws ResourceConflictException
     */
    private function assertActionable(Quotation $version, QuotationRequest $request): void
    {
        if (! $version->is_current) {
            throw new ResourceConflictException('This quotation version is no longer current.');
        }

        if ($version->isExpired()) {
            throw new ResourceConflictException('This quotation has expired.');
        }

        if (! in_array($version->status, self::REVIEWABLE_VERSION_STATUSES, true)) {
            throw new ResourceConflictException('This quotation is no longer open for customer response.');
        }

        if (! in_array($request->status, self::REVIEWABLE_REQUEST_STATUSES, true)) {
            throw new ResourceConflictException('The quotation request is not open for customer review.');
        }
    }

    /**
     * Lock and return the request's current version, if any.
     */
    private function currentVersionForUpdate(QuotationRequest $request): ?Quotation
    {
        return Quotation::query()
            ->where('quotation_request_id', $request->id)
            ->where('is_current', true)
            ->lockForUpdate()
            ->first();
    }

    /**
     * Lazily persist expiry when the transitions still allow it.
     *
     * A version that was already accepted, rejected or superseded keeps its
     * terminal status; only SENT/VIEWED versions are moved to EXPIRED.
     */
    private function expireIfNeeded(Quotation $version, QuotationRequest $request): bool
    {
        if (! $version->isExpired()) {
            return false;
        }

        if (in_array($version->status, self::REVIEWABLE_VERSION_STATUSES, true)) {
            $this->statuses->assertTransition(
                StatusTransitionService::DOMAIN_QUOTATION_VERSION,
                $version->status->value,
                QuotationVersionStatus::EXPIRED->value,
            );

            $version->update(['status' => QuotationVersionStatus::EXPIRED->value]);
        }

        if (in_array($request->status, self::REVIEWABLE_REQUEST_STATUSES, true)) {
            $this->statuses->assertTransition(
                StatusTransitionService::DOMAIN_QUOTATION_REQUEST,
                $request->status->value,
                QuotationRequestStatus::EXPIRED->value,
            );

            $request->update(['status' => QuotationRequestStatus::EXPIRED->value]);
        }

        return true;
    }

    /**
     * Append one row to the append-only customer action trail.
     */
    private function recordAction(
        Quotation $version,
        QuotationActionEnum $action,
        ?string $customerNote,
        Customer $customer,
        ?string $ip,
    ): QuotationAction {
        return QuotationAction::create([
            'quotation_id' => $version->id,
            'action' => $action->value,
            'customer_note' => $customerNote,
            'actor_type' => 'CUSTOMER',
            'actor_id' => $customer->id,
            'ip_address' => $ip,
        ]);
    }
}
