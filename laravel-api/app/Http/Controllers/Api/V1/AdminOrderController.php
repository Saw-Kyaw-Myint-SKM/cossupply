<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\OrderStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\UpdateOrderStatusRequest;
use App\Http\Resources\AdminOrderDetailResource;
use App\Http\Resources\AdminOrderResource;
use App\Http\Traits\PaginationMeta;
use App\Models\Order;
use App\Services\Order\AdminOrderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Admin order queue and supplier-confirmation workflow (Task 09).
 *
 * Delivery and payment transitions remain Task 10 and are not exposed here.
 */
class AdminOrderController extends Controller
{
    use PaginationMeta;

    public function __construct(
        private readonly AdminOrderService $orders,
    ) {}

    /**
     * Order queue with status and customer/number search filters.
     */
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'order_status' => ['nullable', Rule::in(OrderStatus::values())],
            'search' => ['nullable', 'string', 'max:100'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = Order::query()
            ->with('quotation:id,quotation_number')
            ->orderByDesc('created_at')
            ->orderByDesc('id');

        if (isset($filters['order_status'])) {
            $query->where('order_status', $filters['order_status']);
        }

        $search = trim($filters['search'] ?? '');

        if ($search !== '') {
            $query->where(function ($query) use ($search): void {
                $query->where('order_number', 'like', "%{$search}%")
                    ->orWhere('customer_name', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%");
            });
        }

        $orders = $query->paginate($filters['per_page'] ?? 15);

        return $this->successResponse([
            'orders' => AdminOrderResource::collection($orders->items()),
            'meta' => $this->paginationMeta($orders),
        ]);
    }

    /**
     * Full order detail with the Task 09 available status targets.
     */
    public function show(Order $order): JsonResponse
    {
        $this->loadDetail($order);

        return $this->successResponse([
            'order' => new AdminOrderDetailResource(
                $order,
                $this->orders->availableStatuses($order),
            ),
        ]);
    }

    /**
     * Move the order through the supplier-confirmation stages.
     */
    public function updateStatus(UpdateOrderStatusRequest $request, Order $order): JsonResponse
    {
        $order = $this->orders->updateStatus(
            $order,
            $request->validated('status'),
            $request->validated('note'),
            $request->user(),
            $request->ip(),
        );

        $order->load('quotation:id,quotation_number');

        return $this->successResponse(
            ['order' => new AdminOrderResource($order)],
            'Order status updated.',
        );
    }

    private function loadDetail(Order $order): void
    {
        $order->load([
            'quotation:id,quotation_number',
            'items.supplier',
            'deliveries',
            'cashPayment',
            'statusHistories' => fn ($query) => $query->orderBy('id'),
            'quotationRequest:id,quotation_number,status',
        ]);
    }
}
