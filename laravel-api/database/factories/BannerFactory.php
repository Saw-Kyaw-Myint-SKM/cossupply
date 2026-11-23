<?php

namespace Database\Factories;

use App\Models\Banner;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Banner>
 */
class BannerFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'title_mm' => fake()->sentence(3),
            'title_en' => fake()->sentence(3),
            'subtitle_mm' => fake()->sentence(5),
            'subtitle_en' => fake()->sentence(5),
            'cta_label_mm' => 'ယခုဝယ်ရန်',
            'cta_label_en' => 'Shop now',
            'link_url' => '/products',
            'image' => 'banners/'.fake()->unique()->uuid().'.jpg',
            'sort_order' => fake()->numberBetween(0, 10),
            'status' => Banner::STATUS_ACTIVE,
            'background_style' => fake()->randomElement(Banner::BACKGROUND_STYLES),
        ];
    }

    /**
     * Indicate that the banner is hidden from the storefront.
     */
    public function inactive(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => Banner::STATUS_INACTIVE,
        ]);
    }
}
