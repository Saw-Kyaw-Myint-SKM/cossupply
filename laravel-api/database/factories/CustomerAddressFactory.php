<?php

namespace Database\Factories;

use App\Models\Customer;
use App\Models\CustomerAddress;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<CustomerAddress>
 */
class CustomerAddressFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'customer_id' => Customer::factory(),
            'contact_name' => fake()->name(),
            'phone' => fake()->numerify('09#########'),
            'city' => 'Yangon',
            'township' => fake()->randomElement(['Hlaing', 'Mayangone', 'Sanchaung']),
            'ward' => fake()->numerify('##'),
            'street' => fake()->streetName(),
            'building_no' => fake()->buildingNumber(),
            'landmark' => null,
            'full_address' => fake()->address(),
            'is_default' => false,
        ];
    }

    /**
     * Attach the address to the given customer.
     */
    public function forCustomer(Customer $customer): static
    {
        return $this->state(fn (array $attributes) => [
            'customer_id' => $customer->id,
            'contact_name' => $customer->name,
            'phone' => $customer->phone,
        ]);
    }

    /**
     * Indicate that the address is the customer's default one.
     */
    public function default(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_default' => true,
        ]);
    }
}
