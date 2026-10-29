<?php

namespace App\Http\Requests\Api\V1;

use App\Models\Product;
use App\Rules\PhoneNumber;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreQuotationRequestRequest extends FormRequest
{
    /**
     * Route access is enforced by the auth:sanctum + customer middleware.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * Only `product_id` and `quantity` are accepted per item; every other
     * snapshot field is derived server-side. A body `customer_id` is never
     * read: identity is taken from the authenticated customer.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer', Rule::exists('products', 'id')],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['required', 'string', 'max:50', new PhoneNumber],
            'company_name' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'city' => ['required', 'string', 'max:100'],
            'township' => ['nullable', 'string', 'max:100'],
            'delivery_address' => ['required', 'string', 'max:2000'],
            'landmark' => ['nullable', 'string', 'max:255'],
            'required_delivery_date' => ['nullable', 'date', 'after_or_equal:today'],
            'customer_note' => ['nullable', 'string', 'max:2000'],
        ];
    }

    /**
     * Per-item business rules (MoneyAndValidationRules §5), keyed under
     * `items.{index}.*` so the client can locate the offending cart item:
     *
     * - the product must be PUBLISHED and not OUT_OF_STOCK (same rule as
     *   `Product::availableForCart()` / the public catalog);
     * - the quantity must be at least the product's minimum order
     *   quantity (default 1);
     * - a product may appear only once in the request: a duplicate is
     *   rejected with 422 (contract decision, see api_doc.md).
     *
     * The whole request is rejected: nothing is persisted.
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                $items = $this->input('items');

                if (! is_array($items)) {
                    return;
                }

                $seenProductIds = [];

                foreach ($items as $index => $item) {
                    if (! is_array($item)) {
                        continue;
                    }

                    $productKey = "items.{$index}.product_id";
                    $quantityKey = "items.{$index}.quantity";

                    // Structural validation already failed for this item.
                    if ($validator->errors()->has($productKey) || $validator->errors()->has($quantityKey)) {
                        continue;
                    }

                    $productId = (int) $item['product_id'];

                    if (in_array($productId, $seenProductIds, true)) {
                        $validator->errors()->add(
                            $productKey,
                            'The product appears more than once in the request.',
                        );

                        continue;
                    }

                    $seenProductIds[] = $productId;

                    $product = Product::query()
                        ->with(['prices', 'stock'])
                        ->availableForCart()
                        ->whereKey($productId)
                        ->first();

                    if ($product === null) {
                        $validator->errors()->add(
                            $productKey,
                            'The selected product is not available for quotation requests.',
                        );
                        $validator->errors()->add(
                            "items.{$index}",
                            'The product is currently unavailable: it is not published or out of stock.',
                        );

                        continue;
                    }

                    $minimum = (int) ($product->prices->first()?->minimum_order_quantity ?? 1);

                    if ((int) $item['quantity'] < $minimum) {
                        $validator->errors()->add(
                            $quantityKey,
                            "The quantity must be at least {$minimum} for the selected product.",
                        );
                    }
                }
            },
        ];
    }
}
