<?php

namespace App\Http\Resources;

use App\Models\ProductStock;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Public stock snapshot for a product.
 *
 * The supplier note is internal coordination text and is never exposed.
 *
 * @mixin ProductStock
 */
class PublicProductStockResource extends JsonResource
{
    /**
     * Transform the product stock into an API representation.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'stock_quantity' => $this->stock_quantity,
            'stock_status' => $this->stock_status->value,
            'last_confirmed_at' => $this->last_confirmed_at?->toIso8601String(),
        ];
    }
}
