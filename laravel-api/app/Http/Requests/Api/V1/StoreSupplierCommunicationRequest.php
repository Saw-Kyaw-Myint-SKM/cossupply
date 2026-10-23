<?php

namespace App\Http\Requests\Api\V1;

use App\Models\QuotationRequest;
use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreSupplierCommunicationRequest extends FormRequest
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
            'supplier_id' => ['required', 'integer', Rule::exists('suppliers', 'id')],
            'contact_method' => ['required', Rule::in(['VIBER', 'PHONE', 'EMAIL', 'TELEGRAM', 'OTHER'])],
            'message_text' => ['nullable', 'string', 'max:5000'],
            'supplier_response' => ['nullable', 'string', 'max:5000'],
            'attachment' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png,webp', 'max:5120'],
            'contacted_at' => ['nullable', 'date'],
            'responded_at' => ['nullable', 'date', 'after_or_equal:contacted_at'],
        ];
    }

    /**
     * The supplier must actually own at least one item in this request.
     *
     * @return array<int, Closure(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                $supplierId = (int) $this->input('supplier_id');
                $quotationRequest = $this->route('quotationRequest');

                if (! $quotationRequest instanceof QuotationRequest || $supplierId <= 0) {
                    return;
                }

                if (! $quotationRequest->items()->where('supplier_id', $supplierId)->exists()) {
                    $validator->errors()->add(
                        'supplier_id',
                        'The selected supplier is not part of this quotation request.',
                    );
                }
            },
        ];
    }
}
