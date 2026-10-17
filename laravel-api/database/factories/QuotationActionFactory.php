<?php

namespace Database\Factories;

use App\Enums\QuotationAction as QuotationActionEnum;
use App\Models\Admin;
use App\Models\Customer;
use App\Models\Quotation;
use App\Models\QuotationAction;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<QuotationAction>
 */
class QuotationActionFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * actor_id is a plain nullable id because the actor may be a customer
     * or an admin (different tables).
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'quotation_id' => Quotation::factory(),
            'action' => QuotationActionEnum::VIEWED->value,
            'customer_note' => null,
            'actor_type' => 'CUSTOMER',
            'actor_id' => null,
            'ip_address' => fake()->ipv4(),
            'created_at' => now(),
        ];
    }

    /**
     * Record the action as performed by the given customer.
     */
    public function byCustomer(Customer $customer): static
    {
        return $this->state(fn (array $attributes) => [
            'actor_type' => 'CUSTOMER',
            'actor_id' => $customer->id,
        ]);
    }

    /**
     * Record the action as performed by the given admin.
     */
    public function byAdmin(Admin $admin): static
    {
        return $this->state(fn (array $attributes) => [
            'actor_type' => 'ADMIN',
            'actor_id' => $admin->id,
        ]);
    }

    /**
     * Indicate that the customer accepted the quotation version.
     */
    public function accepted(): static
    {
        return $this->state(fn (array $attributes) => [
            'action' => QuotationActionEnum::ACCEPTED->value,
        ]);
    }

    /**
     * Indicate that the customer rejected the quotation version.
     */
    public function rejected(): static
    {
        return $this->state(fn (array $attributes) => [
            'action' => QuotationActionEnum::REJECTED->value,
        ]);
    }

    /**
     * Indicate that the customer requested a change.
     */
    public function requestedChange(): static
    {
        return $this->state(fn (array $attributes) => [
            'action' => QuotationActionEnum::REQUESTED_CHANGE->value,
        ]);
    }
}
