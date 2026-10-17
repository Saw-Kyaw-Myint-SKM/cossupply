<?php

namespace App\Http\Requests\Api\V1;

use App\Enums\StockStatus;
use App\Models\Product;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateProductRequest extends FormRequest
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
     * The product status is intentionally excluded: status changes must go
     * through PATCH /admin/products/{product}/status.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $product = $this->route('product');

        return [
            'supplier_id' => ['sometimes', 'required', 'integer', 'exists:suppliers,id'],
            'category_id' => ['sometimes', 'required', 'integer', 'exists:categories,id'],
            'name_mm' => ['sometimes', 'required', 'string', 'max:255'],
            'name_en' => ['sometimes', 'nullable', 'string', 'max:255'],
            'slug' => [
                'sometimes',
                'required',
                'string',
                'max:255',
                'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/',
                Rule::unique('products', 'slug')->ignore($product?->id),
            ],
            'sku' => ['sometimes', 'nullable', 'string', 'max:100'],
            'brand' => ['sometimes', 'nullable', 'string', 'max:255'],
            'model' => ['sometimes', 'nullable', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'specification' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'size' => ['sometimes', 'nullable', 'string', 'max:100'],
            'color' => ['sometimes', 'nullable', 'string', 'max:100'],
            'unit' => ['sometimes', 'required', 'string', 'max:50'],
            'package_size' => ['sometimes', 'nullable', 'string', 'max:100'],
            'photo' => ['sometimes', 'nullable', 'file', 'mimes:jpeg,jpg,png,webp', 'max:2048'],
            'retail_price' => ['sometimes', 'required', 'integer', 'min:1'],
            'wholesale_price' => ['sometimes', 'nullable', 'integer', 'min:0'],
            'discount_price' => ['sometimes', 'nullable', 'integer', 'min:0'],
            'minimum_order_quantity' => ['sometimes', 'integer', 'min:1'],
            'price_valid_until' => ['sometimes', 'nullable', 'date'],
            'stock_quantity' => ['sometimes', 'nullable', 'integer', 'min:0'],
            'stock_status' => ['sometimes', 'nullable', Rule::in(StockStatus::values())],
            'supplier_note' => ['sometimes', 'nullable', 'string', 'max:1000'],
        ];
    }

    /**
     * Validate the retail/discount relationship against the effective price.
     *
     * @return array<int, callable>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                $retail = $this->input('retail_price');

                if ($retail === null && ! $validator->errors()->has('retail_price')) {
                    $product = $this->route('product');

                    if ($product instanceof Product) {
                        $retail = $product->prices()->orderBy('id')->first()?->retail_price;
                    }
                }

                $discount = $this->input('discount_price');

                if ($retail !== null && $discount !== null && (int) $discount > (int) $retail) {
                    $validator->errors()->add('discount_price', 'The discount price must not be greater than the retail price.');
                }
            },
        ];
    }
}
