<?php

namespace App\Http\Requests\Api\V1;

use App\Models\Admin;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreAdminUserRequest extends FormRequest
{
    /**
     * Route access is enforced by the auth:sanctum + admin + super_admin middleware.
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
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:admins,email'],
            'phone' => ['nullable', 'string', 'max:30'],
            'password' => ['required', 'string', 'min:8', 'max:1000'],
            'role' => ['nullable', Rule::in(Admin::ROLES)],
            'status' => ['nullable', Rule::in(Admin::STATUSES)],
        ];
    }
}
