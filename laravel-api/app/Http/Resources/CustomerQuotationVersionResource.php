<?php

namespace App\Http\Resources;

use App\Enums\QuotationVersionStatus;
use App\Models\Quotation;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A quotation version as seen by the customer who owns the request.
 *
 * The version-level `delivery_date` is derived from the item snapshots
 * (the latest item delivery date), because the schema stores delivery
 * dates per line only.
 *
 * @mixin Quotation
 */
class CustomerQuotationVersionResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'version' => $this->version,
            'status' => $this->status->value,
            'is_current' => $this->is_current,
            'is_expired' => $this->status === QuotationVersionStatus::EXPIRED || $this->isExpired(),
            'valid_until' => $this->valid_until?->toDateString(),
            'delivery_date' => $this->deliveryDate(),
            'subtotal' => $this->subtotal,
            'discount_amount' => $this->discount,
            'delivery_fee' => $this->delivery_fee,
            'service_fee_percentage' => $this->service_fee_percentage,
            'service_fee' => $this->service_fee,
            'total_amount' => $this->total_amount,
            'cod_terms' => $this->payment_terms,
            'admin_note' => $this->admin_note,
            'sent_at' => $this->sent_at?->toIso8601String(),
            'items' => QuotationVersionItemResource::collection($this->whenLoaded('items')),
            'actions' => QuotationActionResource::collection($this->whenLoaded('actions')),
        ];
    }

    /**
     * Latest item delivery date for the whole version.
     */
    private function deliveryDate(): ?string
    {
        if (! $this->relationLoaded('items')) {
            return null;
        }

        return $this->items
            ->pluck('delivery_date')
            ->filter()
            ->max()
            ?->toDateString();
    }
}
