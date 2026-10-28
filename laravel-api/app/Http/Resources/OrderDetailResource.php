<?php

namespace App\Http\Resources;

use App\Models\Admin;
use App\Models\Order;
use App\Models\OrderItem;
use Illuminate\Http\Request;

/**
 * Full order view: frozen header snapshots, immutable item lines, the
 * delivery and COD payment records, the status trail and the source
 * quotation version.
 *
 * Supplier contact details are added only for authenticated admins, because
 * they are the ones who coordinate confirmation over Viber.
 *
 * @mixin Order
 */
class OrderDetailResource extends OrderSummaryResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return array_merge(parent::toArray($request), [
            'items' => OrderItemResource::collection($this->whenLoaded('items')),
            'delivery' => $this->relationLoaded('deliveries') && $this->deliveries->isNotEmpty()
                ? (new OrderDeliveryResource($this->deliveries->first()))->resolve($request)
                : null,
            'cash_payment' => $this->relationLoaded('cashPayment') && $this->cashPayment !== null
                ? (new OrderCashPaymentResource($this->cashPayment))->resolve($request)
                : null,
            'status_histories' => OrderStatusHistoryResource::collection(
                $this->whenLoaded('statusHistories'),
            ),
            'quotation' => $this->relationLoaded('quotation') && $this->quotation !== null
                ? [
                    'id' => $this->quotation->id,
                    'quotation_number' => $this->quotation->quotation_number,
                    'version' => $this->quotation->version,
                    'status' => $this->quotation->status->value,
                    'accepted_at' => $this->quotation->accepted_at?->toIso8601String(),
                    'valid_until' => $this->quotation->valid_until?->toDateString(),
                ]
                : null,
            'suppliers' => $this->relationLoaded('items') && $request->user() instanceof Admin
                ? $this->supplierGroups($request)
                : [],
        ]);
    }

    /**
     * Group the ordered lines by supplier with the contact information the
     * admin needs before calling or messaging them.
     *
     * @return list<array<string, mixed>>
     */
    private function supplierGroups(Request $request): array
    {
        return $this->items
            ->groupBy('supplier_id')
            ->map(function ($items, $supplierId) use ($request): array {
                /** @var OrderItem $first */
                $first = $items->first();
                $supplier = $first->relationLoaded('supplier') ? $first->supplier : null;

                return [
                    'supplier' => [
                        'id' => (int) $supplierId,
                        'shop_name' => $supplier?->shop_name,
                        'contact_person' => $supplier?->contact_person,
                        'phone' => $supplier?->phone,
                        'viber_phone' => $supplier?->viber_phone,
                        'email' => $supplier?->email,
                        'delivery_time' => $supplier?->delivery_time,
                        'warranty_policy' => $supplier?->warranty_policy,
                    ],
                    'items' => $items
                        ->map(fn (OrderItem $item): array => (new OrderItemResource($item))->resolve($request))
                        ->values()
                        ->all(),
                ];
            })
            ->values()
            ->all();
    }
}
