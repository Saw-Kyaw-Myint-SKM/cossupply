<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\ExposesPublicMedia;
use App\Models\QuotationVersionItem;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Final quotation version item snapshot.
 *
 * The image is read from the linked product because images are not stored in
 * the line snapshot; `photo` / `photo_url` are omitted unless the product
 * relation was eager-loaded.
 *
 * @mixin QuotationVersionItem
 */
class QuotationVersionItemResource extends JsonResource
{
    use ExposesPublicMedia;

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
            'photo' => $this->whenLoaded('product', fn (): ?string => $this->product?->photo),
            'photo_url' => $this->whenLoaded(
                'product',
                fn (): ?string => $this->publicMediaUrl($this->product?->photo),
            ),
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
