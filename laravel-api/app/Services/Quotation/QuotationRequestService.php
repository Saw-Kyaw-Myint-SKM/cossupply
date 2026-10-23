<?php

namespace App\Services\Quotation;

use App\Models\Customer;
use App\Models\Product;
use App\Models\QuotationItem;
use App\Models\QuotationRequest;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

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
    ) {}

    /**
     * Persist the quotation request and all item snapshots atomically.
     *
     * `items` is the FormRequest-validated list: each element carries only
     * `product_id` and `quantity`; every other item field is derived
     * server-side.
     *
     * @param  array<string, mixed>  $data
     */
    public function submit(Customer $customer, array $data): QuotationRequest
    {
        return DB::transaction(function () use ($customer, $data): QuotationRequest {
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
                ->with(['prices', 'stock'])
                ->availableForCart()
                ->whereIn('id', collect($data['items'])->pluck('product_id'))
                ->get()
                ->keyBy('id');

            foreach ($data['items'] as $item) {
                $product = $products[$item['product_id']];

                QuotationItem::create([
                    'quotation_request_id' => $request->id,
                    'product_id' => $product->id,
                    'supplier_id' => $product->supplier_id,
                    'product_name_snapshot' => $product->name_en ?? $product->name_mm,
                    'specification_snapshot' => $product->specification,
                    'quantity' => (int) $item['quantity'],
                    'display_price' => $this->displayPrice($product),
                    'stock_status' => $product->stock?->stock_status,
                ]);
            }

            return $request->refresh();
        });
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
}
