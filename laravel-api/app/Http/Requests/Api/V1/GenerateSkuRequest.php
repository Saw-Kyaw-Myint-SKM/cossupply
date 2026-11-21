<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Payload for POST /admin/products/generate-sku, the auto-generate icon next
 * to the SKU fields on the product form.
 *
 * The server builds the value so it can be checked against stored SKUs and the
 * variant rows the form has not saved yet.
 */
class GenerateSkuRequest extends FormRequest
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
            'scope' => ['required', Rule::in(['product', 'variant'])],

            // Prefix sources. Values typed into the form arrive first so an
            // unsaved edit still shapes the generated code; the stored product
            // row is only a fallback and lives in the service call.
            'base' => ['nullable', 'string', 'max:100'],
            'name_en' => ['nullable', 'string', 'max:255'],
            'brand' => ['nullable', 'string', 'max:255'],
            'model' => ['nullable', 'string', 'max:255'],

            // Variant scope: which product's stored rows to compare against.
            'product_id' => ['nullable', 'integer', 'exists:products,id'],
            'variant_name' => ['nullable', 'string', 'max:255'],
            // 1-based row number, used when the variant name has no ASCII.
            'variant_index' => ['nullable', 'integer', 'min:1', 'max:50'],
            'exclude_variant_id' => ['nullable', 'integer', 'exists:product_variants,id'],

            // SKUs typed into the form's variant rows, including this one,
            // so the value coming back always differs from what is on screen.
            'existing_skus' => ['nullable', 'array', 'max:50'],
            'existing_skus.*' => ['nullable', 'string', 'max:100'],
        ];
    }
}
