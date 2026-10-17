<?php

namespace Database\Factories;

use App\Models\Admin;
use App\Models\QuotationRequest;
use App\Models\Supplier;
use App\Models\SupplierCommunication;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<SupplierCommunication>
 */
class SupplierCommunicationFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * Append-only log: only created_at exists, so no updated_at is set.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'quotation_request_id' => QuotationRequest::factory(),
            'supplier_id' => Supplier::factory(),
            'admin_id' => Admin::factory(),
            'contact_method' => fake()->randomElement(['VIBER', 'PHONE', 'EMAIL']),
            'message_text' => fake()->sentence(),
            'supplier_response' => null,
            'attachment_path' => null,
            'contacted_at' => now()->subDay(),
            'responded_at' => null,
            'created_at' => now()->subDay(),
        ];
    }

    /**
     * Indicate that the supplier has answered the message.
     */
    public function responded(): static
    {
        return $this->state(fn (array $attributes) => [
            'supplier_response' => fake()->sentence(),
            'responded_at' => now()->subHours(6),
        ]);
    }

    /**
     * Indicate that the supplier has not answered yet.
     */
    public function pending(): static
    {
        return $this->state(fn (array $attributes) => [
            'supplier_response' => null,
            'responded_at' => null,
        ]);
    }
}
