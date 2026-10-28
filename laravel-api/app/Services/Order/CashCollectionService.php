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
use App\Services\Status\StatusTransitionService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Full COD collection, verification and customer-refusal handling
 * (LogicFlow §12, MoneyAndValidationRules §4).
 *
 * Partial payment is never accepted: collection must equal `amount_due`, and
 * payment confirmation requires a delivered order, a receipt number and full
 * collection before the order can become COMPLETED.
 */
class CashCollectionService
{
    public function __construct(
        private readonly StatusTransitionService $statuses,
        private readonly AuditLogService $auditLogs,
        private readonly CashReceiptPdfService $receipts,
    ) {}

    /**
     * Record the full cash amount handed over at delivery.
     *
     * @param  array<string, mixed>  $data
     */
    public function collect(
        Order $order,
        Admin $admin,
        array $data,
        ?string $ip = null,
    ): Order {
        return DB::transaction(function () use ($order, $admin, $data, $ip): Order {
            $locked = $this->lockOrder($order);
            $payment = $this->lockPayment($locked);
            $delivery = $this->delivery($locked);

            if (
                $locked->order_status !== OrderStatus::DELIVERED
                || $delivery?->delivery_status !== DeliveryStatus::DELIVERED
            ) {
                $this->reject(
                    'order',
                    'Cash can only be collected after the full order is delivered.',
                );
            }

            if (in_array($payment->status, [PaymentStatus::CASH_COLLECTED, PaymentStatus::PAYMENT_CONFIRMED], true)) {
                $this->reject('payment', 'The cash for this order has already been collected.');
            }

            if (in_array($payment->status, [PaymentStatus::CUSTOMER_REFUSED_TO_PAY, PaymentStatus::PAYMENT_FAILED], true)) {
                $this->reject('payment', 'A '.$payment->status->value.' payment cannot be collected.');
            }

            $amount = (int) ($data['amount_collected'] ?? -1);

            if ($amount !== $payment->amount_due) {
                $this->reject(
                    'amount_collected',
                    sprintf(
                        'Full payment only: collect exactly %s MMK (amount due).',
                        number_format($payment->amount_due),
                    ),
                );
            }

            $receiptNumber = trim((string) ($data['receipt_number'] ?? $payment->receipt_number));

            if ($receiptNumber === '') {
                $this->reject('receipt_number', 'A receipt number is required before cash can be recorded.');
            }

            if ($payment->status === PaymentStatus::NOT_PAID) {
                $this->transitionPayment($payment, $locked, PaymentStatus::CASH_COLLECTION_PENDING);
            }

            $this->statuses->assertTransition(
                StatusTransitionService::DOMAIN_CASH_PAYMENT,
                $payment->status->value,
                PaymentStatus::CASH_COLLECTED->value,
            );

            $collectedAt = isset($data['collected_at']) && is_string($data['collected_at'])
                ? $data['collected_at']
                : now();

            $payment->update([
                'receipt_number' => $receiptNumber,
                'amount_collected' => $amount,
                'amount_remaining' => 0,
                'received_by' => trim((string) $data['received_by']),
                'collected_at' => $collectedAt,
                'note' => isset($data['note']) && is_string($data['note']) && trim($data['note']) !== ''
                    ? trim($data['note'])
                    : $payment->note,
                'status' => PaymentStatus::CASH_COLLECTED->value,
            ]);

            $locked->update(['payment_status' => PaymentStatus::CASH_COLLECTED->value]);
            $locked->refresh();

            $this->receipts->generate($payment->refresh());

            $this->auditLogs->log(
                $admin,
                'CASH_COLLECTED',
                'order',
                (string) $locked->id,
                ['payment_status' => PaymentStatus::CASH_COLLECTION_PENDING->value],
                [
                    'payment_status' => PaymentStatus::CASH_COLLECTED->value,
                    'amount_due' => $payment->amount_due,
                    'amount_collected' => $payment->amount_collected,
                    'amount_remaining' => $payment->amount_remaining,
                    'receipt_number' => $payment->receipt_number,
                    'received_by' => $payment->received_by,
                ],
                $ip,
            );

            return $this->freshDetail($locked);
        });
    }

    /**
     * Verify the collected cash and complete the delivered order.
     */
    public function confirm(
        Order $order,
        Admin $admin,
        ?string $note = null,
        ?string $ip = null,
    ): Order {
        return DB::transaction(function () use ($order, $admin, $note, $ip): Order {
            $locked = $this->lockOrder($order);
            $payment = $this->lockPayment($locked);
            $delivery = $this->delivery($locked);

            if (
                $locked->order_status !== OrderStatus::DELIVERED
                || $delivery?->delivery_status !== DeliveryStatus::DELIVERED
            ) {
                $this->reject(
                    'order',
                    'Payment can only be confirmed for an order delivered in full.',
                );
            }

            if ($payment->status !== PaymentStatus::CASH_COLLECTED) {
                $this->reject(
                    'payment',
                    'Record the full cash collection before confirming payment.',
                );
            }

            if (
                $payment->amount_collected !== $payment->amount_due
                || $payment->amount_remaining !== 0
            ) {
                $this->reject(
                    'payment',
                    'Payment cannot be confirmed until the full amount is collected.',
                );
            }

            if ($payment->receipt_number === null || trim($payment->receipt_number) === '') {
                $this->reject('payment', 'Payment cannot be confirmed without a receipt number.');
            }

            $this->transitionPayment($payment, $locked, PaymentStatus::PAYMENT_CONFIRMED);

            $this->transitionOrder(
                $locked,
                OrderStatus::COMPLETED,
                $admin,
                $note ?? 'Full COD payment verified. Order completed.',
            );

            // The receipt is generated when cash is collected, but regenerate
            // it here if the private file was removed from storage.
            $this->receipts->ensureGenerated($payment->refresh());

            $this->auditLogs->log(
                $admin,
                'CASH_PAYMENT_CONFIRMED',
                'order',
                (string) $locked->id,
                [
                    'payment_status' => PaymentStatus::CASH_COLLECTED->value,
                    'order_status' => OrderStatus::DELIVERED->value,
                ],
                [
                    'payment_status' => PaymentStatus::PAYMENT_CONFIRMED->value,
                    'order_status' => OrderStatus::COMPLETED->value,
                    'receipt_number' => $payment->receipt_number,
                    'note' => $note,
                ],
                $ip,
            );

            return $this->freshDetail($locked);
        });
    }

