<?php

namespace App\Http\Requests\Api\V1;

use App\Models\Admin;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateAdminUserRequest extends FormRequest
{
    /**
     * Route access is enforced by the auth:sanctum + admin + super_admin middleware.
     *
     * Passwords are deliberately absent: they are changed through the
     * dedicated `admin.password_reset` endpoint.
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
        $adminUser = $this->route('admin_user');

        return [
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'email' => [
                'sometimes',
                'required',
                'string',
                'email',
                'max:255',
                Rule::unique('admins', 'email')->ignore($adminUser?->id),
            ],
            'phone' => ['sometimes', 'nullable', 'string', 'max:30'],
            'role' => ['sometimes', Rule::in(Admin::ROLES)],
            'status' => ['sometimes', Rule::in(Admin::STATUSES)],
        ];
    }
}
