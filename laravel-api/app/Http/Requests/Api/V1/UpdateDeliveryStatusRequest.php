<?php

namespace App\Http\Requests\Api\V1;

use App\Enums\OrderStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Admin delivery workflow action (LogicFlow §11).
 *
 * The admin chooses the order-level delivery step; the service keeps the
 * delivery record, order status and COD payment status in sync. Partial
 * delivery is not modelled, so the target is always one of the full-delivery
 * steps.
 */
class UpdateDeliveryStatusRequest extends FormRequest
{
    /**
     * Route access is enforced by auth:sanctum + admin middleware.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $targets = [
            OrderStatus::PREPARING->value,
            OrderStatus::READY_TO_SHIP->value,
            OrderStatus::OUT_FOR_DELIVERY->value,
            OrderStatus::DELIVERED->value,
            OrderStatus::DELIVERY_FAILED->value,
            OrderStatus::RETURNED->value,
        ];

        return [
            'status' => ['required', Rule::in($targets)],
            'note' => [
                'nullable',
                'string',
                'min:3',
                'max:2000',
                'required_if:status,'.OrderStatus::DELIVERY_FAILED->value.','.OrderStatus::RETURNED->value,
            ],
            'delivery_partner' => ['nullable', 'string', 'max:255'],
            'tracking_number' => ['nullable', 'string', 'max:100'],
            'estimated_delivery_date' => ['nullable', 'date'],
            'received_by' => [
                'nullable',
                'string',
                'max:255',
                'required_if:status,'.OrderStatus::DELIVERED->value,
            ],
        ];
    }

    /**
     * Customer-facing wording for delivery failure/return notes.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'received_by.required_if' => 'Record who received the full delivery.',
            'note.required_if' => 'Explain why the delivery failed or was returned.',
        ];
    }
}
