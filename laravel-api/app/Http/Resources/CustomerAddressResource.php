<?php

namespace App\Http\Resources;

use App\Models\CustomerAddress;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A customer address book entry.
 *
 * @mixin CustomerAddress
 */
class CustomerAddressResource extends JsonResource
{
    /**
     * Transform the address into an API representation.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'customer_id' => $this->customer_id,
            'contact_name' => $this->contact_name,
            'phone' => $this->phone,
            'city' => $this->city,
            'township' => $this->township,
            'ward' => $this->ward,
            'street' => $this->street,
            'building_no' => $this->building_no,
            'landmark' => $this->landmark,
            'full_address' => $this->full_address,
            'is_default' => (bool) $this->is_default,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