    /**
     * The customer refused to pay at the door.
     *
     * The payment status, delivery outcome and responsible person are all
     * recorded so the order history explains what happened.
     *
     * @param  array<string, mixed>  $data
     */
    public function refuse(
        Order $order,
        Admin $admin,
        array $data,
        ?string $ip = null,
    ): Order {
        return DB::transaction(function () use ($order, $admin, $data, $ip): Order {
            $locked = $this->lockOrder($order);
            $payment = $this->lockPayment($locked);
            $delivery = $this->delivery($locked);

            if (
                $locked->order_status !== OrderStatus::OUT_FOR_DELIVERY
                || $delivery?->delivery_status !== DeliveryStatus::OUT_FOR_DELIVERY
            ) {
                $this->reject(
                    'order',
                    'A payment refusal can only be recorded while the order is out for delivery.',
                );
            }

            if (in_array($payment->status, [PaymentStatus::CASH_COLLECTED, PaymentStatus::PAYMENT_CONFIRMED], true)) {
                $this->reject('payment', 'Cash has already been collected for this order.');
            }

            if ($payment->status === PaymentStatus::NOT_PAID) {
                $this->transitionPayment($payment, $locked, PaymentStatus::CASH_COLLECTION_PENDING);
            }

            if ($payment->status !== PaymentStatus::CASH_COLLECTION_PENDING) {
                $this->reject('payment', 'The payment is not pending collection.');
            }

            $outcome = (string) $data['delivery_outcome'];
            $responsible = trim((string) $data['responsible_person']);
            $note = trim((string) $data['note']);

            $this->transitionPayment($payment, $locked, PaymentStatus::CUSTOMER_REFUSED_TO_PAY);
            $payment->update([
                'note' => $note.' Handled by '.$responsible.'.',
            ]);

            $deliveryStatus = $outcome === OrderStatus::RETURNED->value
                ? DeliveryStatus::RETURNED
                : DeliveryStatus::DELIVERY_FAILED;
            $orderStatus = $outcome === OrderStatus::RETURNED->value
                ? OrderStatus::RETURNED
                : OrderStatus::DELIVERY_FAILED;

            $this->transitionDelivery($locked, $delivery, $deliveryStatus);
            $this->transitionOrder(
                $locked,
                $orderStatus,
                $admin,
                sprintf(
                    'Customer refused to pay. Delivery outcome: %s. Handled by %s. %s',
                    $outcome,
                    $responsible,
                    $note,
                ),
            );

            $this->auditLogs->log(
                $admin,
                'CUSTOMER_REFUSED_PAYMENT',
                'order',
                (string) $locked->id,
                [
                    'payment_status' => PaymentStatus::CASH_COLLECTION_PENDING->value,
                    'order_status' => OrderStatus::OUT_FOR_DELIVERY->value,
                    'delivery_status' => DeliveryStatus::OUT_FOR_DELIVERY->value,
                ],
                [
                    'payment_status' => PaymentStatus::CUSTOMER_REFUSED_TO_PAY->value,
                    'order_status' => $orderStatus->value,
                    'delivery_status' => $deliveryStatus->value,
                    'delivery_outcome' => $outcome,
                    'responsible_person' => $responsible,
                    'note' => $note,
                ],
                $ip,
            );

            return $this->freshDetail($locked);
        });
    }

    /**
     * Resolve the private receipt path and download name for an authorized
     * admin or owning customer. Regenerates a missing file on demand.
     *
     * @return array{path: string, file_name: string}|null
     */
    public function receipt(Order $order): ?array
    {
        $payment = CashPayment::query()->where('order_id', $order->id)->first();

        if ($payment === null || ! $this->receipts->isAvailable($payment)) {
            return null;
        }

        return [
            'path' => $this->receipts->ensureGenerated($payment),
            'file_name' => $this->receipts->fileName($payment),
        ];
    }

    private function lockOrder(Order $order): Order
    {
        return Order::query()->whereKey($order->id)->lockForUpdate()->firstOrFail();
    }

    private function lockPayment(Order $order): CashPayment
    {
        $payment = CashPayment::query()
            ->where('order_id', $order->id)
            ->lockForUpdate()
            ->first();

        if ($payment === null) {
            $this->reject('payment', 'This order has no COD payment record.');
        }

        return $payment;
    }

    private function delivery(Order $order): ?Delivery
    {
        return Delivery::query()->where('order_id', $order->id)->first();
    }

    private function transitionPayment(
        CashPayment $payment,
        Order $order,
        PaymentStatus $target,
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
        $payment->refresh();
        $order->refresh();
    }

    private function transitionDelivery(
        Order $order,
        Delivery $delivery,
        DeliveryStatus $target,
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
        $delivery->refresh();
        $order->refresh();
    }

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
     * Reload the relations the order detail returns.
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
    private function reject(string $field, string $message): never
    {
        throw ValidationException::withMessages([
            $field => [$message],
        ]);
    }
}
