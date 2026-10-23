<?php

namespace App\Http\Resources;

use App\Models\Quotation;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * One Final Quotation version with its immutable totals and snapshots.
 *
 * @mixin Quotation
 */
class QuotationVersionResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'quotation_request_id' => $this->quotation_request_id,
            'quotation_number' => $this->quotation_number,
            'version' => $this->version,
            'status' => $this->status->value,
            'is_current' => $this->is_current,
            'subtotal' => $this->subtotal,
            'discount' => $this->discount,
            'delivery_fee' => $this->delivery_fee,
            'service_fee_percentage' => $this->service_fee_percentage,
            'service_fee' => $this->service_fee,
            'total_amount' => $this->total_amount,
            'payment_method' => $this->payment_method,
            'payment_terms' => $this->payment_terms,
            'valid_until' => $this->valid_until?->toDateString(),
            'admin_note' => $this->admin_note,
            'sent_at' => $this->sent_at?->toIso8601String(),
            'viewed_at' => $this->viewed_at?->toIso8601String(),
            'accepted_at' => $this->accepted_at?->toIso8601String(),
            'rejected_at' => $this->rejected_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'created_by_admin' => $this->whenLoaded('createdByAdmin', fn (): array => [
                'id' => $this->createdByAdmin->id,
                'name' => $this->createdByAdmin->name,
            ]),
            'items' => QuotationVersionItemResource::collection($this->whenLoaded('items')),
            'pdfs' => QuotationPdfResource::collection($this->whenLoaded('pdfs')),
            'email_logs' => EmailLogResource::collection($this->whenLoaded('emailLogs')),
        ];
    }
}
