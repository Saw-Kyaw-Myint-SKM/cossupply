<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\ExposesPublicMedia;
use App\Models\ProductVariant;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Guest-facing variant representation. Wholesale price, supplier note and
 * admin audit fields are deliberately withheld.
 *
 * @mixin ProductVariant
 */
class PublicProductVariantResource extends JsonResource
{
    use ExposesPublicMedia;

    /**
     * Transform the variant into a public API representation.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        // A variant without its own photo falls back to the product photo.
        $photo = $this->photo;

        if (($photo === null || trim((string) $photo) === '') && $this->relationLoaded('product')) {
            $photo = $this->product?->photo;
        }

        return [
            'id' => $this->id,
            'name' => $this->name,
            'variant_attributes' => $this->variant_attributes ?? [],
            'slug' => $this->slug,
            'sku' => $this->sku,
            'photo' => $this->photo,
            'photo_url' => $this->publicMediaUrl($photo),
            'retail_price' => $this->retail_price,
            'discount_price' => $this->discount_price,
            'minimum_order_quantity' => $this->minimum_order_quantity,
            'price_valid_until' => $this->price_valid_until?->toDateString(),
            'last_updated_at' => $this->price_updated_at?->toIso8601String(),
            'stock_quantity' => $this->stock_quantity,
            'stock_status' => $this->stock_status->value,
            'last_confirmed_at' => $this->stock_confirmed_at?->toIso8601String(),
            'sort_order' => $this->sort_order,
        ];
    }
}
