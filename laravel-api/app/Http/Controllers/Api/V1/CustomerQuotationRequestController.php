<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\QuotationRequestStatus;
use App\Enums\QuotationVersionStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\StoreQuotationRequestRequest;
use App\Http\Resources\CustomerQuotationDetailResource;
use App\Http\Resources\QuotationRequestResource;
use App\Http\Traits\PaginationMeta;
use App\Models\Customer;
use App\Models\QuotationRequest;
use App\Services\Quotation\CustomerQuotationActionService;
use App\Services\Quotation\QuotationRequestService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Customer-facing quotation request API (LogicFlow §5 and §8).
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
        private readonly CustomerQuotationActionService $actions,
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
                ->map(function (QuotationRequest $quotationRequest): array {
                    $current = $quotationRequest->currentQuotation;

                    return [
                        'id' => $quotationRequest->id,
                        'quotation_number' => $quotationRequest->quotation_number,
                        'status' => $quotationRequest->status->value,
                        'customer_name' => $quotationRequest->customer_name,
                        'phone' => $quotationRequest->phone,
                        'city' => $quotationRequest->city,
                        'township' => $quotationRequest->township,
                        'item_count' => $quotationRequest->items_count,
                        'created_at' => $quotationRequest->created_at?->toIso8601String(),
                        'current_quotation_id' => $current?->id,
                        'current_version' => $current?->version,
                        'current_status' => $current?->status->value,
                        'valid_until' => $current?->valid_until?->toDateString(),
                        'is_expired' => $quotationRequest->status === QuotationRequestStatus::EXPIRED
                            || ($current !== null && ($current->status === QuotationVersionStatus::EXPIRED || $current->isExpired())),
                    ];
                })
                ->all(),
            'meta' => $this->paginationMeta($requests),
        ]);
    }

    /**
     * Show one owned quotation request with all versions newest first.
     *
     * Reading is side-effect free; expiry is only persisted by the explicit
     * view endpoint.
     */
    public function show(Request $request, QuotationRequest $quotationRequest): JsonResponse
    {
        if (! $this->isOwnedBy($request, $quotationRequest)) {
            return $this->notFoundResponse('Quotation request not found.');
        }

        $quotationRequest = $this->actions->loadDetail($quotationRequest);

        return $this->successResponse([
            'quotation_request' => new CustomerQuotationDetailResource($quotationRequest),
        ]);
    }

    /**
     * Record that the customer opened the current quotation. Repeat calls
     * are idempotent and never duplicate the VIEWED action.
     */
    public function view(Request $request, QuotationRequest $quotationRequest): JsonResponse
    {
        /** @var Customer $customer */
        $customer = $request->user();

        $quotationRequest = $this->actions->view($customer, $quotationRequest, $request->ip());

        if ($quotationRequest === null) {
            return $this->notFoundResponse('Quotation request not found.');
        }

        $quotationRequest = $this->actions->loadDetail($quotationRequest);

        return $this->successResponse([
            'quotation_request' => new CustomerQuotationDetailResource($quotationRequest),
        ]);
    }

    /**
     * Whether the request belongs to the authenticated customer.
     */
    private function isOwnedBy(Request $request, QuotationRequest $quotationRequest): bool
    {
        return (int) $quotationRequest->customer_id === (int) $request->user()->id;
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
