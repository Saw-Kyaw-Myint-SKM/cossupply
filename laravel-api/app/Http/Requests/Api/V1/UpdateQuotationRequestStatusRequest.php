<?php

namespace App\Http\Requests\Api\V1;

use App\Enums\QuotationRequestStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateQuotationRequestStatusRequest extends FormRequest
{
    /**
     * Admin workflow endpoints are guarded by auth:sanctum + admin.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Only operational statuses may be set manually by an Admin. Customer
     * decision and system expiry statuses are owned by later tasks.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'status' => [
                'required',
                Rule::in([
                    QuotationRequestStatus::CONTACTING_SUPPLIER->value,
                    QuotationRequestStatus::SUPPLIER_RESPONSE_PENDING->value,
                    QuotationRequestStatus::PREPARING_QUOTATION->value,
                    QuotationRequestStatus::CANCELLED->value,
                ]),
            ],
        ];
    }
}
