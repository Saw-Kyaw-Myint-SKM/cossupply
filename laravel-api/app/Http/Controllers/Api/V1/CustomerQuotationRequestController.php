<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\StoreQuotationRequestRequest;
use App\Http\Resources\QuotationRequestResource;
use App\Http\Resources\QuotationVersionSummaryResource;
use App\Http\Traits\PaginationMeta;
use App\Models\Customer;
use App\Models\QuotationRequest;
use App\Services\Quotation\QuotationRequestService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Customer-facing quotation request API (LogicFlow §5).
 *
 * Request identity comes exclusively from the authenticated customer;
 * ownership is enforced server-side on every read. Items arrive as
 * product_id/quantity pairs from the cart and are snapshotted from the
 * source products.
 */
class CustomerQuotationRequestController extends Controller
{
    use PaginationMeta;

    public function __construct(
        private readonly QuotationRequestService $quotationRequests,
    ) {}

    /**
     * List the authenticated customer's own quotation requests, newest
     * first.
     */
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        /** @var Customer $customer */
        $customer = $request->user();

        $requests = QuotationRequest::query()
            ->where('customer_id', $customer->id)
            ->withCount('items')
            ->with('currentQuotation')
            ->orderByDesc('id')
            ->paginate($filters['per_page'] ?? 15);

        return $this->successResponse([
            'quotation_requests' => $requests->getCollection()
                ->map(fn (QuotationRequest $quotationRequest): array => [
                    'id' => $quotationRequest->id,
                    'quotation_number' => $quotationRequest->quotation_number,
                    'status' => $quotationRequest->status->value,
                    'customer_name' => $quotationRequest->customer_name,
                    'phone' => $quotationRequest->phone,
                    'city' => $quotationRequest->city,
                    'township' => $quotationRequest->township,
                    'item_count' => $quotationRequest->items_count,
                    'current_quotation' => $quotationRequest->currentQuotation !== null
                        ? (new QuotationVersionSummaryResource($quotationRequest->currentQuotation))->resolve()
                        : null,
                    'created_at' => $quotationRequest->created_at?->toIso8601String(),
                ])
                ->all(),
            'meta' => $this->paginationMeta($requests),
        ]);
    }

    /**
     * Submit a quotation request from the customer's cart.
     */
    public function store(StoreQuotationRequestRequest $request): JsonResponse
    {
        /** @var Customer $customer */
        $customer = $request->user();

        $quotationRequest = $this->quotationRequests->submit($customer, $request->validated());

        return $this->successResponse(
            ['quotation_request' => new QuotationRequestResource($quotationRequest->load('items'))],
            'Quotation request submitted successfully.',
            201,
        );
    }
}
