<?php

namespace App\Services\Order;

use App\Enums\DeliveryStatus;
use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Enums\QuotationVersionStatus;
use App\Models\CashPayment;
use App\Models\Customer;
use App\Models\Delivery;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderStatusHistory;
use App\Models\Quotation;
use App\Models\QuotationRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Converts an accepted quotation version into exactly one order
 * (LogicFlow §9).
 *
 * The caller owns the database transaction and the quotation row lock:
 * `CustomerQuotationService::accept()` locks the version, moves it to
 * `ACCEPTED`, then calls this service. Every row — order, immutable items,
 * delivery, COD payment and the initial status history — is written inside
 * that single transaction, so any failure rolls all of it back.
 */
class OrderConversionService
{
    public function __construct(
        private readonly OrderNumberGenerator $numbers,
    ) {}

    /**
     * Create the order snapshot for an accepted quotation version.
     *
     * Order values come from the accepted quotation version and the
     * original request's contact/delivery snapshots. Items are copied only
     * from `quotation_version_items`, never from the request items.
     */
    public function convert(
        Customer $customer,
        Quotation $quotation,
        QuotationRequest $request,
    ): Order {
        if ($quotation->status !== QuotationVersionStatus::ACCEPTED) {
            throw ValidationException::withMessages([
                'quotation' => ['Only an accepted quotation version can be converted to an order.'],
            ]);
        }

        if ($quotation->quotation_request_id !== $request->id) {
            throw ValidationException::withMessages([
                'quotation' => ['The quotation does not belong to this request.'],
            ]);
        }

        if ($request->customer_id !== $customer->id) {
            throw ValidationException::withMessages([
                'quotation' => ['Quotation not found.'],
            ]);
        }

        if (Order::query()->where('quotation_id', $quotation->id)->exists()) {
            throw ValidationException::withMessages([
                'quotation' => ['An order already exists for this quotation version.'],
            ]);
        }

        $items = $quotation->items()->orderBy('id')->get();

        if ($items->isEmpty()) {
            throw ValidationException::withMessages([
                'quotation' => ['The accepted quotation has no items to order.'],
            ]);
        }

        // order_number is NOT NULL, so the row is first persisted with a
        // unique placeholder and immediately re-keyed to its id-derived
        // number inside the same transaction (same pattern as quotation
        // requests).
        $order = Order::create([
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

        $order->update(['order_number' => $this->numbers->orderNumber($order)]);

        foreach ($items as $item) {
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

        // MVP has one full delivery only. A single supplier can be attached
        // when every accepted line belongs to the same supplier; otherwise
        // delivery assignment is left to the delivery workflow (Task 10).
        $supplierIds = $items->pluck('supplier_id')->filter()->unique();

        $delivery = Delivery::create([
            'order_id' => $order->id,
            'supplier_id' => $supplierIds->count() === 1 ? $supplierIds->first() : null,
            'delivery_contact_name' => $request->customer_name,
            'delivery_phone' => $request->phone,
            'delivery_address' => $request->delivery_address,
            'city' => $request->city,
            'township' => $request->township,
            'landmark' => $request->landmark,
            'delivery_fee' => $quotation->delivery_fee,
            'estimated_delivery_date' => $items
                ->pluck('delivery_date')
                ->filter()
                ->sort()
                ->first(),
            'customer_note' => $request->customer_note,
            'delivery_status' => DeliveryStatus::NOT_ASSIGNED->value,
        ]);

        CashPayment::create([
            'order_id' => $order->id,
            'delivery_id' => $delivery->id,
            'receipt_number' => $this->numbers->receiptNumber($order),
            'amount_due' => $quotation->total_amount,
            'amount_collected' => 0,
            'amount_remaining' => $quotation->total_amount,
            'customer_name' => $request->customer_name,
            'status' => PaymentStatus::NOT_PAID->value,
        ]);

        OrderStatusHistory::create([
            'order_id' => $order->id,
            'old_status' => null,
            'new_status' => OrderStatus::SUPPLIER_CONFIRMATION_REQUIRED->value,
            'changed_by_type' => 'SYSTEM',
            'changed_by_id' => null,
            'note' => sprintf(
                'Order created from accepted quotation %s version %d.',
                $quotation->quotation_number,
                $quotation->version,
            ),
        ]);

        return $order->refresh()->load([
            'quotation',
            'items.supplier',
            'deliveries',
            'cashPayment',
            'statusHistories',
        ]);
    }
}
