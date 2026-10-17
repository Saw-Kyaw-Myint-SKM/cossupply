<?php

namespace Database\Factories;

use App\Models\Customer;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;

/**
 * @extends Factory<Customer>
 */
class CustomerFactory extends Factory
{
    /**
     * The current password being used by the factory.
     */
    protected static ?string $password;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            'company_name' => null,
            'email' => fake()->unique()->safeEmail(),
            'phone' => fake()->unique()->numerify('09#########'),
            'password' => static::$password ??= Hash::make('password'),
            'customer_type' => 'individual',
            'status' => 'active',
            'email_verified_at' => null,
            'phone_verified_at' => null,
        ];
    }

    /**
     * Indicate that the customer is suspended.
     */
    public function suspended(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'suspended',
        ]);
    }

    /**
     * Indicate that the customer is a business customer.
     */
    public function business(): static
    {
        return $this->state(fn (array $attributes) => [
            'company_name' => fake()->company(),
            'customer_type' => 'business',
        ]);
    }
}
