<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class RequestQuotationChangeRequest extends FormRequest
{
    /**
     * Route access is enforced by auth:sanctum + customer middleware.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * The change note is mandatory: Admin needs a concrete revision request
     * (LogicFlow §8).
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'customer_note' => ['required', 'string', 'min:5', 'max:2000'],
        ];
    }
}
