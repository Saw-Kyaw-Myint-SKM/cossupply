<?php

namespace Database\Factories;

use App\Enums\DeliveryStatus;
use App\Models\Delivery;
use App\Models\Order;
use App\Models\Supplier;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Delivery>
 */
class DeliveryFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * MVP supports full delivery only; partial delivery is not modelled.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'order_id' => Order::factory(),
            'supplier_id' => Supplier::factory(),
            'delivery_contact_name' => fake()->name(),
            'delivery_phone' => fake()->numerify('09#########'),
            'delivery_address' => fake()->address(),
            'city' => 'Yangon',
            'township' => fake()->randomElement(['Hlaing', 'Mayangone', 'Sanchaung']),
            'landmark' => null,
            'delivery_fee' => 0,
            'delivery_partner' => fake()->randomElement(['CoSupply Logistics', 'Royal Express']),
            'tracking_number' => strtoupper(fake()->bothify('TRK-####??')),
            'estimated_delivery_date' => now()->addDays(3)->toDateString(),
            'shipped_at' => null,
            'delivered_at' => null,
            'received_by' => null,
            'customer_note' => null,
            'delivery_status' => DeliveryStatus::NOT_ASSIGNED->value,
        ];
    }

    /**
     * Attach the delivery to the given order.
     */
    public function forOrder(Order $order): static
    {
        return $this->state(fn (array $attributes) => [
            'order_id' => $order->id,
            'delivery_address' => $order->delivery_address,
            'city' => $order->city,
            'township' => $order->township,
            'landmark' => $order->landmark,
            'delivery_fee' => $order->delivery_fee,
        ]);
    }

    /**
     * Indicate that the order is being prepared for delivery.
     */
    public function preparing(): static
    {
        return $this->state(fn (array $attributes) => [
            'delivery_status' => DeliveryStatus::PREPARING->value,
        ]);
    }

    /**
     * Indicate that the parcel is on the way.
     */
    public function outForDelivery(): static
    {
        return $this->state(fn (array $attributes) => [
            'delivery_status' => DeliveryStatus::OUT_FOR_DELIVERY->value,
            'shipped_at' => now()->subDay(),
        ]);
    }

    /**
     * Indicate that the parcel has been delivered.
     */
    public function delivered(): static
    {
        return $this->state(fn (array $attributes) => [
            'delivery_status' => DeliveryStatus::DELIVERED->value,
            'shipped_at' => now()->subDays(2),
            'delivered_at' => now(),
            'received_by' => fake()->name(),
        ]);
    }
}
