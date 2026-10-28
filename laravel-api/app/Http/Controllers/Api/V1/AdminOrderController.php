<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\CancelOrderRequest;
use App\Http\Requests\Api\V1\SupplierConfirmationRequest;
use App\Http\Resources\OrderDetailResource;
use App\Http\Resources\OrderSummaryResource;
use App\Http\Traits\PaginationMeta;
use App\Models\Admin;
use App\Models\Order;
use App\Services\Order\OrderWorkflowService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Admin order queue, order detail and the supplier-confirmation workflow
 * (LogicFlow §10).
 */
class AdminOrderController extends Controller
{
    use PaginationMeta;

    public function __construct(
        private readonly OrderWorkflowService $workflow,
    ) {}

    /**
     * Order queue with status, payment-status and text filters.
     */
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'status' => ['nullable', Rule::in(OrderStatus::values())],
            'payment_status' => ['nullable', Rule::in(PaymentStatus::values())],
            'search' => ['nullable', 'string', 'max:100'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = Order::query()
            ->withCount('items')
            ->orderByDesc('id');

        if (isset($filters['status'])) {
            $query->where('order_status', $filters['status']);
        }

        if (isset($filters['payment_status'])) {
            $query->where('payment_status', $filters['payment_status']);
        }

        if (isset($filters['search'])) {
            $search = trim($filters['search']);

            $query->where(function ($query) use ($search): void {
                $query->where('order_number', 'like', "%{$search}%")
                    ->orWhere('customer_name', 'like', "%{$search}%")
                    ->orWhere('company_name', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        $orders = $query->paginate($filters['per_page'] ?? 15);

        return $this->successResponse([
            'orders' => OrderSummaryResource::collection($orders->items()),
            'meta' => $this->paginationMeta($orders),
            'statuses' => OrderStatus::values(),
            'payment_statuses' => PaymentStatus::values(),
        ]);
    }

    /**
     * Full order detail with items, delivery, COD payment and status trail.
     */
    public function show(Order $order): JsonResponse
    {
        return $this->successResponse([
            'order' => new OrderDetailResource($this->loadDetail($order)),
        ]);
    }

    /**
     * Record the supplier's answer: confirmed (ORDER_CONFIRMED → PREPARING)
     * or unavailable.
     */
    public function supplierConfirmation(
        SupplierConfirmationRequest $request,
        Order $order,
    ): JsonResponse {
        /** @var Admin $admin */
        $admin = $request->user();
        $note = $request->validated('note');

        $order = $request->validated('result') === 'CONFIRMED'
            ? $this->workflow->confirm($order, $admin, $note, $request->ip())
            : $this->workflow->markSupplierUnavailable($order, $admin, $note, $request->ip());

        return $this->successResponse(
            ['order' => new OrderDetailResource($this->loadDetail($order))],
            'Supplier confirmation recorded.',
        );
    }

    /**
     * Cancel an order from any status that allows cancellation.
     */
    public function cancel(CancelOrderRequest $request, Order $order): JsonResponse
    {
        /** @var Admin $admin */
        $admin = $request->user();

        $order = $this->workflow->cancel(
            $order,
            $admin,
            $request->validated('note'),
            $request->ip(),
        );

        return $this->successResponse(
            ['order' => new OrderDetailResource($this->loadDetail($order))],
            'Order cancelled.',
        );
    }

    /**
     * Load every relation the order detail renders.
     */
    private function loadDetail(Order $order): Order
    {
        return $order->loadCount('items')->load([
            'quotation',
            'items.supplier',
            'deliveries',
            'cashPayment',
            'statusHistories' => fn ($query) => $query->orderBy('id'),
        ]);
    }
}
