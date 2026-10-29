<?php

namespace App\Services\Order;

use App\Enums\DeliveryStatus;
use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Models\Admin;
use App\Models\CashPayment;
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
 * Admin delivery workflow (LogicFlow §11).
 *
 * MVP supports full delivery only, so every action updates the single
 * delivery record together with the order status and the COD payment status.
 * The order status drives the workflow, while the delivery record is kept in
 * sync for the customer-facing delivery view.
 */
class OrderDeliveryService
{
    public function __construct(
        private readonly StatusTransitionService $statuses,
        private readonly AuditLogService $auditLogs,
        private readonly NotificationService $notifications,
        private readonly EmailNotificationService $emails,
    ) {}

    /**
     * Apply one full-delivery step chosen by the admin.
     *
     * @param  array<string, mixed>  $data
     */
    public function update(
        Order $order,
        Admin $admin,
        array $data,
        ?string $ip = null,
    ): Order {
        /** @var array{order: Order, from: string} $result */
        $result = DB::transaction(function () use ($order, $admin, $data, $ip): array {
            $locked = Order::query()->whereKey($order->id)->lockForUpdate()->firstOrFail();
            $delivery = Delivery::query()
                ->where('order_id', $locked->id)
                ->lockForUpdate()
                ->first();

            if ($delivery === null) {
                throw ValidationException::withMessages([
                    'order' => ['This order has no delivery record.'],
                ]);
            }

            $this->applyDeliveryMetadata($delivery, $data);

            $target = (string) $data['status'];
            $note = isset($data['note']) && is_string($data['note']) && trim($data['note']) !== ''
                ? trim($data['note'])
                : null;

            $fromOrder = $locked->order_status->value;
            $fromDelivery = $delivery->delivery_status->value;

            match ($target) {
                OrderStatus::PREPARING->value => $this->toPreparing($locked, $delivery, $admin, $note),
                OrderStatus::READY_TO_SHIP->value => $this->toReadyToShip($locked, $delivery, $admin, $note),
                OrderStatus::OUT_FOR_DELIVERY->value => $this->toOutForDelivery($locked, $delivery, $admin, $note),
                OrderStatus::DELIVERED->value => $this->toDelivered($locked, $delivery, $admin, $note, $data),
                OrderStatus::DELIVERY_FAILED->value => $this->toDeliveryFailed($locked, $delivery, $admin, $note),
                OrderStatus::RETURNED->value => $this->toReturned($locked, $delivery, $admin, $note),
            };

            $this->auditLogs->log(
                $admin,
                'ORDER_DELIVERY_UPDATED',
                'order',
                (string) $locked->id,
                [
                    'order_status' => $fromOrder,
                    'delivery_status' => $fromDelivery,
                ],
                [
                    'order_status' => $locked->order_status->value,
                    'delivery_status' => $delivery->delivery_status->value,
                    'payment_status' => $locked->payment_status->value,
                    'note' => $note,
                ],
                $ip,
            );

            return [
                'order' => $this->freshDetail($locked),
                'from' => $fromOrder,
            ];
        });

        $updated = $result['order'];
        $currentStatus = $updated->order_status->value;

        if ($currentStatus !== $result['from']) {
            if ($currentStatus === OrderStatus::OUT_FOR_DELIVERY->value) {
                $this->notifications->orderOutForDelivery($updated);
                $this->emails->sendOrderOutForDelivery($updated);
            }

            if ($currentStatus === OrderStatus::DELIVERED->value) {
                $this->notifications->orderDelivered($updated);
            }
        }

        return $updated;
    }

    /**
     * Supplier finished preparing the products.
     */
    private function toPreparing(
        Order $order,
        Delivery $delivery,
        Admin $admin,
        ?string $note,
    ): void {
        $orderStatus = $order->order_status;

        if (! in_array($orderStatus, [OrderStatus::ORDER_CONFIRMED, OrderStatus::PREPARING], true)) {
            $this->reject('Only a confirmed order can move into delivery preparation.');
        }

        if ($delivery->delivery_status !== DeliveryStatus::NOT_ASSIGNED) {
            if ($orderStatus === OrderStatus::PREPARING && $delivery->delivery_status === DeliveryStatus::PREPARING) {
                $this->reject('This delivery is already being prepared.');
            }

            $this->reject('The delivery cannot move back to preparation from '.$delivery->delivery_status->value.'.');
        }

        $this->transitionDelivery(
            $order,
            $delivery,
            DeliveryStatus::PREPARING,
            $admin,
            $note,
        );

        if ($orderStatus === OrderStatus::ORDER_CONFIRMED) {
            $this->transitionOrder(
                $order,
                OrderStatus::PREPARING,
                $admin,
                $note ?? 'Order moved to preparation.',
            );
        }
    }

