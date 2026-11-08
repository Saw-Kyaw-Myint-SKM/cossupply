<?php

namespace App\Http\Requests\Api\V1\Concerns;

use App\Enums\StockStatus;
use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Shared variant validation for product create/update requests.
 *
 * Variants are optional: an absent or empty `variants` array keeps the
 * product as a complete single product. A variant is identified by its typed
 * `name`; the legacy `attributes` map is still accepted so older clients keep
 * working.
 */
trait ValidatesProductVariants
{
    /**
     * @return array<string, mixed>
     */
    protected function variantRules(?Product $product = null): array
    {
        return [
            'variants_sync' => ['sometimes', 'boolean'],
            'variants' => ['sometimes', 'nullable', 'array', 'max:50'],
            'variants.*.id' => $product === null
                ? ['prohibited']
                : [
                    'sometimes',
                    'integer',
                    Rule::exists('product_variants', 'id')->where('product_id', $product->id),
                ],
            'variants.*.name' => ['nullable', 'string', 'max:255'],
            'variants.*.attributes' => ['sometimes', 'nullable', 'array', 'max:3'],
            'variants.*.attributes.*' => ['required', 'string', 'max:100'],
            'variants.*.sku' => ['nullable', 'string', 'max:100'],
            'variants.*.photo' => ['nullable', 'file', 'mimes:jpeg,jpg,png,webp', 'max:2048'],
            'variants.*.retail_price' => ['nullable', 'integer', 'min:1'],
            'variants.*.wholesale_price' => ['nullable', 'integer', 'min:0'],
            'variants.*.discount_price' => ['nullable', 'integer', 'min:0'],
            'variants.*.minimum_order_quantity' => ['nullable', 'integer', 'min:1'],
            'variants.*.price_valid_until' => ['nullable', 'date'],
            'variants.*.stock_quantity' => ['nullable', 'integer', 'min:0'],
            'variants.*.stock_status' => ['nullable', Rule::in(StockStatus::values())],
            'variants.*.supplier_note' => ['nullable', 'string', 'max:1000'],
        ];
    }

    /**
     * Reject duplicate names, duplicate SKUs, and discount prices that exceed
     * their retail price. Base rules run first, so malformed rows have already
     * been reported.
     */
    protected function validateProductVariants(Validator $validator): void
    {
        $variants = $this->input('variants');

        if (! is_array($variants) || $variants === []) {
            return;
        }

        $identities = [];
        $skus = [];

        foreach ($variants as $index => $variant) {
            if (! is_array($variant)) {
                continue;
            }

            $name = trim((string) ($variant['name'] ?? ''));
            $attributes = $variant['attributes'] ?? [];

            if (! is_array($attributes)) {
                $attributes = [];
            }

            $hasInvalidKey = collect($attributes)->keys()->contains(
                fn ($attributeName): bool => ! is_string($attributeName)
                    || trim($attributeName) === ''
                    || str_contains($attributeName, '[')
                    || str_contains($attributeName, ']'),
            );

            if ($hasInvalidKey) {
                $validator->errors()->add(
                    "variants.{$index}.attributes",
                    'Each variant attribute must have a name and a value without square brackets.',
                );

                continue;
            }

            $normalized = ProductVariant::normalizeAttributes($attributes);

            if ($name === '' && $normalized === []) {
                $validator->errors()->add(
                    "variants.{$index}.name",
                    'Enter a variant name.',
                );

                continue;
            }

            $identity = ProductVariant::identityKey($name, $normalized);

            if (isset($identities[$identity])) {
                $errorKey = $name !== '' ? "variants.{$index}.name" : "variants.{$index}.attributes";

                $validator->errors()->add($errorKey, 'This variant is duplicated.');
            }

            $identities[$identity] = true;

            $sku = trim((string) ($variant['sku'] ?? ''));

            if ($sku !== '') {
                if (isset($skus[$sku])) {
                    $validator->errors()->add(
                        "variants.{$index}.sku",
                        'The SKU is duplicated in this product.',
                    );
                }

                $skus[$sku] = true;
            }

            $retail = $variant['retail_price'] ?? null;
            $discount = $variant['discount_price'] ?? null;

            if ($retail !== null && $discount !== null && (int) $discount > (int) $retail) {
                $validator->errors()->add(
                    "variants.{$index}.discount_price",
                    'The discount price must not be greater than the retail price.',
                );
            }
        }
    }
}
