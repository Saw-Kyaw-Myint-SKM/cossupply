<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\OrderStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\OrderDetailResource;
use App\Http\Resources\OrderSummaryResource;
use App\Http\Traits\PaginationMeta;
use App\Models\Customer;
use App\Models\Order;
use App\Services\Order\CashCollectionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Customer-facing order reads (Task 09) and private receipt downloads
 * (Task 10).
 *
 * Orders are created only by accepting a quotation; this API never creates
 * one. Every read is scoped to the authenticated customer, and a foreign
 * order id answers 404 so ids cannot be probed.
 */
class CustomerOrderController extends Controller
{
    use PaginationMeta;

    public function __construct(
        private readonly CashCollectionService $cash,
    ) {}

    /**
     * List the authenticated customer's own orders, newest first.
     */
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'status' => ['nullable', Rule::in(OrderStatus::values())],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        /** @var Customer $customer */
        $customer = $request->user();

        $query = Order::query()
            ->where('customer_id', $customer->id)
            ->withCount('items')
            ->orderByDesc('id');

        if (isset($filters['status'])) {
            $query->where('order_status', $filters['status']);
        }

        $orders = $query->paginate($filters['per_page'] ?? 15);

        return $this->successResponse([
            'orders' => OrderSummaryResource::collection($orders->items()),
            'meta' => $this->paginationMeta($orders),
            'statuses' => OrderStatus::values(),
        ]);
    }

    /**
     * Show one order owned by the authenticated customer.
     */
    public function show(Request $request, Order $order): JsonResponse
    {
        /** @var Customer $customer */
        $customer = $request->user();

        if ($order->customer_id !== $customer->id) {
            return $this->notFoundResponse('Order not found.');
        }

        $order->loadCount('items')->load([
            'quotation',
            'items.supplier',
            'deliveries',
            'cashPayment',
            'statusHistories' => fn ($query) => $query->orderBy('id'),
        ]);

        return $this->successResponse(['order' => new OrderDetailResource($order)]);
    }

    /**
     * Download the private COD receipt for an order owned by the customer.
     */
    public function downloadReceipt(Request $request, Order $order): StreamedResponse|JsonResponse
    {
        /** @var Customer $customer */
        $customer = $request->user();

        if ($order->customer_id !== $customer->id) {
            return $this->notFoundResponse('Order not found.');
        }

        $receipt = $this->cash->receipt($order);

        if ($receipt === null) {
            return $this->notFoundResponse('Receipt not found.');
        }

        return Storage::disk('local')->download(
            $receipt['path'],
            $receipt['file_name'],
            ['Content-Type' => 'application/pdf'],
        );
    }
}