    /**
     * Products are packed and ready for the delivery partner.
     */
    private function toReadyToShip(
        Order $order,
        Delivery $delivery,
        Admin $admin,
        ?string $note,
    ): void {
        if (! in_array($order->order_status, [OrderStatus::PREPARING, OrderStatus::DELIVERY_FAILED], true)) {
            $this->reject('Only an order in preparation or a failed delivery can be marked ready to ship.');
        }

        if (in_array($delivery->delivery_status, [DeliveryStatus::NOT_ASSIGNED, DeliveryStatus::DELIVERY_FAILED], true)) {
            $this->transitionDelivery(
                $order,
                $delivery,
                DeliveryStatus::PREPARING,
                $admin,
                $note ?? 'Delivery returned to preparation for re-delivery.',
            );
        } elseif ($delivery->delivery_status !== DeliveryStatus::PREPARING) {
            $this->reject('The delivery must be preparing before it can be marked ready to ship.');
        }

        $this->transitionOrder(
            $order,
            OrderStatus::READY_TO_SHIP,
            $admin,
            $note ?? 'Order packed and ready for the delivery partner.',
        );
    }

    /**
     * The full order leaves for delivery; cash collection becomes pending.
     */
    private function toOutForDelivery(
        Order $order,
        Delivery $delivery,
        Admin $admin,
        ?string $note,
    ): void {
        if ($order->order_status !== OrderStatus::READY_TO_SHIP) {
            $this->reject('Only an order that is ready to ship can go out for delivery.');
        }

        if (in_array($delivery->delivery_status, [DeliveryStatus::NOT_ASSIGNED, DeliveryStatus::DELIVERY_FAILED], true)) {
            $this->transitionDelivery(
                $order,
                $delivery,
                DeliveryStatus::PREPARING,
                $admin,
                $note ?? 'Delivery returned to preparation.',
            );
        }

        if ($delivery->delivery_status !== DeliveryStatus::PREPARING) {
            $this->reject('The delivery must be preparing before dispatch.');
        }

        $this->transitionDelivery(
            $order,
            $delivery,
            DeliveryStatus::OUT_FOR_DELIVERY,
            $admin,
            $note ?? 'Order dispatched for full delivery.',
        );

        if ($delivery->shipped_at === null) {
            $delivery->update(['shipped_at' => now()]);
        }

        $this->transitionOrder(
            $order,
            OrderStatus::OUT_FOR_DELIVERY,
            $admin,
            $note ?? 'Order dispatched for delivery. Cash collection is pending.',
        );

        $this->markPaymentPending($order);
    }

    /**
     * The customer received every item; cash is now recorded separately.
     */
    private function toDelivered(
        Order $order,
        Delivery $delivery,
        Admin $admin,
        ?string $note,
        array $data,
    ): void {
        if (
            $order->order_status !== OrderStatus::OUT_FOR_DELIVERY
            || $delivery->delivery_status !== DeliveryStatus::OUT_FOR_DELIVERY
        ) {
            $this->reject('Only an order that is out for delivery can be marked delivered.');
        }

        $receivedBy = isset($data['received_by']) && is_string($data['received_by'])
            ? trim($data['received_by'])
            : '';

        if ($receivedBy === '') {
            $receivedBy = $delivery->delivery_contact_name;
        }

        $delivery->update([
            'delivered_at' => now(),
            'received_by' => $receivedBy,
        ]);

        $this->transitionDelivery(
            $order,
            $delivery,
            DeliveryStatus::DELIVERED,
            $admin,
            $note ?? 'Full delivery completed.',
        );

        $this->transitionOrder(
            $order,
            OrderStatus::DELIVERED,
            $admin,
            $note ?? 'Order delivered in full. Awaiting COD collection.',
        );

        $this->markPaymentPending($order);
    }

    /**
     * The delivery attempt failed; a later re-delivery is allowed.
     */
    private function toDeliveryFailed(
        Order $order,
        Delivery $delivery,
        Admin $admin,
        ?string $note,
    ): void {
        if (
            $order->order_status !== OrderStatus::OUT_FOR_DELIVERY
            || $delivery->delivery_status !== DeliveryStatus::OUT_FOR_DELIVERY
        ) {
            $this->reject('Only an order that is out for delivery can be marked as failed.');
        }

        $this->transitionDelivery(
            $order,
            $delivery,
            DeliveryStatus::DELIVERY_FAILED,
            $admin,
            $note ?? 'Delivery attempt failed.',
        );

        $this->transitionOrder(
            $order,
            OrderStatus::DELIVERY_FAILED,
            $admin,
            $note ?? 'Delivery attempt failed. Cash collection stays pending for re-delivery.',
        );

        $this->markPaymentPending($order);
    }

