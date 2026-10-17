<?php

namespace Database\Factories;

use App\Enums\SupplierStatus;
use App\Models\Admin;
use App\Models\Supplier;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Supplier>
 */
class SupplierFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'shop_name' => fake()->unique()->company(),
            'company_name' => fake()->company(),
            'contact_person' => fake()->name(),
            'phone' => fake()->unique()->numerify('09#########'),
            'viber_phone' => fake()->numerify('09#########'),
            'email' => fake()->unique()->safeEmail(),
            'logo' => null,
            'address' => fake()->streetAddress(),
            'city' => fake()->randomElement(['Yangon', 'Mandalay', 'Naypyidaw']),
            'township' => fake()->citySuffix(),
            'business_description' => fake()->sentence(),
            'delivery_area' => fake()->city(),
            'delivery_time' => fake()->randomElement(['1-2 days', '3-5 days']),
            'warranty_policy' => fake()->sentence(),
            'return_policy' => fake()->sentence(),
            'status' => SupplierStatus::ACTIVE,
            'verified' => false,
            'created_by_admin_id' => Admin::factory(),
        ];
    }

    /**
     * Indicate that the supplier is active.
     */
    public function active(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => SupplierStatus::ACTIVE,
        ]);
    }

    /**
     * Indicate that the supplier is inactive.
     */
    public function inactive(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => SupplierStatus::INACTIVE,
        ]);
    }

    /**
     * Indicate that the supplier is suspended.
     */
    public function suspended(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => SupplierStatus::SUSPENDED,
        ]);
    }

    /**
     * Indicate that the supplier is verified.
     */
    public function verified(): static
    {
        return $this->state(fn (array $attributes) => [
            'verified' => true,
        ]);
    }
}
