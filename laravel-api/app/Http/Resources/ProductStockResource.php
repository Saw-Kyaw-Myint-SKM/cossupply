<?php

namespace App\Http\Resources;

use App\Models\ProductStock;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin ProductStock
 */
class ProductStockResource extends JsonResource
{
    /**
     * Transform the product stock into an API representation.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'stock_quantity' => $this->stock_quantity,
            'stock_status' => $this->stock_status->value,
            'last_confirmed_at' => $this->last_confirmed_at?->toIso8601String(),
            'supplier_note' => $this->supplier_note,
        ];
    }
}
