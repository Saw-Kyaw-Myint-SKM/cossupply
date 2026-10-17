<?php

namespace Database\Factories;

use App\Models\Product;
use App\Models\Quotation;
use App\Models\QuotationVersionItem;
use App\Models\Supplier;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<QuotationVersionItem>
 */
class QuotationVersionItemFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * line_total is derived from quantity, unit_price and discount so the
     * row always reconciles with the quotation header subtotal.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'quotation_id' => Quotation::factory(),
            'product_id' => Product::factory(),
            'supplier_id' => Supplier::factory(),
            'product_name_snapshot' => fake()->words(3, true),
            'sku_snapshot' => strtoupper(fake()->bothify('SKU-####-??')),
            'specification_snapshot' => fake()->sentence(),
            'quantity' => fake()->numberBetween(1, 20),
            'unit_price' => fake()->numberBetween(1000, 100000),
            'discount' => 0,
            'line_total' => fn (array $attributes): int => (int) $attributes['quantity'] * (int) $attributes['unit_price'] - (int) ($attributes['discount'] ?? 0),
            'delivery_date' => null,
            'warranty_note' => null,
            'supplier_note' => null,
        ];
    }

    /**
     * Attach the item to the given quotation version.
     */
    public function forQuotation(Quotation $quotation): static
    {
        return $this->state(fn (array $attributes) => [
            'quotation_id' => $quotation->id,
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
            'sku_snapshot' => $product->sku,
            'specification_snapshot' => $product->specification,
        ]);
    }

    /**
     * Indicate that the item carries a line discount.
     */
    public function withDiscount(int $discount): static
    {
        return $this->state(fn (array $attributes) => [
            'discount' => $discount,
            'line_total' => (int) $attributes['quantity'] * (int) $attributes['unit_price'] - $discount,
        ]);
    }
}
