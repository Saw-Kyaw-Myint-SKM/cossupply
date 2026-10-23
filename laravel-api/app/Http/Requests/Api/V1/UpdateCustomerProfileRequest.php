<?php

namespace App\Http\Requests\Api\V1;

use App\Models\Customer;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateCustomerProfileRequest extends FormRequest
{
    /**
     * Route access is enforced by the auth:sanctum + customer middleware.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * `phone` is intentionally NOT updatable: it is the customer login
     * identifier. If it is present in the payload it is silently ignored.
     * `status` and `customer_type` are server-managed too.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $customer = $this->user();

        return [
            'name' => ['required', 'string', 'max:255'],
            'company_name' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255', Rule::unique('customers', 'email')->ignore($customer?->id)],
        ];
    }
}
