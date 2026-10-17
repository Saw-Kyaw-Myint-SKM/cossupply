<?php

namespace Database\Factories;

use App\Models\Category;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Category>
 */
class CategoryFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $nameEn = fake()->unique()->words(2, true);

        return [
            'parent_id' => null,
            'name_mm' => $nameEn,
            'name_en' => $nameEn,
            'slug' => Str::slug($nameEn).'-'.fake()->unique()->numberBetween(1000, 99999),
            'description' => fake()->sentence(),
            'image' => null,
            'sort_order' => fake()->numberBetween(0, 100),
            'status' => Category::STATUS_ACTIVE,
        ];
    }

    /**
     * Indicate that the category is inactive.
     */
    public function inactive(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => Category::STATUS_INACTIVE,
        ]);
    }

    /**
     * Indicate that the category is a child of the given category.
     */
    public function childOf(Category $parent): static
    {
        return $this->state(fn (array $attributes) => [
            'parent_id' => $parent->id,
        ]);
    }
}
