<?php

namespace App\Http\Resources;

use App\Models\QuotationRequest;
use App\Models\SupplierCommunication;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Admin view of a customer quotation request.
 *
 * Detail responses additionally expose supplier groups, the append-only
 * communication log, and every quotation version (list responses load none
 * of those relations).
 *
 * @mixin QuotationRequest
 */
class AdminQuotationRequestResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'quotation_number' => $this->quotation_number,
            'customer_id' => $this->customer_id,
            'customer_name' => $this->customer_name,
            'company_name' => $this->company_name,
            'phone' => $this->phone,
            'email' => $this->email,
            'delivery_address' => $this->delivery_address,
            'city' => $this->city,
            'township' => $this->township,
            'landmark' => $this->landmark,
            'required_delivery_date' => $this->required_delivery_date?->toDateString(),
            'customer_note' => $this->customer_note,
            'status' => $this->status->value,
            'item_count' => $this->whenCounted('items'),
            'assigned_admin' => $this->whenLoaded('assignedAdmin', fn (): ?array => $this->assignedAdmin !== null ? [
                'id' => $this->assignedAdmin->id,
                'name' => $this->assignedAdmin->name,
            ] : null),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
            'items' => QuotationItemResource::collection($this->whenLoaded('items')),
            'suppliers' => $this->whenLoaded('items', fn (): array => $this->supplierGroups($request)),
            'communications' => SupplierCommunicationResource::collection($this->whenLoaded('communications')),
            'quotations' => QuotationVersionResource::collection($this->whenLoaded('quotations')),
            'current_quotation' => $this->whenLoaded('quotations', function () use ($request): ?array {
                $current = $this->quotations->firstWhere('is_current', true);

                return $current !== null
                    ? (new QuotationVersionResource($current))->resolve($request)
                    : null;
            }),
        ];
    }

    /**
     * Group the original request items by supplier, together with that
     * supplier's communication log entries.
     *
     * @return list<array<string, mixed>>
     */
    private function supplierGroups(Request $request): array
    {
        $communications = $this->relationLoaded('communications') ? $this->communications : collect();

        return $this->items
            ->groupBy('supplier_id')
            ->map(function ($items, $supplierId) use ($communications, $request): array {
                $first = $items->first();
                $supplier = $first?->relationLoaded('supplier') ? $first->supplier : null;

                return [
                    'supplier' => [
                        'id' => (int) $supplierId,
                        'shop_name' => $supplier?->shop_name,
                        'contact_person' => $supplier?->contact_person,
                        'phone' => $supplier?->phone,
                        'viber_phone' => $supplier?->viber_phone,
                        'email' => $supplier?->email,
                        'delivery_time' => $supplier?->delivery_time,
                        'warranty_policy' => $supplier?->warranty_policy,
                    ],
                    'items' => $items
                        ->map(fn ($item): array => (new QuotationItemResource($item))->resolve($request))
                        ->values()
                        ->all(),
                    'communications' => $communications
                        ->where('supplier_id', (int) $supplierId)
                        ->map(fn (SupplierCommunication $communication): array => (new SupplierCommunicationResource($communication))->resolve($request))
                        ->values()
                        ->all(),
                ];
            })
            ->values()
            ->all();
    }
}
