<?php

namespace Database\Factories;

use App\Models\Admin;
use App\Models\Product;
use App\Models\ProductPrice;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ProductPrice>
 */
class ProductPriceFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * product_prices has no created_at/updated_at pair; last_updated_at
     * records the last price change instead.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'product_id' => Product::factory(),
            'retail_price' => fake()->numberBetween(1000, 100000),
            'wholesale_price' => null,
            'discount_price' => null,
            'minimum_order_quantity' => 1,
            'price_valid_until' => null,
            'last_updated_at' => now(),
            'updated_by_admin_id' => Admin::factory(),
        ];
    }

    /**
     * Indicate that the price has a wholesale tier.
     */
    public function wholesale(): static
    {
        return $this->state(fn (array $attributes) => [
            'wholesale_price' => fake()->numberBetween(500, 50000),
        ]);
    }

    /**
     * Indicate that the price is discounted.
     */
    public function discounted(): static
    {
        return $this->state(function (array $attributes) {
            $retail = (int) ($attributes['retail_price'] ?? 10000);

            return [
                'discount_price' => (int) floor($retail * 0.9),
            ];
        });
    }
}
