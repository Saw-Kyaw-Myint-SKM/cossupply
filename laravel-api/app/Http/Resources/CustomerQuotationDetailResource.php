<?php

namespace App\Http\Resources;

use App\Enums\QuotationRequestStatus;
use App\Enums\QuotationVersionStatus;
use App\Models\Quotation;
use App\Models\QuotationRequest;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Customer-facing quotation request detail with every version newest first.
 *
 * Reads are side-effect free: an expired quotation is reported through
 * `is_expired`/`can_*` without being persisted. Persisting EXPIRED happens
 * only when the customer explicitly opens the current quotation.
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
        $current = $this->relationLoaded('currentQuotation') ? $this->currentQuotation : null;

        return [
            'id' => $this->id,
            'quotation_number' => $this->quotation_number,
            'status' => $this->status->value,
            'customer_name' => $this->customer_name,
            'company_name' => $this->company_name,
            'phone' => $this->phone,
            'email' => $this->email,
            'city' => $this->city,
            'township' => $this->township,
            'landmark' => $this->landmark,
            'delivery_address' => $this->delivery_address,
            'required_delivery_date' => $this->required_delivery_date?->toDateString(),
            'customer_note' => $this->customer_note,
            'created_at' => $this->created_at?->toIso8601String(),
            'items' => QuotationItemResource::collection($this->whenLoaded('items')),
            'current_quotation_id' => $current?->id,
            'order' => $this->orderPayload($current),
            'is_expired' => $this->isExpired($current),
            'can_accept' => $this->canRespond($current),
            'can_reject' => $this->canRespond($current),
            'can_request_change' => $this->canRespond($current),
            'versions' => CustomerQuotationVersionResource::collection($this->whenLoaded('quotations')),
        ];
    }

    /**
     * The order produced by the current quotation, if the customer already
     * accepted it. Only the order belonging to the current version is
     * exposed, and the relation is expected to be eager-loaded.
     *
     * @return array<string, mixed>|null
     */
    private function orderPayload(?Quotation $current): ?array
    {
        if ($current === null || ! $current->relationLoaded('order')) {
            return null;
        }

        $order = $current->order;

        if ($order === null) {
            return null;
        }

        return [
            'id' => $order->id,
            'order_number' => $order->order_number,
            'order_status' => $order->order_status->value,
            'payment_status' => $order->payment_status->value,
            'delivery_status' => $order->delivery_status->value,
            'total_amount' => $order->total_amount,
            'created_at' => $order->created_at?->toIso8601String(),
        ];
    }

    /**
     * The request is expired when it is already terminal, or when the
     * current version's validity date has passed.
     */
    private function isExpired(?Quotation $current): bool
    {
        return $this->status === QuotationRequestStatus::EXPIRED
            || ($current !== null && (
                $current->status === QuotationVersionStatus::EXPIRED
                || $current->isExpired()
            ));
    }

    /**
     * Whether the customer may accept/reject/request a change right now.
     */
    private function canRespond(?Quotation $current): bool
    {
        if ($current === null || $this->isExpired($current)) {
            return false;
        }

        return $current->is_current
            && in_array($current->status, [
                QuotationVersionStatus::SENT,
                QuotationVersionStatus::VIEWED,
            ], true)
            && in_array($this->status, [
                QuotationRequestStatus::QUOTATION_SENT,
                QuotationRequestStatus::CUSTOMER_REVIEWING,
            ], true);
    }
}
