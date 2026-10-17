<?php

namespace Database\Factories;

use App\Models\Admin;
use App\Models\Customer;
use App\Models\Notification;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Notification>
 */
class NotificationFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * recipient_id is derived from the recipient relation so it always
     * matches recipient_type.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'recipient_type' => 'CUSTOMER',
            'customer_id' => Customer::factory(),
            'recipient_id' => fn (array $attributes): int => (int) $attributes['customer_id'],
            'admin_id' => null,
            'quotation_id' => null,
            'order_id' => null,
            'type' => 'QUOTATION_SENT',
            'title' => 'Quotation ready',
            'message' => fake()->sentence(),
            'data' => ['source' => 'demo'],
            'is_read' => false,
            'read_at' => null,
        ];
    }

    /**
     * Target a customer recipient.
     */
    public function forCustomer(Customer $customer): static
    {
        return $this->state(fn (array $attributes) => [
            'recipient_type' => 'CUSTOMER',
            'recipient_id' => $customer->id,
            'customer_id' => $customer->id,
            'admin_id' => null,
        ]);
    }

    /**
     * Target an admin recipient.
     */
    public function forAdmin(Admin $admin): static
    {
        return $this->state(fn (array $attributes) => [
            'recipient_type' => 'ADMIN',
            'recipient_id' => $admin->id,
            'admin_id' => $admin->id,
            'customer_id' => null,
        ]);
    }

    /**
     * Indicate that the notification has been read.
     */
    public function read(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_read' => true,
            'read_at' => now(),
        ]);
    }
}
