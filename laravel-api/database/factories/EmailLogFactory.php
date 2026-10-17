<?php

namespace Database\Factories;

use App\Models\EmailLog;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<EmailLog>
 */
class EmailLogFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'recipient_email' => fake()->safeEmail(),
            'related_type' => 'App\\Models\\Quotation',
            'related_id' => 1,
            'email_type' => 'QUOTATION_SENT',
            'subject' => fake()->sentence(4),
            'status' => 'SENT',
            'sent_at' => now(),
            'error_message' => null,
        ];
    }

    /**
     * Indicate that the email was delivered.
     */
    public function sent(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'SENT',
            'sent_at' => now(),
            'error_message' => null,
        ]);
    }

    /**
     * Indicate that the email delivery failed.
     */
    public function failed(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'FAILED',
            'sent_at' => null,
            'error_message' => fake()->sentence(),
        ]);
    }
}
