<?php

namespace App\Http\Requests\Api\V1;

use App\Models\QuotationRequest;
use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Payload for POST /admin/quotation-requests/{id}/communications/bulk.
 *
 * One shared message is appended to every selected supplier group. When
 * `supplier_ids` is omitted the request's own suppliers are used, which keeps
 * the "log contact for all suppliers" action valid on its own.
 */
class StoreBulkSupplierCommunicationRequest extends FormRequest
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
            'supplier_ids' => ['nullable', 'array', 'min:1'],
            'supplier_ids.*' => ['integer', 'distinct', Rule::exists('suppliers', 'id')],
            'contact_method' => ['required', Rule::in(['VIBER', 'PHONE', 'EMAIL', 'TELEGRAM', 'OTHER'])],
            'message_text' => ['required', 'string', 'max:5000'],
            'attachment' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png,webp', 'max:5120'],
            'contacted_at' => ['nullable', 'date'],
        ];
    }

    /**
     * Every selected supplier must own at least one item in this request.
     *
     * @return array<int, Closure(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                $quotationRequest = $this->route('quotationRequest');

                if (! $quotationRequest instanceof QuotationRequest) {
                    return;
                }

                $supplierIds = array_map('intval', (array) $this->input('supplier_ids', []));

                if ($supplierIds === []) {
                    // Omitted ids mean "every supplier in this request".
                    if (! $quotationRequest->items()->exists()) {
                        $validator->errors()->add(
                            'supplier_ids',
                            'This quotation request has no supplier to log a contact for.',
                        );
                    }

                    return;
                }

                $owned = $quotationRequest->items()
                    ->whereIn('supplier_id', $supplierIds)
                    ->distinct()
                    ->pluck('supplier_id')
                    ->map(fn ($id): int => (int) $id)
                    ->all();

                if (array_diff($supplierIds, $owned) !== []) {
                    $validator->errors()->add(
                        'supplier_ids',
                        'Every selected supplier must be part of this quotation request.',
                    );
                }
            },
        ];
    }
}
