<?php

namespace Database\Factories;

use App\Enums\QuotationVersionStatus;
use App\Models\Admin;
use App\Models\Quotation;
use App\Models\QuotationRequest;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Quotation>
 */
class QuotationFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        // The money fields default to zero so a quotation created without
        // item rows still satisfies total_amount = subtotal - discount +
        // delivery_fee + service_fee. A non-zero total must be backed by
        // quotation_version_items, so use priced() with real line items.
        return [
            'quotation_request_id' => QuotationRequest::factory(),
            'quotation_number' => 'QT-'.fake()->unique()->numerify('######'),
            'version' => 1,
            'status' => QuotationVersionStatus::DRAFT->value,
            'is_current' => false,
            'subtotal' => 0,
            'discount' => 0,
            'delivery_fee' => 0,
            'service_fee_percentage' => 0,
            'service_fee' => 0,
            'total_amount' => 0,
            'payment_method' => 'CASH_ON_DELIVERY',
            'payment_terms' => 'Full payment on delivery (COD).',
            'valid_until' => now()->addDays(7)->toDateString(),
            'admin_note' => null,
            'created_by_admin_id' => Admin::factory(),
        ];
    }

    /**
     * Indicate that the quotation version has been sent to the customer.
     */
    public function sent(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => QuotationVersionStatus::SENT->value,
            'is_current' => true,
            'sent_at' => now(),
        ]);
    }

    /**
     * Indicate that the customer has opened the sent quotation version.
     */
    public function viewed(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => QuotationVersionStatus::VIEWED->value,
            'is_current' => true,
            'sent_at' => now()->subDay(),
            'viewed_at' => now(),
        ]);
    }

    /**
     * Indicate that the customer requested a change to this version.
     */
    public function changeRequested(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => QuotationVersionStatus::CHANGE_REQUESTED->value,
            'is_current' => true,
            'sent_at' => now()->subDays(2),
            'viewed_at' => now()->subDay(),
        ]);
    }

    /**
     * Indicate that the customer accepted this version.
     */
    public function accepted(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => QuotationVersionStatus::ACCEPTED->value,
            'is_current' => true,
            'sent_at' => now()->subDays(3),
            'viewed_at' => now()->subDays(2),
            'accepted_at' => now()->subDay(),
        ]);
    }

    /**
     * Indicate that the customer rejected this version.
     */
    public function rejected(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => QuotationVersionStatus::REJECTED->value,
            'is_current' => true,
            'sent_at' => now()->subDays(3),
            'viewed_at' => now()->subDays(2),
            'rejected_at' => now()->subDay(),
        ]);
    }

    /**
     * Indicate that this version expired before the customer acted.
     */
    public function expired(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => QuotationVersionStatus::EXPIRED->value,
            'is_current' => true,
            'sent_at' => now()->subDays(10),
            'viewed_at' => now()->subDays(9),
            'valid_until' => now()->subDays(1)->toDateString(),
        ]);
    }

    /**
     * Indicate that a newer version replaced this one.
     */
    public function superseded(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => QuotationVersionStatus::SUPERSEDED->value,
            'is_current' => false,
            'sent_at' => now()->subDays(5),
            'viewed_at' => now()->subDays(4),
        ]);
    }

    /**
     * Attach coherent header totals to the quotation version.
     *
     * The subtotal must equal the sum of the version item line_totals.
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
