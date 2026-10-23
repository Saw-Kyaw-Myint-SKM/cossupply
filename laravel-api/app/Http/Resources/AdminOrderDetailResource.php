<?php

namespace App\Http\Resources;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderStatusHistory;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Admin order detail: header snapshots, immutable items, the full delivery,
 * the COD payment document, the status trail and the source quotation
 * request. `available_statuses` is restricted to the Task 09 supplier
 * confirmation targets.
 *
 * @mixin Order
 */
class AdminOrderDetailResource extends JsonResource
{
    /**
     * @param  list<string>  $availableStatuses
     */
    public function __construct(Order $resource, private readonly array $availableStatuses)
    {
        parent::__construct($resource);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'order_number' => $this->order_number,
            'quotation_id' => $this->quotation_id,
            'quotation_number' => $this->whenLoaded(
                'quotation',
                fn (): ?string => $this->quotation?->quotation_number,
            ),
            'quotation_request_id' => $this->quotation_request_id,
            'customer_id' => $this->customer_id,
            'customer_name' => $this->customer_name,
            'company_name' => $this->company_name,
            'phone' => $this->phone,
            'email' => $this->email,
            'delivery_address' => $this->delivery_address,
            'city' => $this->city,
            'township' => $this->township,
            'landmark' => $this->landmark,
            'subtotal' => $this->subtotal,
            'discount' => $this->discount,
            'delivery_fee' => $this->delivery_fee,
            'service_fee_percentage' => $this->service_fee_percentage,
            'service_fee' => $this->service_fee,
            'total_amount' => $this->total_amount,
            'payment_method' => $this->payment_method,
            'payment_status' => $this->payment_status->value,
            'order_status' => $this->order_status->value,
            'delivery_status' => $this->delivery_status->value,
            'customer_note' => $this->customer_note,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
            'items' => $this->whenLoaded('items', fn (): array => $this->items
                ->map(fn (OrderItem $item): array => $this->itemPayload($item))
                ->all()),
            'delivery' => $this->whenLoaded('deliveries', fn (): ?array => $this->deliveryPayload()),
            'cash_payment' => $this->whenLoaded('cashPayment', fn (): ?array => $this->cashPaymentPayload()),
            'status_histories' => $this->whenLoaded('statusHistories', fn (): array => $this->statusHistories
                ->map(fn (OrderStatusHistory $history): array => [
                    'old_status' => $history->old_status,
                    'new_status' => $history->new_status,
                    'changed_by_type' => $history->changed_by_type,
                    'changed_by_id' => $history->changed_by_id,
                    'note' => $history->note,
                    'created_at' => $history->created_at?->toIso8601String(),
                ])
                ->all()),
            'quotation_request' => $this->whenLoaded('quotationRequest', fn (): ?array => $this->quotationRequest === null ? null : [
                'id' => $this->quotationRequest->id,
                'quotation_number' => $this->quotationRequest->quotation_number,
                'status' => $this->quotationRequest->status->value,
            ]),
            'available_statuses' => $this->availableStatuses,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function itemPayload(OrderItem $item): array
    {
        $supplier = $item->relationLoaded('supplier') ? $item->supplier : null;

        return [
            'id' => $item->id,
            'product_id' => $item->product_id,
            'supplier_id' => $item->supplier_id,
            'product_name_snapshot' => $item->product_name_snapshot,
            'sku_snapshot' => $item->sku_snapshot,
            'specification_snapshot' => $item->specification_snapshot,
            'quantity' => $item->quantity,
            'unit_price' => $item->unit_price,
            'discount' => $item->discount,
            'line_total' => $item->line_total,
            'supplier' => $supplier === null ? null : [
                'id' => $supplier->id,
                'shop_name' => $supplier->shop_name,
                'contact_person' => $supplier->contact_person,
                'phone' => $supplier->phone,
            ],
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function deliveryPayload(): ?array
    {
        $delivery = $this->deliveries->first();

        if ($delivery === null) {
            return null;
        }

        return [
            'id' => $delivery->id,
            'supplier_id' => $delivery->supplier_id,
            'delivery_contact_name' => $delivery->delivery_contact_name,
            'delivery_phone' => $delivery->delivery_phone,
            'delivery_address' => $delivery->delivery_address,
            'city' => $delivery->city,
            'township' => $delivery->township,
            'landmark' => $delivery->landmark,
            'delivery_fee' => $delivery->delivery_fee,
            'delivery_partner' => $delivery->delivery_partner,
            'tracking_number' => $delivery->tracking_number,
            'estimated_delivery_date' => $delivery->estimated_delivery_date?->toDateString(),
            'shipped_at' => $delivery->shipped_at?->toIso8601String(),
            'delivered_at' => $delivery->delivered_at?->toIso8601String(),
            'received_by' => $delivery->received_by,
            'customer_note' => $delivery->customer_note,
            'delivery_status' => $delivery->delivery_status->value,
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function cashPaymentPayload(): ?array
    {
        $payment = $this->cashPayment;

        if ($payment === null) {
            return null;
        }

        return [
            'id' => $payment->id,
            'receipt_number' => $payment->receipt_number,
            'amount_due' => $payment->amount_due,
            'amount_collected' => $payment->amount_collected,
            'amount_remaining' => $payment->amount_remaining,
            'status' => $payment->status->value,
            'collected_at' => $payment->collected_at?->toIso8601String(),
        ];
    }
}
