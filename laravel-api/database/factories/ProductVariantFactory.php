<?php

namespace Database\Factories;

use App\Enums\StockStatus;
use App\Models\Admin;
use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<ProductVariant>
 */
class ProductVariantFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $attributes = [
            'Color' => fake()->colorName(),
            'Size' => fake()->randomElement(['S', 'M', 'L', 'XL']),
        ];

        $suffix = Str::slug(implode('-', $attributes)).'-'.fake()->unique()->numberBetween(1000, 99999);

        return [
            'product_id' => Product::factory(),
            'name' => collect($attributes)->map(fn ($value, $name) => "{$name}: {$value}")->implode(', '),
            'variant_attributes' => $attributes,
            'attributes_key' => $suffix,
            'slug' => $suffix,
            'sku' => strtoupper(fake()->unique()->bothify('VAR-####-??')),
            'photo' => null,
            'retail_price' => fake()->numberBetween(1000, 50000),
            'wholesale_price' => null,
            'discount_price' => null,
            'minimum_order_quantity' => 1,
            'price_valid_until' => null,
            'price_updated_at' => now(),
            'price_updated_by_admin_id' => Admin::factory(),
            'stock_quantity' => fake()->numberBetween(0, 100),
            'stock_status' => StockStatus::IN_STOCK,
            'stock_confirmed_at' => now(),
            'stock_confirmed_by_admin_id' => Admin::factory(),
            'supplier_note' => null,
            'sort_order' => 0,
        ];
    }
}
