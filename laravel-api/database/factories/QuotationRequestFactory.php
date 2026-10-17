<?php

namespace Database\Factories;

use App\Enums\QuotationRequestStatus;
use App\Models\Customer;
use App\Models\QuotationRequest;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<QuotationRequest>
 */
class QuotationRequestFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'quotation_number' => 'QT-'.fake()->unique()->numerify('######'),
            'customer_id' => Customer::factory(),
            'customer_name' => fake()->name(),
            'company_name' => null,
            'phone' => fake()->numerify('09#########'),
            'email' => fake()->safeEmail(),
            'delivery_address' => fake()->address(),
            'city' => 'Yangon',
            'township' => 'Hlaing',
            'landmark' => null,
            'required_delivery_date' => now()->addDays(7)->toDateString(),
            'customer_note' => null,
            'status' => QuotationRequestStatus::NEW->value,
            'assigned_admin_id' => null,
        ];
    }

    /**
     * Indicate that the request has been cancelled.
     */
    public function cancelled(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => QuotationRequestStatus::CANCELLED->value,
        ]);
    }
}