    /**
     * The order comes back; any uncollected COD becomes a failed payment.
     */
    private function toReturned(
        Order $order,
        Delivery $delivery,
        Admin $admin,
        ?string $note,
    ): void {
        $returnableOrders = [
            OrderStatus::OUT_FOR_DELIVERY,
            OrderStatus::DELIVERY_FAILED,
            OrderStatus::DELIVERED,
        ];

        if (! in_array($order->order_status, $returnableOrders, true)) {
            $this->reject('This order cannot be returned from '.$order->order_status->value.'.');
        }

        $returnableDeliveries = [
            DeliveryStatus::OUT_FOR_DELIVERY,
            DeliveryStatus::DELIVERY_FAILED,
            DeliveryStatus::DELIVERED,
        ];

        if (! in_array($delivery->delivery_status, $returnableDeliveries, true)) {
            $this->reject('The delivery cannot be returned from '.$delivery->delivery_status->value.'.');
        }

        $this->transitionDelivery(
            $order,
            $delivery,
            DeliveryStatus::RETURNED,
            $admin,
            $note ?? 'Delivery returned.',
        );

        $this->transitionOrder(
            $order,
            OrderStatus::RETURNED,
            $admin,
            $note ?? 'Order returned.',
        );

        $payment = $this->cashPayment($order);

        if ($payment !== null && in_array($payment->status, [PaymentStatus::NOT_PAID, PaymentStatus::CASH_COLLECTION_PENDING], true)) {
            $this->transitionPayment($payment, PaymentStatus::PAYMENT_FAILED, $order);
        }
    }

    /**
     * Persist optional dispatch metadata supplied with the action.
     *
     * @param  array<string, mixed>  $data
     */
    private function applyDeliveryMetadata(Delivery $delivery, array $data): void
    {
        $updates = [];

        foreach (['delivery_partner', 'tracking_number', 'estimated_delivery_date'] as $field) {
            if (array_key_exists($field, $data) && $data[$field] !== null && $data[$field] !== '') {
                $updates[$field] = $data[$field];
            }
        }

        if ($updates !== []) {
            $delivery->update($updates);
        }
    }

    /**
     * Apply one declared delivery transition and mirror it onto the order.
     */
    private function transitionDelivery(
        Order $order,
        Delivery $delivery,
        DeliveryStatus $target,
        Admin $admin,
        ?string $note,
    ): void {
        $from = $delivery->delivery_status->value;

        if ($from === $target->value) {
            return;
        }

        $this->statuses->assertTransition(
            StatusTransitionService::DOMAIN_DELIVERY,
            $from,
            $target->value,
        );

        $delivery->update(['delivery_status' => $target->value]);
        $order->update(['delivery_status' => $target->value]);
        $order->refresh();
        $delivery->refresh();
    }

    /**
     * Apply one declared order transition and append its history row.
     */
    private function transitionOrder(
        Order $order,
        OrderStatus $target,
        Admin $admin,
        string $note,
    ): void {
        $from = $order->order_status->value;

        if ($from === $target->value) {
            return;
        }

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
     * Move the COD record into collection-pending once the order ships.
     */
    private function markPaymentPending(Order $order): void
    {
        $payment = $this->cashPayment($order);

        if ($payment === null) {
            return;
        }

        if ($payment->status === PaymentStatus::NOT_PAID) {
            $this->transitionPayment($payment, PaymentStatus::CASH_COLLECTION_PENDING, $order);
        }
    }

    private function transitionPayment(
        CashPayment $payment,
        PaymentStatus $target,
        Order $order,
    ): void {
        $from = $payment->status->value;

        if ($from === $target->value) {
            return;
        }

        $this->statuses->assertTransition(
            StatusTransitionService::DOMAIN_CASH_PAYMENT,
            $from,
            $target->value,
        );

        $payment->update(['status' => $target->value]);
        $order->update(['payment_status' => $target->value]);
        $order->refresh();
    }

    private function cashPayment(Order $order): ?CashPayment
    {
        return CashPayment::query()->where('order_id', $order->id)->first();
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

    /**
     * @throws ValidationException
     */
    private function reject(string $message): never
    {
        throw ValidationException::withMessages([
            'order' => [$message],
        ]);
    }
}
