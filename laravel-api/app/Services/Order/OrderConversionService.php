<?php

namespace App\Services\Order;

use App\Enums\DeliveryStatus;
use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Exceptions\ResourceConflictException;
use App\Models\CashPayment;
use App\Models\Customer;
use App\Models\Delivery;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderStatusHistory;
use App\Models\Quotation;
use App\Models\QuotationRequest;
use App\Models\QuotationVersionItem;
use Illuminate\Database\QueryException;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * Converts an accepted quotation version into exactly one order
 * (LogicFlow §9).
 *
 * The caller owns the database transaction and holds the quotation row
 * lock. This service only writes rows: order, immutable order item
 * snapshots (copied from `quotation_version_items`), one full delivery,
 * one COD cash payment and the opening status history row.
 *
 * `orders.quotation_id` is unique in the database; that index is the final
 * guard against two concurrent accepts both passing the pre-check.
 */
class OrderConversionService
{
    public function __construct(
        private readonly OrderNumberGenerator $orderNumbers,
        private readonly ReceiptNumberGenerator $receiptNumbers,
    ) {}

    /**
     * Guard against converting the same quotation version twice.
     *
     * @throws ResourceConflictException
     */
    public function assertQuotationHasNoOrder(Quotation $quotation): void
    {
        $exists = Order::query()
            ->where('quotation_id', $quotation->id)
            ->exists();

        if ($exists) {
            throw new ResourceConflictException('An order already exists for this quotation.');
        }
    }

    /**
     * Create the order and its dependent snapshots.
     *
     * Must be called inside the accept transaction, after ownership and
     * quotation eligibility have been checked.
     *
     * @throws ResourceConflictException
     */
    public function createFromQuotation(
        Customer $customer,
        Quotation $quotation,
        QuotationRequest $request,
    ): Order {
        $this->assertQuotationHasNoOrder($quotation);

        $versionItems = QuotationVersionItem::query()
            ->where('quotation_id', $quotation->id)
            ->orderBy('id')
            ->get();

        $order = $this->createOrder($customer, $quotation, $request);

        foreach ($versionItems as $item) {
            OrderItem::create([
                'order_id' => $order->id,
                'product_id' => $item->product_id,
                'supplier_id' => $item->supplier_id,
                'product_name_snapshot' => $item->product_name_snapshot,
                'sku_snapshot' => $item->sku_snapshot,
                'specification_snapshot' => $item->specification_snapshot,
                'quantity' => $item->quantity,
                'unit_price' => $item->unit_price,
                'discount' => $item->discount,
                'line_total' => $item->line_total,
            ]);
        }

        $delivery = Delivery::create([
            'order_id' => $order->id,
            'supplier_id' => $this->deliverySupplierId($versionItems),
            'delivery_contact_name' => $request->customer_name,
            'delivery_phone' => $request->phone,
            'delivery_address' => $request->delivery_address,
            'city' => $request->city,
            'township' => $request->township,
            'landmark' => $request->landmark,
            'delivery_fee' => $quotation->delivery_fee,
            'customer_note' => $request->customer_note,
            'delivery_status' => DeliveryStatus::NOT_ASSIGNED->value,
        ]);

        $payment = CashPayment::create([
            // receipt_number is NOT NULL, so the row is first persisted
            // with a unique placeholder and immediately re-keyed to the
            // id-derived number inside the same transaction.
            'receipt_number' => Str::uuid()->toString(),
            'order_id' => $order->id,
            'delivery_id' => $delivery->id,
            'amount_due' => $order->total_amount,
            'amount_collected' => 0,
            'amount_remaining' => $order->total_amount,
            'customer_name' => $request->customer_name,
            'status' => PaymentStatus::NOT_PAID->value,
        ]);

        $payment->update([
            'receipt_number' => $this->receiptNumbers->generate($payment),
        ]);

        OrderStatusHistory::create([
            'order_id' => $order->id,
            'old_status' => null,
            'new_status' => OrderStatus::SUPPLIER_CONFIRMATION_REQUIRED->value,
            'changed_by_type' => 'CUSTOMER',
            'changed_by_id' => $customer->id,
            'note' => sprintf(
                'Order created from accepted quotation %s v%d.',
                $request->quotation_number,
                $quotation->version,
            ),
        ]);

        return $order->refresh();
    }

    /**
     * Persist the order header and re-key its id-derived number.
     *
     * @throws ResourceConflictException
     */
    private function createOrder(
        Customer $customer,
        Quotation $quotation,
        QuotationRequest $request,
    ): Order {
        try {
            $order = Order::create([
                // order_number is NOT NULL, so the row is first persisted
                // with a unique placeholder and immediately re-keyed.
                'order_number' => Str::uuid()->toString(),
                'quotation_id' => $quotation->id,
                'quotation_request_id' => $request->id,
                'customer_id' => $customer->id,
                'customer_name' => $request->customer_name,
                'company_name' => $request->company_name,
                'phone' => $request->phone,
                'email' => $request->email,
                'delivery_address' => $request->delivery_address,
                'city' => $request->city,
                'township' => $request->township,
                'landmark' => $request->landmark,
                'subtotal' => $quotation->subtotal,
                'discount' => $quotation->discount,
                'delivery_fee' => $quotation->delivery_fee,
                'service_fee_percentage' => $quotation->service_fee_percentage,
                'service_fee' => $quotation->service_fee,
                'total_amount' => $quotation->total_amount,
                'payment_method' => 'CASH_ON_DELIVERY',
                'payment_status' => PaymentStatus::NOT_PAID->value,
                'order_status' => OrderStatus::SUPPLIER_CONFIRMATION_REQUIRED->value,
                'delivery_status' => DeliveryStatus::NOT_ASSIGNED->value,
                'customer_note' => $request->customer_note,
            ]);
        } catch (QueryException $exception) {
            if ($this->isDuplicateKey($exception)) {
                throw new ResourceConflictException('An order already exists for this quotation.');
            }

            throw $exception;
        }

        $order->update([
            'order_number' => $this->orderNumbers->generate($order),
        ]);

        return $order;
    }

    /**
     * Use the single shared supplier when every version item has the same
     * supplier; otherwise leave the delivery supplier unassigned.
     *
     * @param  Collection<int, QuotationVersionItem>  $items
     */
    private function deliverySupplierId(Collection $items): ?int
    {
        $supplierIds = $items->pluck('supplier_id')->unique();

        if ($supplierIds->count() !== 1) {
            return null;
        }

        $supplierId = $supplierIds->first();

        return $supplierId !== null ? (int) $supplierId : null;
    }

    /**
     * Whether the exception is a uniqueness violation (MySQL/SQLite).
     */
    private function isDuplicateKey(QueryException $exception): bool
    {
        $driverCode = (int) ($exception->errorInfo[1] ?? 0);
        $message = strtolower($exception->getMessage());

        return $driverCode === 1062
            || str_contains($message, 'duplicate entry')
            || str_contains($message, 'duplicate key')
            || str_contains($message, 'unique constraint');
    }
}
