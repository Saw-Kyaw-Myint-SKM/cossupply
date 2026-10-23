<?php

namespace App\Http\Resources;

use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Admin order queue row summary.
 *
 * @mixin Order
 */
class AdminOrderResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'order_number' => $this->order_number,
            'quotation_number' => $this->whenLoaded(
                'quotation',
                fn (): ?string => $this->quotation?->quotation_number,
            ),
            'customer_name' => $this->customer_name,
            'phone' => $this->phone,
            'order_status' => $this->order_status->value,
            'payment_status' => $this->payment_status->value,
            'delivery_status' => $this->delivery_status->value,
            'total_amount' => $this->total_amount,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
