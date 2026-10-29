<?php

namespace App\Http\Resources;

use App\Models\Customer;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Admin customer directory row.
 *
 * Password hashes and remember tokens are never serialized; the list only
 * exposes the profile fields an Admin needs to identify a customer and the
 * quotation/order counts used to route follow-up work.
 *
 * @mixin Customer
 */
class CustomerResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'phone' => $this->phone,
            'email' => $this->email,
            'company_name' => $this->company_name,
            'customer_type' => $this->customer_type,
            'status' => $this->status,
            'quotation_requests_count' => $this->whenCounted('quotationRequests'),
            'orders_count' => $this->whenCounted('orders'),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
