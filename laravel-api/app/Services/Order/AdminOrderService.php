<?php

namespace App\Services\Order;

use App\Enums\OrderStatus;
use App\Exceptions\InvalidStatusTransitionException;
use App\Models\Admin;
use App\Models\Order;
use App\Models\OrderStatusHistory;
use App\Services\Audit\AuditLogService;
use App\Services\Status\StatusTransitionService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Admin supplier-confirmation workflow for orders (LogicFlow §10).
 *
 * Task 09 owns the pre-delivery supplier stages only. Delivery and payment
 * transitions belong to Task 10 and are rejected here even when the
 * declared status graph would eventually allow them.
 */
class AdminOrderService
{
    /**
     * The only status targets an Admin may set in Task 09.
     *
     * @var list<string>
     */
    public const TASK09_TARGETS = [
        OrderStatus::ORDER_CONFIRMED->value,
        OrderStatus::PREPARING->value,
        OrderStatus::SUPPLIER_UNAVAILABLE->value,
        OrderStatus::CANCELLED->value,
    ];

    /**
     * Targets that must carry an explanatory note.
     *
     * @var list<string>
     */
    public const NOTE_REQUIRED_TARGETS = [
        OrderStatus::SUPPLIER_UNAVAILABLE->value,
        OrderStatus::CANCELLED->value,
    ];

    public function __construct(
        private readonly StatusTransitionService $statuses,
        private readonly AuditLogService $auditLogs,
    ) {}

    /**
     * Task 09 statuses that are valid from the order's current status.
     *
     * @return list<string>
     */
    public function availableStatuses(Order $order): array
    {
        $current = $order->order_status->value;

        return array_values(array_filter(
            self::TASK09_TARGETS,
            fn (string $target): bool => $this->statuses->canTransition(
                StatusTransitionService::DOMAIN_ORDER,
                $current,
                $target,
            ),
        ));
    }

    /**
     * Apply one supplier-confirmation stage change atomically.
     *
     * The order row is locked and the current status re-read so a
     * concurrent Admin action cannot be overwritten. Every change appends
     * both an order status history row and an audit log entry.
     *
     * @throws InvalidStatusTransitionException
     * @throws ValidationException
     */
    public function updateStatus(
        Order $order,
        string $status,
        ?string $note,
        Admin $admin,
        ?string $ip = null,
    ): Order {
        return DB::transaction(function () use ($order, $status, $note, $admin, $ip): Order {
            $locked = Order::query()
                ->whereKey($order->id)
                ->lockForUpdate()
                ->firstOrFail();

            $from = $locked->order_status->value;
            $target = OrderStatus::from($status);

            if (! in_array($target->value, self::TASK09_TARGETS, true)) {
                throw ValidationException::withMessages([
                    'status' => ['This status is managed by the delivery and payment workflow.'],
                ]);
            }

            $this->statuses->assertTransition(
                StatusTransitionService::DOMAIN_ORDER,
                $from,
                $target->value,
            );

            $normalizedNote = $note !== null && trim($note) !== '' ? trim($note) : null;

            $locked->update(['order_status' => $target->value]);

            OrderStatusHistory::create([
                'order_id' => $locked->id,
                'old_status' => $from,
                'new_status' => $target->value,
                'changed_by_type' => 'ADMIN',
                'changed_by_id' => $admin->id,
                'note' => $normalizedNote,
            ]);

            $this->auditLogs->log(
                $admin,
                'order.status_updated',
                'order',
                (string) $locked->id,
                ['status' => $from],
                ['status' => $target->value, 'note' => $normalizedNote],
                $ip,
            );

            return $locked->refresh();
        });
    }
}
