<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\ExposesPublicMedia;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Product
 */
class ProductResource extends JsonResource
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
                fn ($category) => $category !== null ? new CategoryResource($category) : null,
            ),
            'supplier' => $this->whenLoaded(
                'supplier',
                fn ($supplier) => $supplier !== null ? new SupplierResource($supplier) : null,
            ),
            'price' => $this->whenLoaded('prices', function ($prices) {
                $price = $prices->first();

                return $price !== null ? new ProductPriceResource($price) : null;
            }),
            'stock' => $this->whenLoaded(
                'stock',
                fn ($stock) => $stock !== null ? new ProductStockResource($stock) : null,
            ),
            'created_by_admin_id' => $this->created_by_admin_id,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
