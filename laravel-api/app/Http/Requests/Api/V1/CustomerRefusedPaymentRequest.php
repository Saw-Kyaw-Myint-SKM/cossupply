<?php

namespace App\Http\Requests\Api\V1;

use App\Enums\OrderStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Customer refused to pay the COD amount at the door.
 *
 * The refusal must record both the delivery outcome and the responsible
 * admin/receiver, per MoneyAndValidationRules §4.
 */
class CustomerRefusedPaymentRequest extends FormRequest
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
        return [
            'delivery_outcome' => [
                'required',
                Rule::in([
                    OrderStatus::DELIVERY_FAILED->value,
                    OrderStatus::RETURNED->value,
                ]),
            ],
            'responsible_person' => ['required', 'string', 'min:2', 'max:255'],
            'note' => ['required', 'string', 'min:3', 'max:2000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'delivery_outcome.required' => 'Record what happened to the delivery.',
            'responsible_person.required' => 'Record the admin or receiver who handled the refusal.',
            'note.required' => 'Explain why the customer refused to pay.',
        ];
    }
}
