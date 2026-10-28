<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\CancelOrderRequest;
use App\Http\Requests\Api\V1\ConfirmCashPaymentRequest;
use App\Http\Requests\Api\V1\CustomerRefusedPaymentRequest;
use App\Http\Requests\Api\V1\RecordCashCollectionRequest;
use App\Http\Requests\Api\V1\SupplierConfirmationRequest;
use App\Http\Requests\Api\V1\UpdateDeliveryStatusRequest;
use App\Http\Resources\OrderDetailResource;
use App\Http\Resources\OrderSummaryResource;
use App\Http\Traits\PaginationMeta;
use App\Models\Admin;
use App\Models\Order;
use App\Services\Order\CashCollectionService;
use App\Services\Order\OrderDeliveryService;
use App\Services\Order\OrderWorkflowService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Admin order queue, order detail, supplier confirmation (LogicFlow §10),
 * delivery workflow (LogicFlow §11) and COD collection (LogicFlow §12).
 */
class AdminOrderController extends Controller
{
    use PaginationMeta;

    public function __construct(
        private readonly OrderWorkflowService $workflow,
        private readonly OrderDeliveryService $deliveries,
        private readonly CashCollectionService $cash,
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
     * Advance the full delivery workflow (PREPARING → READY_TO_SHIP →
     * OUT_FOR_DELIVERY → DELIVERED) or record a failure/return.
     */
    public function deliveryStatus(
        UpdateDeliveryStatusRequest $request,
        Order $order,
    ): JsonResponse {
        /** @var Admin $admin */
        $admin = $request->user();

        $order = $this->deliveries->update(
            $order,
            $admin,
            $request->validated(),
            $request->ip(),
        );

        return $this->successResponse(
            ['order' => new OrderDetailResource($this->loadDetail($order))],
            'Delivery status updated.',
        );
    }

    /**
     * Record the full COD amount handed over on delivery.
     */
    public function cashCollection(
        RecordCashCollectionRequest $request,
        Order $order,
    ): JsonResponse {
        /** @var Admin $admin */
        $admin = $request->user();

        $order = $this->cash->collect(
            $order,
            $admin,
            $request->validated(),
            $request->ip(),
        );

        return $this->successResponse(
            ['order' => new OrderDetailResource($this->loadDetail($order))],
            'Cash collection recorded.',
        );
    }

    /**
     * Verify the collected cash and complete the delivered order.
     */
    public function paymentConfirmation(
        ConfirmCashPaymentRequest $request,
        Order $order,
    ): JsonResponse {
        /** @var Admin $admin */
        $admin = $request->user();

        $order = $this->cash->confirm(
            $order,
            $admin,
            $request->validated('note'),
            $request->ip(),
        );

        return $this->successResponse(
            ['order' => new OrderDetailResource($this->loadDetail($order))],
            'Payment confirmed and order completed.',
        );
    }

    /**
     * Record a customer refusing to pay and the resulting delivery outcome.
     */
    public function customerRefusedPayment(
        CustomerRefusedPaymentRequest $request,
        Order $order,
    ): JsonResponse {
        /** @var Admin $admin */
        $admin = $request->user();

        $order = $this->cash->refuse(
            $order,
            $admin,
            $request->validated(),
            $request->ip(),
        );

        return $this->successResponse(
            ['order' => new OrderDetailResource($this->loadDetail($order))],
            'Customer payment refusal recorded.',
        );
    }

    /**
     * Download the private COD receipt for an order.
     */
    public function downloadReceipt(Order $order): StreamedResponse|JsonResponse
    {
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
