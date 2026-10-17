<?php

namespace App\Http\Requests\Api\V1;

use App\Enums\ProductStatus;
use App\Enums\StockStatus;
use App\Models\Product;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreProductRequest extends FormRequest
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
            'supplier_id' => ['required', 'integer', 'exists:suppliers,id'],
            'category_id' => ['required', 'integer', 'exists:categories,id'],
            'name_mm' => ['required', 'string', 'max:255'],
            'name_en' => ['nullable', 'string', 'max:255'],
            'slug' => ['nullable', 'string', 'max:255', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/', 'unique:products,slug'],
            'sku' => ['nullable', 'string', 'max:100'],
            'brand' => ['nullable', 'string', 'max:255'],
            'model' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'specification' => ['nullable', 'string', 'max:5000'],
            'size' => ['nullable', 'string', 'max:100'],
            'color' => ['nullable', 'string', 'max:100'],
            'unit' => ['required', 'string', 'max:50'],
            'package_size' => ['nullable', 'string', 'max:100'],
            'photo' => ['required', 'file', 'mimes:jpeg,jpg,png,webp', 'max:2048'],
            'status' => ['nullable', Rule::in([ProductStatus::DRAFT->value, ProductStatus::PUBLISHED->value])],
            'retail_price' => ['required', 'integer', 'min:1'],
            'wholesale_price' => ['nullable', 'integer', 'min:0'],
            'discount_price' => ['nullable', 'integer', 'min:0'],
            'minimum_order_quantity' => ['nullable', 'integer', 'min:1'],
            'price_valid_until' => ['nullable', 'date'],
            'stock_quantity' => ['nullable', 'integer', 'min:0'],
            'stock_status' => ['nullable', Rule::in(StockStatus::values())],
            'supplier_note' => ['nullable', 'string', 'max:1000'],
        ];
    }

    /**
     * Validate the derived slug and the retail/discount relationship.
     *
     * @return array<int, callable>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if (! $this->filled('slug') && ! $validator->errors()->has('name_en')) {
                    $derived = Str::slug((string) $this->input('name_en'));

                    if ($derived === '') {
                        $validator->errors()->add('slug', 'The slug field is required because a slug cannot be generated from name_en.');
                    } elseif (Product::query()->where('slug', $derived)->exists()) {
                        $validator->errors()->add('slug', 'The slug has already been taken.');
                    }
                }

                $retail = $this->input('retail_price');
                $discount = $this->input('discount_price');

                if ($retail !== null && $discount !== null && (int) $discount > (int) $retail) {
                    $validator->errors()->add('discount_price', 'The discount price must not be greater than the retail price.');
                }
            },
        ];
    }
}
