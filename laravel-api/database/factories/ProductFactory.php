<?php

namespace Database\Factories;

use App\Enums\ProductStatus;
use App\Models\Admin;
use App\Models\Category;
use App\Models\Product;
use App\Models\ProductPrice;
use App\Models\ProductStock;
use App\Models\Supplier;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Product>
 */
class ProductFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $nameEn = fake()->unique()->words(3, true);

        return [
            'supplier_id' => Supplier::factory(),
            'category_id' => Category::factory(),
            'name_mm' => $nameEn,
            'name_en' => $nameEn,
            'slug' => Str::slug($nameEn).'-'.fake()->unique()->numberBetween(1000, 99999),
            'sku' => strtoupper(fake()->unique()->bothify('SKU-####-??')),
            'brand' => fake()->company(),
            'model' => strtoupper(fake()->bothify('MDL-####')),
            'description' => fake()->paragraph(),
            'specification' => fake()->sentence(),
            'size' => fake()->randomElement(['S', 'M', 'L', 'XL']),
            'color' => fake()->colorName(),
            'unit' => fake()->randomElement(['pcs', 'box', 'pack']),
            'package_size' => '1',
            'photo' => 'products/placeholder.jpg',
            'status' => ProductStatus::DRAFT,
            'created_by_admin_id' => Admin::factory(),
        ];
    }

    /**
     * Indicate that the product is published.
     */
    public function published(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => ProductStatus::PUBLISHED,
        ]);
    }

    /**
     * Indicate that the product is hidden.
     */
    public function hidden(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => ProductStatus::HIDDEN,
        ]);
    }

    /**
     * Indicate that the product status is out of stock.
     */
    public function outOfStock(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => ProductStatus::OUT_OF_STOCK,
        ]);
    }

    /**
     * Attach a price row to the product.
     *
     * @param  array<string, mixed>  $attributes
     */
    public function withPrice(array $attributes = []): static
    {
        return $this->has(
            ProductPrice::factory()->state($attributes),
            'prices',
        );
    }

    /**
     * Attach a stock row to the product.
     *
     * @param  array<string, mixed>  $attributes
     */
    public function withStock(array $attributes = []): static
    {
        return $this->has(
            ProductStock::factory()->state($attributes),
            'stock',
        );
    }
}
