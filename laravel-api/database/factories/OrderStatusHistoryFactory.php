<?php

namespace Database\Factories;

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\OrderStatusHistory;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<OrderStatusHistory>
 */
class OrderStatusHistoryFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * Append-only status trail: only created_at exists.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'order_id' => Order::factory(),
            'old_status' => null,
            'new_status' => OrderStatus::SUPPLIER_CONFIRMATION_REQUIRED->value,
            'changed_by_type' => 'SYSTEM',
            'changed_by_id' => null,
            'note' => null,
            'created_at' => now(),
        ];
    }

    /**
     * Attach the trail row to the given order.
     */
    public function forOrder(Order $order): static
    {
        return $this->state(fn (array $attributes) => [
            'order_id' => $order->id,
        ]);
    }

    /**
     * Indicate that the status was changed by an admin.
     */
    public function byAdmin(int $adminId): static
    {
        return $this->state(fn (array $attributes) => [
            'changed_by_type' => 'ADMIN',
            'changed_by_id' => $adminId,
        ]);
    }
}
