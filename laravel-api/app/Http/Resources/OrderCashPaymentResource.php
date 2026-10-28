<?php

namespace App\Http\Resources;

use App\Enums\PaymentStatus;
use App\Models\CashPayment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * The full COD payment record created with an order.
 *
 * @mixin CashPayment
 */
class OrderCashPaymentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'delivery_id' => $this->delivery_id,
            'receipt_number' => $this->receipt_number,
            'amount_due' => $this->amount_due,
            'amount_collected' => $this->amount_collected,
            'amount_remaining' => $this->amount_remaining,
            'received_by' => $this->received_by,
            'collected_at' => $this->collected_at?->toIso8601String(),
            'customer_name' => $this->customer_name,
            'note' => $this->note,
            'status' => $this->status->value,
            'receipt_available' => in_array($this->status, [
                PaymentStatus::CASH_COLLECTED,
                PaymentStatus::PAYMENT_CONFIRMED,
            ], true),
        ];
    }
}
