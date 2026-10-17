<?php

namespace Database\Factories;

use App\Enums\DeliveryStatus;
use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Models\Order;
use App\Models\Quotation;
use App\Models\QuotationRequest;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Order>
 */
class OrderFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * The quotation request and customer default to the same records the
     * quotation version belongs to so the order snapshot stays coherent.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'order_number' => 'ORD-'.fake()->unique()->numerify('######'),
            'quotation_id' => Quotation::factory(),
            'quotation_request_id' => fn (array $attributes) => Quotation::query()
                ->findOrFail($attributes['quotation_id'])
                ->quotation_request_id,
            'customer_id' => fn (array $attributes) => QuotationRequest::query()
                ->findOrFail($attributes['quotation_request_id'])
                ->customer_id,
            'customer_name' => fake()->name(),
            'company_name' => null,
            'phone' => fake()->numerify('09#########'),
            'email' => fake()->safeEmail(),
            'delivery_address' => fake()->address(),
            'city' => 'Yangon',
            'township' => 'Hlaing',
            'landmark' => null,
            // The money fields default to zero so an order created without
            // item rows still satisfies total_amount = subtotal - discount
            // + delivery_fee + service_fee. Use priced() together with real
            // order_items for a non-zero total.
            'subtotal' => 0,
            'discount' => 0,
            'delivery_fee' => 0,
            'service_fee_percentage' => 0,
            'service_fee' => 0,
            'total_amount' => 0,
            'payment_method' => 'CASH_ON_DELIVERY',
            'payment_status' => PaymentStatus::NOT_PAID->value,
            'order_status' => OrderStatus::SUPPLIER_CONFIRMATION_REQUIRED->value,
            'delivery_status' => DeliveryStatus::NOT_ASSIGNED->value,
            'customer_note' => null,
        ];
    }

    /**
     * Indicate that the order is fully completed.
     */
    public function completed(): static
    {
        return $this->state(fn (array $attributes) => [
            'order_status' => OrderStatus::COMPLETED->value,
            'payment_status' => PaymentStatus::PAYMENT_CONFIRMED->value,
            'delivery_status' => DeliveryStatus::DELIVERED->value,
        ]);
    }

    /**
     * Attach coherent header totals to the order.
     *
     * The subtotal must equal the sum of the order item line_totals.
     */
    public function priced(
        int $subtotal,
        int $discount = 0,
        int $deliveryFee = 0,
        int $serviceFeePercentage = 0,
    ): static {
        $serviceFee = intdiv($subtotal * $serviceFeePercentage, 100);

        return $this->state(fn (array $attributes) => [
            'subtotal' => $subtotal,
            'discount' => $discount,
            'delivery_fee' => $deliveryFee,
            'service_fee_percentage' => $serviceFeePercentage,
            'service_fee' => $serviceFee,
            'total_amount' => $subtotal - $discount + $deliveryFee + $serviceFee,
        ]);
    }
}
