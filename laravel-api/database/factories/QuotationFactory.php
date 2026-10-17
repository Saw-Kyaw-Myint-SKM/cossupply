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
        return [
            'quotation_request_id' => QuotationRequest::factory(),
            'quotation_number' => 'QT-'.fake()->unique()->numerify('######'),
            'version' => 1,
            'status' => QuotationVersionStatus::DRAFT->value,
            'is_current' => false,
            'subtotal' => 1000,
            'discount' => 0,
            'delivery_fee' => 0,
            'service_fee_percentage' => 0,
            'service_fee' => 0,
            'total_amount' => 1000,
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
}
