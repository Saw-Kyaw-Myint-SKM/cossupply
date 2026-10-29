<?php

namespace App\Http\Requests\Api\V1;

use App\Enums\SupplierStatus;
use App\Rules\PhoneNumber;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateSupplierRequest extends FormRequest
{
    /**
     * Route access is enforced by the auth:sanctum + admin middleware.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'shop_name' => ['sometimes', 'required', 'string', 'max:255'],
            'company_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'contact_person' => ['sometimes', 'required', 'string', 'max:255'],
            'phone' => ['sometimes', 'required', 'string', 'max:50', new PhoneNumber],
            'viber_phone' => ['sometimes', 'nullable', 'string', 'max:50', new PhoneNumber],
            'email' => ['sometimes', 'nullable', 'email', 'max:255'],
            'logo' => ['sometimes', 'nullable', 'file', 'mimes:jpeg,jpg,png,webp', 'max:2048'],
            'address' => ['sometimes', 'required', 'string', 'max:1000'],
            'city' => ['sometimes', 'required', 'string', 'max:255'],
            'township' => ['sometimes', 'nullable', 'string', 'max:255'],
            'business_description' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'delivery_area' => ['sometimes', 'nullable', 'string', 'max:255'],
            'delivery_time' => ['sometimes', 'nullable', 'string', 'max:255'],
            'warranty_policy' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'return_policy' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'status' => ['sometimes', Rule::in(SupplierStatus::values())],
            'verified' => ['sometimes', 'boolean'],
        ];
    }
}
