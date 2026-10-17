<?php

namespace Database\Factories;

use App\Models\Admin;
use App\Models\AuditLog;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<AuditLog>
 */
class AuditLogFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * Append-only audit trail: only created_at exists.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'admin_id' => Admin::factory(),
            'action' => 'setting.updated',
            'entity_type' => 'setting',
            'entity_id' => '1',
            'old_data' => [],
            'new_data' => [],
            'ip_address' => fake()->ipv4(),
            'created_at' => now(),
        ];
    }

    /**
     * Record an audit event against a catalog entity.
     */
    public function forEntity(string $entityType, string|int $entityId): static
    {
        return $this->state(fn (array $attributes) => [
            'entity_type' => $entityType,
            'entity_id' => (string) $entityId,
        ]);
    }
}
