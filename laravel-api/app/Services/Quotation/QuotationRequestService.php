<?php

namespace App\Services\Quotation;

use App\Enums\ProductStatus;
use App\Enums\StockStatus;
use App\Models\Customer;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\QuotationItem;
use App\Models\QuotationRequest;
use App\Services\Notification\NotificationService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Creates a customer quotation request together with its original
 * immutable item snapshots (LogicFlow §5).
 *
 * `quotation_requests.customer_id` always comes from the authenticated
 * Customer and never from client input. Contact and delivery fields are
 * snapshotted exactly as submitted; product data is snapshotted from the
 * source product at insert time and never refreshed afterwards.
 */
class QuotationRequestService
{
    public function __construct(
        private readonly QuotationNumberGenerator $quotationNumbers,
        private readonly NotificationService $notifications,
    ) {}

    /**
     * Persist the quotation request and all item snapshots atomically.
     *
     * `items` is the FormRequest-validated list: each element carries only
     * `product_id`, optional `variant_id`, and `quantity`; every other item
     * field is derived server-side.
     *
     * @param  array<string, mixed>  $data
     */
    public function submit(Customer $customer, array $data): QuotationRequest
    {
        $request = DB::transaction(function () use ($customer, $data): QuotationRequest {
            // quotation_number is NOT NULL, so the row is first persisted
            // with a unique placeholder and immediately re-keyed to the
            // id-derived number inside the same transaction.
            $request = QuotationRequest::create([
                'quotation_number' => Str::uuid()->toString(),
                'customer_id' => $customer->id,
                'customer_name' => $data['name'],
                'company_name' => $data['company_name'] ?? null,
                'phone' => $data['phone'],
                'email' => $data['email'] ?? null,
                'delivery_address' => $data['delivery_address'],
                'city' => $data['city'],
                'township' => $data['township'] ?? null,
                'landmark' => $data['landmark'] ?? null,
                'required_delivery_date' => $data['required_delivery_date'] ?? null,
                'customer_note' => $data['customer_note'] ?? null,
            ]);

            $request->update(['quotation_number' => $this->quotationNumbers->generate($request)]);

            $products = Product::query()
                ->with(['prices', 'stock', 'variants'])
                ->whereIn('id', collect($data['items'])->pluck('product_id'))
                ->get()
                ->keyBy('id');

            foreach ($data['items'] as $index => $item) {
                $product = $products->get($item['product_id']);

                if ($product === null) {
                    throw ValidationException::withMessages([
                        "items.{$index}.product_id" => 'The selected product is no longer available.',
                    ]);
                }

                $variantId = isset($item['variant_id']) ? (int) $item['variant_id'] : null;
                $variant = $variantId !== null
                    ? $product->variants->firstWhere('id', $variantId)
                    : null;

                // The request already validated this, but re-check inside the
                // transaction so a concurrent variant removal cannot silently
                // fall back to the parent product.
                if ($variantId !== null && $variant === null) {
                    throw ValidationException::withMessages([
                        "items.{$index}.variant_id" => 'The selected variant is no longer available.',
                    ]);
                }

                if ($variant !== null && $variant->stock_status === StockStatus::OUT_OF_STOCK) {
                    throw ValidationException::withMessages([
                        "items.{$index}.variant_id" => 'The selected variant is out of stock.',
                    ]);
                }

                if ($product->status !== ProductStatus::PUBLISHED) {
                    throw ValidationException::withMessages([
                        "items.{$index}.product_id" => 'The selected product is no longer available.',
                    ]);
                }

                if ($variant === null && $product->stock?->stock_status === StockStatus::OUT_OF_STOCK) {
                    throw ValidationException::withMessages([
                        "items.{$index}.product_id" => 'The selected product is out of stock.',
                    ]);
                }

                QuotationItem::create([
                    'quotation_request_id' => $request->id,
                    'product_id' => $product->id,
                    'supplier_id' => $product->supplier_id,
                    'product_name_snapshot' => $product->name_en ?? $product->name_mm,
                    'specification_snapshot' => $this->specificationSnapshot($product, $variant),
                    'quantity' => (int) $item['quantity'],
                    'display_price' => $variant !== null
                        ? $this->variantDisplayPrice($variant)
                        : $this->displayPrice($product),
                    'stock_status' => $variant !== null
                        ? $variant->stock_status
                        : $product->stock?->stock_status,
                ]);
            }

            return $request->refresh();
        });

        $this->notifications->quotationRequested($request, $customer);

        return $request;
    }

    /**
     * The single unit price used for catalog display, from the product's
     * price row: the discount when it is a real discount (positive and
     * smaller than the retail price), otherwise the retail price. When the
     * product has no price row at all it stays null so the quotation
     * version pipeline prices it later.
     */
    private function displayPrice(Product $product): ?int
    {
        $price = $product->prices->first();

        if ($price === null) {
            return null;
        }

        $retail = (int) $price->retail_price;
        $discount = $price->discount_price !== null ? (int) $price->discount_price : null;

        if ($discount !== null && $discount > 0 && $discount < $retail) {
            return $discount;
        }

        return $retail;
    }

    /**
     * The display price for one variant, using the same discount rule.
     */
    private function variantDisplayPrice(ProductVariant $variant): ?int
    {
        if ($variant->retail_price === null) {
            return null;
        }

        $retail = (int) $variant->retail_price;
        $discount = $variant->discount_price !== null ? (int) $variant->discount_price : null;

        if ($discount !== null && $discount > 0 && $discount < $retail) {
            return $discount;
        }

        return $retail;
    }

    /**
     * Keep the chosen variant visible to admins by appending its attribute
     * label to the product specification snapshot.
     */
    private function specificationSnapshot(Product $product, ?ProductVariant $variant): ?string
    {
        $specification = trim((string) $product->specification);

        if ($variant === null) {
            return $specification !== '' ? $specification : null;
        }

        $label = trim((string) $variant->name);

        if ($label === '') {
            $label = collect($variant->variant_attributes ?? [])
                ->map(fn ($value, $name): string => "{$name}: {$value}")
                ->implode(', ');
        }

        if ($label === '') {
            return $specification !== '' ? $specification : null;
        }

        return $specification !== ''
            ? $specification."\nVariant: ".$label
            : 'Variant: '.$label;
    }
}
