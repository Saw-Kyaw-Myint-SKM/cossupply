<?php

namespace App\Http\Resources;

use App\Models\ProductPrice;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Public price snapshot for a product.
 *
 * The wholesale tier is intentionally omitted: it is internal pricing and is
 * never shown on the public catalog.
 *
 * @mixin ProductPrice
 */
class PublicProductPriceResource extends JsonResource
{
    /**
     * Transform the product price into an API representation.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'retail_price' => $this->retail_price,
            'discount_price' => $this->discount_price,
            'minimum_order_quantity' => $this->minimum_order_quantity,
            'price_valid_until' => $this->price_valid_until?->toDateString(),
            'last_updated_at' => $this->last_updated_at?->toIso8601String(),
        ];
    }
}
