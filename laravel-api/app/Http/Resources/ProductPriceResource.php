<?php

namespace App\Http\Resources;

use App\Models\ProductPrice;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin ProductPrice
 */
class ProductPriceResource extends JsonResource
{
    /**
     * Transform the product price into an API representation.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'retail_price' => $this->retail_price,
            'wholesale_price' => $this->wholesale_price,
            'discount_price' => $this->discount_price,
            'minimum_order_quantity' => $this->minimum_order_quantity,
            'price_valid_until' => $this->price_valid_until?->toDateString(),
            'last_updated_at' => $this->last_updated_at?->toIso8601String(),
        ];
    }
}
