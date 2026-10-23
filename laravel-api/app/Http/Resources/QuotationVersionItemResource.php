<?php

namespace App\Http\Resources;

use App\Models\QuotationVersionItem;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Final quotation version item snapshot.
 *
 * @mixin QuotationVersionItem
 */
class QuotationVersionItemResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'product_id' => $this->product_id,
            'supplier_id' => $this->supplier_id,
            'product_name_snapshot' => $this->product_name_snapshot,
            'sku_snapshot' => $this->sku_snapshot,
            'specification_snapshot' => $this->specification_snapshot,
            'quantity' => $this->quantity,
            'unit_price' => $this->unit_price,
            'discount' => $this->discount,
            'line_total' => $this->line_total,
            'delivery_date' => $this->delivery_date?->toDateString(),
            'warranty_note' => $this->warranty_note,
            'supplier_note' => $this->supplier_note,
            'supplier' => $this->whenLoaded('supplier', fn (): ?array => $this->supplier !== null ? [
                'id' => $this->supplier->id,
                'shop_name' => $this->supplier->shop_name,
            ] : null),
        ];
    }
}
