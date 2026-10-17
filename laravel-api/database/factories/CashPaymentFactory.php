<?php

namespace Database\Factories;

use App\Enums\PaymentStatus;
use App\Models\CashPayment;
use App\Models\Delivery;
use App\Models\Order;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<CashPayment>
 */
class CashPaymentFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * Full COD payment only in MVP: amount_remaining is derived from
     * amount_due minus amount_collected.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'order_id' => Order::factory(),
            'delivery_id' => null,
            'receipt_number' => 'RCP-'.fake()->unique()->numerify('######'),
            'amount_due' => 10000,
            'amount_collected' => 0,
            'amount_remaining' => fn (array $attributes): int => (int) $attributes['amount_due'] - (int) $attributes['amount_collected'],
            'received_by' => null,
            'collected_at' => null,
            'customer_name' => fake()->name(),
            'customer_signature_path' => null,
            'receipt_file_path' => null,
            'note' => null,
            'status' => PaymentStatus::NOT_PAID->value,
        ];
    }

    /**
     * Attach the payment to the given order.
     */
    public function forOrder(Order $order): static
    {
        return $this->state(fn (array $attributes) => [
            'order_id' => $order->id,
            'amount_due' => $order->total_amount,
            'amount_remaining' => $order->total_amount - (int) $attributes['amount_collected'],
            'customer_name' => $order->customer_name,
        ]);
    }

    /**
     * Attach the payment to the delivery during which cash was collected.
     */
    public function forDelivery(Delivery $delivery): static
    {
        return $this->state(fn (array $attributes) => [
            'delivery_id' => $delivery->id,
        ]);
    }

    /**
     * Indicate that the full COD amount has been confirmed.
     */
    public function confirmed(): static
    {
        return $this->state(fn (array $attributes) => [
            'amount_collected' => (int) $attributes['amount_due'],
            'amount_remaining' => 0,
            'status' => PaymentStatus::PAYMENT_CONFIRMED->value,
            'collected_at' => now(),
            'received_by' => fake()->name(),
        ]);
    }

    /**
     * Indicate that the cash is still waiting to be collected.
     */
    public function pending(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => PaymentStatus::CASH_COLLECTION_PENDING->value,
        ]);
    }
}
