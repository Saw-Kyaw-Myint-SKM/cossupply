<?php

namespace App\Http\Resources;

use App\Models\QuotationItem;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Original quotation request item snapshot.
 *
 * The snapshot was frozen at request time; nothing here reflects later
 * product, supplier, price or stock changes.
 *
 * @mixin QuotationItem
 */
class QuotationItemResource extends JsonResource
{
    /**
     * Transform the item snapshot into an API representation.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'product_id' => $this->product_id,
            'supplier_id' => $this->supplier_id,
            'product_name_snapshot' => $this->product_name_snapshot,
            'specification_snapshot' => $this->specification_snapshot,
            'quantity' => $this->quantity,
            'display_price' => $this->display_price,
            'stock_status' => $this->stock_status?->value,
            'sku' => $this->whenLoaded('product', fn () => $this->product?->sku),
            'supplier' => $this->whenLoaded(
                'supplier',
                fn () => $this->supplier !== null ? [
                    'id' => $this->supplier->id,
                    'shop_name' => $this->supplier->shop_name,
                    'contact_person' => $this->supplier->contact_person,
                    'phone' => $this->supplier->phone,
                    'viber_phone' => $this->supplier->viber_phone,
                    'email' => $this->supplier->email,
                ] : null,
            ),
        ];
    }
}
