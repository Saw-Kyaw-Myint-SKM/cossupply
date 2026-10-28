<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class RejectQuotationRequest extends FormRequest
{
    /**
     * Route access is enforced by auth:sanctum + customer middleware.
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
            'customer_note' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
