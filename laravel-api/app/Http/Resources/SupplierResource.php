<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\ExposesPublicMedia;
use App\Models\Supplier;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Supplier
 */
class SupplierResource extends JsonResource
{
    use ExposesPublicMedia;

    /**
     * Transform the supplier into an API representation.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'shop_name' => $this->shop_name,
            'company_name' => $this->company_name,
            'contact_person' => $this->contact_person,
            'phone' => $this->phone,
            'viber_phone' => $this->viber_phone,
            'email' => $this->email,
            'logo' => $this->logo,
            'logo_url' => $this->publicMediaUrl($this->logo),
            'address' => $this->address,
            'city' => $this->city,
            'township' => $this->township,
            'business_description' => $this->business_description,
            'delivery_area' => $this->delivery_area,
            'delivery_time' => $this->delivery_time,
            'warranty_policy' => $this->warranty_policy,
            'return_policy' => $this->return_policy,
            'status' => $this->status->value,
            'verified' => (bool) $this->verified,
            'products_count' => $this->whenCounted('products'),
            'created_by_admin_id' => $this->created_by_admin_id,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
