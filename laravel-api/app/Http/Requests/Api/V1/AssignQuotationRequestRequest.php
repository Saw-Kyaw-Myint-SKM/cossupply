<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class AssignQuotationRequestRequest extends FormRequest
{
    /**
     * Route access is enforced by auth:sanctum + admin.
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
            'assigned_admin_id' => ['present', 'nullable', 'integer', 'exists:admins,id'],
        ];
    }
}
