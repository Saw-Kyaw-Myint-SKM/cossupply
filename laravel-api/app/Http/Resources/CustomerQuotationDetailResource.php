<?php

namespace App\Http\Resources;

use App\Enums\QuotationVersionStatus;
use App\Models\Quotation;
use App\Models\QuotationRequest;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Full customer view of one quotation request: request-time snapshots, the
 * current Final Quotation version, version history and the customer's own
 * action trail.
 *
 * Decision flags are computed server-side so the UI never has to re-implement
 * validity, currency and expiry rules.
 *
 * @mixin QuotationRequest
 */
class CustomerQuotationDetailResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var Quotation|null $current */
        $current = $this->relationLoaded('currentQuotation') ? $this->currentQuotation : null;

        $expired = $current !== null
            && ($current->status === QuotationVersionStatus::EXPIRED
                || ($current->valid_until !== null
                    && $current->valid_until->toDateString() < now()->toDateString()));

        $actionable = $current !== null
            && $current->is_current
            && ! $expired
            && in_array($current->status, [
                QuotationVersionStatus::SENT,
                QuotationVersionStatus::VIEWED,
            ], true);

        return [
            'id' => $this->id,
            'quotation_number' => $this->quotation_number,
            'status' => $this->status->value,
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
            'created_at' => $this->created_at?->toIso8601String(),
            'items' => QuotationItemResource::collection($this->whenLoaded('items')),
            'current_quotation' => $current !== null
                ? new QuotationVersionResource($current)
                : null,
            'quotation_history' => QuotationVersionSummaryResource::collection(
                $this->whenLoaded('quotations'),
            ),
            'actions' => $current !== null && $current->relationLoaded('actions')
                ? QuotationActionResource::collection($current->actions)->resolve()
                : [],
            'can_accept' => $actionable,
            'can_reject' => $actionable,
            'can_request_change' => $actionable,
            'is_expired' => $expired,
        ];
    }
}
