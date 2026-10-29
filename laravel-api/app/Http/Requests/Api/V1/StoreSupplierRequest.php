<?php

namespace App\Http\Requests\Api\V1;

use App\Enums\SupplierStatus;
use App\Rules\PhoneNumber;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreSupplierRequest extends FormRequest
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
            'shop_name' => ['required', 'string', 'max:255'],
            'company_name' => ['nullable', 'string', 'max:255'],
            'contact_person' => ['required', 'string', 'max:255'],
            'phone' => ['required', 'string', 'max:50', new PhoneNumber],
            'viber_phone' => ['nullable', 'string', 'max:50', new PhoneNumber],
            'email' => ['nullable', 'email', 'max:255'],
            'logo' => ['nullable', 'file', 'mimes:jpeg,jpg,png,webp', 'max:2048'],
            'address' => ['required', 'string', 'max:1000'],
            'city' => ['required', 'string', 'max:255'],
            'township' => ['nullable', 'string', 'max:255'],
            'business_description' => ['nullable', 'string', 'max:5000'],
            'delivery_area' => ['nullable', 'string', 'max:255'],
            'delivery_time' => ['nullable', 'string', 'max:255'],
            'warranty_policy' => ['nullable', 'string', 'max:5000'],
            'return_policy' => ['nullable', 'string', 'max:5000'],
            'status' => ['nullable', Rule::in(SupplierStatus::values())],
            'verified' => ['nullable', 'boolean'],
        ];
    }
}
