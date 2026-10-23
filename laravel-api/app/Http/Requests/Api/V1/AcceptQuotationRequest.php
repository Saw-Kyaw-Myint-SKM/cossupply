<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Accept the current quotation. The customer must explicitly acknowledge
 * the Cash on Delivery terms before the quotation can be accepted.
 */
class AcceptQuotationRequest extends FormRequest
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
            'cod_terms_accepted' => ['required', 'boolean', 'accepted'],
        ];
    }
}
