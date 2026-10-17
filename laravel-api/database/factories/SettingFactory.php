<?php

namespace Database\Factories;

use App\Models\Setting;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Setting>
 */
class SettingFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'key' => fake()->unique()->slug(2),
            'value' => '1',
            'value_type' => 'string',
            'group_name' => 'general',
            'label' => fake()->words(2, true),
            'description' => fake()->sentence(),
            'is_public' => false,
            'updated_by_admin_id' => null,
        ];
    }

    /**
     * Indicate that the setting may be exposed publicly.
     */
    public function public(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_public' => true,
        ]);
    }
}
