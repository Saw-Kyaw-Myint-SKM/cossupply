<?php

namespace App\Http\Requests\Api\V1;

use App\Models\Order;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Record the full COD amount handed over on delivery.
 *
 * MVP accepts full payment only: the service rejects any amount other than
 * `amount_due`. The receipt number is pre-generated at order creation and is
 * only replaced when the admin explicitly provides a corrected one.
 */
class RecordCashCollectionRequest extends FormRequest
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
        $order = $this->route('order');
        $paymentId = $order instanceof Order ? $order->cashPayment()->value('id') : null;

        return [
            'amount_collected' => ['required', 'integer', 'min:0'],
            'receipt_number' => [
                'nullable',
                'string',
                'max:100',
                Rule::unique('cash_payments', 'receipt_number')->ignore($paymentId),
            ],
            'received_by' => ['required', 'string', 'min:2', 'max:255'],
            'collected_at' => ['nullable', 'date'],
            'note' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
