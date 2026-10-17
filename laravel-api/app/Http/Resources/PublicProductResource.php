<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\ExposesPublicMedia;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Public product representation for guest catalog browsing.
 *
 * Internal fields are deliberately withheld: `wholesale_price`,
 * `supplier_note`, `created_by_admin_id` and the raw timestamps.
 *
 * @mixin Product
 */
class PublicProductResource extends JsonResource
{
    use ExposesPublicMedia;

    /**
     * Transform the product into an API representation.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'supplier_id' => $this->supplier_id,
            'category_id' => $this->category_id,
            'name_mm' => $this->name_mm,
            'name_en' => $this->name_en,
            'slug' => $this->slug,
            'sku' => $this->sku,
            'brand' => $this->brand,
            'model' => $this->model,
            'description' => $this->description,
            'specification' => $this->specification,
            'size' => $this->size,
            'color' => $this->color,
            'unit' => $this->unit,
            'package_size' => $this->package_size,
            'photo' => $this->photo,
            'photo_url' => $this->publicMediaUrl($this->photo),
            'status' => $this->status->value,
            'category' => $this->whenLoaded(
                'category',
                fn ($category) => $category !== null ? new PublicCategoryResource($category) : null,
            ),
            'supplier' => $this->whenLoaded(
                'supplier',
                fn ($supplier) => $supplier !== null ? new PublicSupplierResource($supplier) : null,
            ),
            'price' => $this->whenLoaded('prices', function ($prices) {
                $price = $prices->first();

                return $price !== null ? new PublicProductPriceResource($price) : null;
            }),
            'stock' => $this->whenLoaded(
                'stock',
                fn ($stock) => $stock !== null ? new PublicProductStockResource($stock) : null,
            ),
        ];
    }
}
