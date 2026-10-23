<?php

namespace App\Http\Requests\Api\V1;

use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class SaveQuotationVersionRequest extends FormRequest
{
    /**
     * Route access is enforced by auth:sanctum + admin.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Only snapshot-friendly inputs are accepted. The product name, SKU,
     * supplier and line total are derived server-side.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => [
                'required',
                'integer',
                'distinct',
                Rule::exists('products', 'id'),
            ],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'items.*.unit_price' => ['required', 'integer', 'min:1'],
            'items.*.discount' => ['nullable', 'integer', 'min:0'],
            'items.*.delivery_date' => ['nullable', 'date', 'after_or_equal:today'],
            'items.*.warranty_note' => ['nullable', 'string', 'max:1000'],
            'items.*.supplier_note' => ['nullable', 'string', 'max:1000'],
            'discount' => ['nullable', 'integer', 'min:0'],
            'delivery_fee' => ['nullable', 'integer', 'min:0'],
            'service_fee_percentage' => ['nullable', 'integer', 'min:0', 'max:100'],
            'payment_method' => ['nullable', Rule::in(['CASH_ON_DELIVERY'])],
            'payment_terms' => ['nullable', 'string', 'max:1000'],
            'valid_until' => ['nullable', 'date', 'after_or_equal:today'],
            'admin_note' => ['nullable', 'string', 'max:2000'],
        ];
    }

    /**
     * A line discount cannot exceed that line's gross value.
     *
     * @return array<int, Closure(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                $items = $this->input('items');

                if (! is_array($items)) {
                    return;
                }

                foreach ($items as $index => $item) {
                    if (! is_array($item)) {
                        continue;
                    }

                    $discountKey = "items.{$index}.discount";

                    if ($validator->errors()->has($discountKey)) {
                        continue;
                    }

                    $quantity = (int) ($item['quantity'] ?? 0);
                    $unitPrice = (int) ($item['unit_price'] ?? 0);
                    $discount = (int) ($item['discount'] ?? 0);

                    if ($discount > $quantity * $unitPrice) {
                        $validator->errors()->add(
                            $discountKey,
                            'The line discount cannot exceed quantity multiplied by unit price.',
                        );
                    }
                }
            },
        ];
    }
}
