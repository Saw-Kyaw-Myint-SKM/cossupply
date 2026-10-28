<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SupplierConfirmationRequest extends FormRequest
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
            'result' => ['required', Rule::in(['CONFIRMED', 'UNAVAILABLE'])],
            'note' => [
                'nullable',
                'string',
                'min:3',
                'max:2000',
                'required_if:result,UNAVAILABLE',
            ],
        ];
    }
}
