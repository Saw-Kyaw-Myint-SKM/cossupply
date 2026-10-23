<?php

namespace App\Http\Resources;

use App\Models\QuotationRequest;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A quotation request owned by the authenticated customer.
 *
 * Contact and delivery fields are the immutable request-time snapshots.
 *
 * @mixin QuotationRequest
 */
class QuotationRequestResource extends JsonResource
{
    /**
     * Transform the quotation request into an API representation.
     *
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
            'items' => QuotationItemResource::collection($this->whenLoaded('items')),
        ];
    }
}
