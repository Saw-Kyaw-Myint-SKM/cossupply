<?php

namespace App\Services\Order;

use App\Enums\DeliveryStatus;
use App\Enums\OrderStatus;
use App\Models\Admin;
use App\Models\Delivery;
use App\Models\Order;
use App\Models\OrderStatusHistory;
use App\Services\Audit\AuditLogService;
use App\Services\Notification\EmailNotificationService;
use App\Services\Notification\NotificationService;
use App\Services\Status\StatusTransitionService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Admin supplier-confirmation workflow (LogicFlow §10).
 *
 * Confirming an order walks the declared path
 * `SUPPLIER_CONFIRMATION_REQUIRED → ORDER_CONFIRMED → PREPARING`, writing an
 * append-only status history row for each hop. Marking a supplier
 * unavailable stops at `SUPPLIER_UNAVAILABLE`. Cancellation is only accepted
 * from statuses that may transition to `CANCELLED`; every action is audited.
 */
class OrderWorkflowService
{
    public function __construct(
        private readonly StatusTransitionService $statuses,
        private readonly AuditLogService $auditLogs,
        private readonly NotificationService $notifications,
        private readonly EmailNotificationService $emails,
    ) {}

    /**
     * Supplier confirmed the product, quantity and delivery date.
     */
    public function confirm(
        Order $order,
        Admin $admin,
        ?string $note = null,
        ?string $ip = null,
    ): Order {
        $confirmed = DB::transaction(function () use ($order, $admin, $note, $ip): Order {
            $locked = $this->lockOrder($order);

            $this->assertCurrentStatus(
                $locked,
                OrderStatus::SUPPLIER_CONFIRMATION_REQUIRED,
                'Only an order waiting for supplier confirmation can be confirmed.',
            );

            $this->transition(
                $locked,
                OrderStatus::ORDER_CONFIRMED,
                $admin,
                $note ?? 'Supplier confirmed product, quantity and delivery date.',
            );

            $this->transition(
                $locked,
                OrderStatus::PREPARING,
                $admin,
                $note ?? 'Order moved to preparation after supplier confirmation.',
            );

            // The delivery workflow starts as soon as the products are in
            // preparation; the delivery record mirrors the order status.
            $delivery = Delivery::query()
                ->where('order_id', $locked->id)
                ->lockForUpdate()
                ->first();

            if ($delivery !== null && $delivery->delivery_status === DeliveryStatus::NOT_ASSIGNED) {
                $this->statuses->assertTransition(
                    StatusTransitionService::DOMAIN_DELIVERY,
                    DeliveryStatus::NOT_ASSIGNED->value,
                    DeliveryStatus::PREPARING->value,
                );

                $delivery->update(['delivery_status' => DeliveryStatus::PREPARING->value]);
                $locked->update(['delivery_status' => DeliveryStatus::PREPARING->value]);
            }

            $this->auditLogs->log(
                $admin,
                'ORDER_SUPPLIER_CONFIRMED',
                'order',
                (string) $locked->id,
                ['order_status' => OrderStatus::SUPPLIER_CONFIRMATION_REQUIRED->value],
                [
                    'order_status' => OrderStatus::PREPARING->value,
                    'note' => $note,
                ],
                $ip,
            );

            return $this->freshDetail($locked);
        });

        $this->notifications->orderConfirmed($confirmed);
        $this->emails->sendOrderConfirmed($confirmed);

        return $confirmed;
    }

    /**
     * The supplier cannot fulfil the order.
     */
    public function markSupplierUnavailable(
        Order $order,
        Admin $admin,
        ?string $note = null,
        ?string $ip = null,
    ): Order {
        return DB::transaction(function () use ($order, $admin, $note, $ip): Order {
            $locked = $this->lockOrder($order);

            $this->assertCurrentStatus(
                $locked,
                OrderStatus::SUPPLIER_CONFIRMATION_REQUIRED,
                'Only an order waiting for supplier confirmation can be marked unavailable.',
            );

            $this->transition(
                $locked,
                OrderStatus::SUPPLIER_UNAVAILABLE,
                $admin,
                $note ?? 'Supplier could not fulfil the order.',
            );

            $this->auditLogs->log(
                $admin,
                'ORDER_SUPPLIER_UNAVAILABLE',
                'order',
                (string) $locked->id,
                ['order_status' => OrderStatus::SUPPLIER_CONFIRMATION_REQUIRED->value],
                [
                    'order_status' => OrderStatus::SUPPLIER_UNAVAILABLE->value,
                    'note' => $note,
                ],
                $ip,
            );

            return $this->freshDetail($locked);
        });
    }

    /**
     * Cancel an order from any status that may transition to CANCELLED.
     */
    public function cancel(
        Order $order,
        Admin $admin,
        string $note,
        ?string $ip = null,
    ): Order {
        $cancelled = DB::transaction(function () use ($order, $admin, $note, $ip): Order {
            $locked = $this->lockOrder($order);
            $from = $locked->order_status->value;

            if (! $this->statuses->canTransition(
                StatusTransitionService::DOMAIN_ORDER,
                $from,
                OrderStatus::CANCELLED->value,
            )) {
                throw ValidationException::withMessages([
                    'order' => ["An order in {$from} cannot be cancelled."],
                ]);
            }

            $this->transition($locked, OrderStatus::CANCELLED, $admin, $note);

            $this->auditLogs->log(
                $admin,
                'ORDER_CANCELLED',
                'order',
                (string) $locked->id,
                ['order_status' => $from],
                [
                    'order_status' => OrderStatus::CANCELLED->value,
                    'note' => $note,
                ],
                $ip,
            );

            return $this->freshDetail($locked);
        });

        $this->notifications->orderCancelled($cancelled);
        $this->emails->sendOrderCancelled($cancelled);

        return $cancelled;
    }

    /**
     * Lock the order row so two admins cannot apply competing transitions.
     */
    private function lockOrder(Order $order): Order
    {
        return Order::query()->whereKey($order->id)->lockForUpdate()->firstOrFail();
    }

    /**
     * Explain why the current status does not allow an action.
     */
    private function assertCurrentStatus(Order $order, OrderStatus $expected, string $message): void
    {
        if ($order->order_status !== $expected) {
            throw ValidationException::withMessages([
                'order' => [$message],
            ]);
        }
    }

    /**
     * Apply one declared transition and append its history row.
     */
    private function transition(
        Order $order,
        OrderStatus $target,
        Admin $admin,
        string $note,
    ): void {
        $from = $order->order_status->value;
        $this->statuses->assertTransition(
            StatusTransitionService::DOMAIN_ORDER,
            $from,
            $target->value,
        );

        $order->update(['order_status' => $target->value]);

        OrderStatusHistory::create([
            'order_id' => $order->id,
            'old_status' => $from,
            'new_status' => $target->value,
            'changed_by_type' => 'ADMIN',
            'changed_by_id' => $admin->id,
            'note' => $note,
        ]);
    }

    /**
     * Reload the relations the admin order detail returns.
     */
    private function freshDetail(Order $order): Order
    {
        return $order->refresh()->load([
            'quotation',
            'items.supplier',
            'deliveries',
            'cashPayment',
            'statusHistories' => fn ($query) => $query->orderBy('id'),
        ]);
    }
}
