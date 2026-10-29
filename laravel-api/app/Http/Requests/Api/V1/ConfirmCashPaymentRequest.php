<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Verify the collected cash and complete a delivered order.
 */
class ConfirmCashPaymentRequest extends FormRequest
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
            'note' => ['nullable', 'string', 'min:3', 'max:2000'],
        ];
    }
}
