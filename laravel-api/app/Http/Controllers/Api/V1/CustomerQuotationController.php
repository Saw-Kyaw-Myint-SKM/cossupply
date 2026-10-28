<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\RejectQuotationRequest;
use App\Http\Requests\Api\V1\RequestQuotationChangeRequest;
use App\Http\Resources\CustomerQuotationDetailResource;
use App\Http\Resources\QuotationVersionResource;
use App\Models\Customer;
use App\Models\Quotation;
use App\Models\QuotationRequest;
use App\Services\Quotation\CustomerQuotationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Customer quotation review and decisions (LogicFlow §8).
 *
 * Every lookup is scoped through the authenticated customer. A quotation that
 * belongs to someone else answers 404, never 403, so ids cannot be probed.
 */
class CustomerQuotationController extends Controller
{
    public function __construct(
        private readonly CustomerQuotationService $quotations,
    ) {}

    /**
     * Show one owned request with the current version, history and actions.
     *
     * Opening the current sent version is the customer's "viewed" action:
     * statuses move to VIEWED / CUSTOMER_REVIEWING and a VIEWED action row is
     * appended (idempotent on repeat views).
     */
    public function show(Request $request, string $quotationRequest): JsonResponse
    {
        /** @var Customer $customer */
        $customer = $request->user();

        $owned = $this->quotations->openDetail(
            $customer,
            ctype_digit($quotationRequest) ? (int) $quotationRequest : 0,
            $request->ip(),
        );

        if ($owned === null) {
            return $this->notFoundResponse('Quotation request not found.');
        }

        $owned->load([
            'items.supplier',
            'quotations' => fn ($query) => $query->orderByDesc('version'),
            'currentQuotation.items.supplier',
            'currentQuotation.actions' => fn ($query) => $query->orderByDesc('id'),
        ]);

        return $this->successResponse([
            'quotation_request' => new CustomerQuotationDetailResource($owned),
        ]);
    }

    /**
     * Accept the current valid quotation version.
     */
    public function accept(Request $request, string $quotation): JsonResponse
    {
        $owned = $this->resolveOwned($request, $quotation);

        if ($owned === null) {
            return $this->notFoundResponse('Quotation not found.');
        }

        /** @var Customer $customer */
        $customer = $request->user();

        $result = $this->quotations->accept($customer, $owned, $request->ip());

        return $this->successResponse(
            $this->decisionPayload($result),
            'Quotation accepted successfully.',
        );
    }

    /**
     * Reject the current valid quotation version.
     */
    public function reject(RejectQuotationRequest $request, string $quotation): JsonResponse
    {
        $owned = $this->resolveOwned($request, $quotation);

        if ($owned === null) {
            return $this->notFoundResponse('Quotation not found.');
        }

        /** @var Customer $customer */
        $customer = $request->user();

        $result = $this->quotations->reject(
            $customer,
            $owned,
            $request->validated('customer_note'),
            $request->ip(),
        );

        return $this->successResponse(
            $this->decisionPayload($result),
            'Quotation rejected.',
        );
    }

    /**
     * Ask Admin to revise the current quotation with a mandatory note.
     */
    public function requestChange(
        RequestQuotationChangeRequest $request,
        string $quotation,
    ): JsonResponse {
        $owned = $this->resolveOwned($request, $quotation);

        if ($owned === null) {
            return $this->notFoundResponse('Quotation not found.');
        }

        /** @var Customer $customer */
        $customer = $request->user();

        $result = $this->quotations->requestChange(
            $customer,
            $owned,
            $request->validated('customer_note'),
            $request->ip(),
        );

        return $this->successResponse(
            $this->decisionPayload($result),
            'Change request sent to the supplier team.',
        );
    }

    /**
     * Resolve a quotation owned by the authenticated customer.
     */
    private function resolveOwned(Request $request, string $quotation): ?Quotation
    {
        /** @var Customer $customer */
        $customer = $request->user();

        return $this->quotations->findOwnedQuotation(
            $customer,
            ctype_digit($quotation) ? (int) $quotation : 0,
        );
    }

    /**
     * @param  array{quotation: Quotation, quotation_request: QuotationRequest}  $result
     * @return array<string, mixed>
     */
    private function decisionPayload(array $result): array
    {
        return [
            'quotation' => new QuotationVersionResource($result['quotation']),
            'quotation_request' => [
                'id' => $result['quotation_request']->id,
                'status' => $result['quotation_request']->status->value,
            ],
        ];
    }
}
