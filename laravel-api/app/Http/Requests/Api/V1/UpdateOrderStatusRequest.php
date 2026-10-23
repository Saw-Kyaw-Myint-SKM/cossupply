<?php

namespace App\Http\Requests\Api\V1;

use App\Services\Order\AdminOrderService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Admin supplier-confirmation status change (Task 09).
 *
 * Only the four pre-delivery targets are accepted. Delivery and payment
 * stages are rejected with 422 so they can never be driven through this
 * endpoint.
 */
class UpdateOrderStatusRequest extends FormRequest
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
            'status' => [
                'required',
                'string',
                Rule::in(AdminOrderService::TASK09_TARGETS),
            ],
            'note' => [
                'nullable',
                'string',
                'max:2000',
                Rule::requiredIf(fn (): bool => in_array(
                    $this->input('status'),
                    AdminOrderService::NOTE_REQUIRED_TARGETS,
                    true,
                )),
            ],
        ];
    }
}
