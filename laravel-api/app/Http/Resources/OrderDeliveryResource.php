<?php

namespace App\Http\Resources;

use App\Models\Delivery;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * The single full-delivery record created with an order (MVP).
 *
 * @mixin Delivery
 */
class OrderDeliveryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'supplier_id' => $this->supplier_id,
            'delivery_contact_name' => $this->delivery_contact_name,
            'delivery_phone' => $this->delivery_phone,
            'delivery_address' => $this->delivery_address,
            'city' => $this->city,
            'township' => $this->township,
            'landmark' => $this->landmark,
            'delivery_fee' => $this->delivery_fee,
            'delivery_partner' => $this->delivery_partner,
            'tracking_number' => $this->tracking_number,
            'estimated_delivery_date' => $this->estimated_delivery_date?->toDateString(),
            'shipped_at' => $this->shipped_at?->toIso8601String(),
            'delivered_at' => $this->delivered_at?->toIso8601String(),
            'received_by' => $this->received_by,
            'customer_note' => $this->customer_note,
            'delivery_status' => $this->delivery_status->value,
        ];
    }
}
