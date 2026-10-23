<?php

namespace App\Http\Resources;

use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Minimal quotation/request summary returned by the customer action
 * endpoints, plus the order produced by an accepted quotation.
 */
class CustomerQuotationActionResultResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $quotation = $this->resource['quotation'];
        $quotationRequest = $this->resource['request'];

        $data = [
            'quotation' => [
                'id' => $quotation->id,
                'version' => $quotation->version,
                'status' => $quotation->status->value,
                'total_amount' => $quotation->total_amount,
                'valid_until' => $quotation->valid_until?->toDateString(),
            ],
            'request' => [
                'id' => $quotationRequest->id,
                'quotation_number' => $quotationRequest->quotation_number,
                'status' => $quotationRequest->status->value,
            ],
        ];

        if (array_key_exists('order', $this->resource)) {
            $order = $this->resource['order'];

            $data['order'] = $order instanceof Order ? [
                'id' => $order->id,
                'order_number' => $order->order_number,
                'order_status' => $order->order_status->value,
                'payment_status' => $order->payment_status->value,
                'delivery_status' => $order->delivery_status->value,
                'total_amount' => $order->total_amount,
                'created_at' => $order->created_at?->toIso8601String(),
            ] : null;
        }

        return $data;
    }
}
