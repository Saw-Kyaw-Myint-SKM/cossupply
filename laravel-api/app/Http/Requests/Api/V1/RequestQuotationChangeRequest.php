<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Ask Admin for a revised quotation version. The note explaining the
 * requested change is required.
 */
class RequestQuotationChangeRequest extends FormRequest
{
    /**
     * Route access is enforced by auth:sanctum + customer middleware and
     * ownership is re-checked in the action service.
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
            'customer_note' => ['required', 'string', 'max:2000'],
        ];
    }
}
