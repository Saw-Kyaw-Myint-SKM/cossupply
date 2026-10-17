<?php

namespace Database\Factories;

use App\Enums\StockStatus;
use App\Models\Product;
use App\Models\ProductStock;
use App\Models\Supplier;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ProductStock>
 */
class ProductStockFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'product_id' => Product::factory(),
            'supplier_id' => Supplier::factory(),
            'stock_quantity' => fake()->numberBetween(0, 500),
            'stock_status' => StockStatus::IN_STOCK,
            'last_confirmed_at' => now(),
            'confirmed_by_admin_id' => null,
            'supplier_note' => null,
        ];
    }

    /**
     * Attach the stock row to the supplier of the given product.
     */
    public function forProduct(Product $product): static
    {
        return $this->state(fn (array $attributes) => [
            'product_id' => $product->id,
            'supplier_id' => $product->supplier_id,
        ]);
    }

    /**
     * Indicate that the product is in stock.
     */
    public function inStock(): static
    {
        return $this->state(fn (array $attributes) => [
            'stock_status' => StockStatus::IN_STOCK,
        ]);
    }

    /**
     * Indicate that the product is out of stock.
     */
    public function outOfStock(): static
    {
        return $this->state(fn (array $attributes) => [
            'stock_status' => StockStatus::OUT_OF_STOCK,
            'stock_quantity' => 0,
        ]);
    }

    /**
     * Indicate that supplier confirmation is still required.
     */
    public function supplierConfirmationRequired(): static
    {
        return $this->state(fn (array $attributes) => [
            'stock_status' => StockStatus::SUPPLIER_CONFIRMATION_REQUIRED,
        ]);
    }
}
