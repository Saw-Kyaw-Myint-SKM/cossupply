<?php

namespace Database\Factories;

use App\Enums\StockStatus;
use App\Models\Product;
use App\Models\QuotationItem;
use App\Models\QuotationRequest;
use App\Models\Supplier;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<QuotationItem>
 */
class QuotationItemFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'quotation_request_id' => QuotationRequest::factory(),
            'product_id' => Product::factory(),
            'supplier_id' => Supplier::factory(),
            'product_name_snapshot' => fake()->words(3, true),
            'specification_snapshot' => fake()->sentence(),
            'quantity' => fake()->numberBetween(1, 20),
            'display_price' => fake()->numberBetween(1000, 100000),
            'stock_status' => StockStatus::IN_STOCK->value,
        ];
    }

    /**
     * Attach the item to the given quotation request.
     */
    public function forRequest(QuotationRequest $request): static
    {
        return $this->state(fn (array $attributes) => [
            'quotation_request_id' => $request->id,
        ]);
    }

    /**
     * Snapshot the given product and its own supplier.
     */
    public function forProduct(Product $product): static
    {
        return $this->state(fn (array $attributes) => [
            'product_id' => $product->id,
            'supplier_id' => $product->supplier_id,
            'product_name_snapshot' => $product->name_en ?? $product->name_mm,
            'specification_snapshot' => $product->specification,
        ]);
    }
}
