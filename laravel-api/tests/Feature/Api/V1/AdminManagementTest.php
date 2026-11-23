<?php

namespace Tests\Feature\Api\V1;

use App\Models\Admin;
use App\Models\AuditLog;
use App\Models\QuotationRequest;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_super_admin_can_create_an_admin_user(): void
    {
        $this->actingAsSuperAdmin();

        $response = $this->postJson('/api/v1/admin/admin-users', [
            'name' => 'New Staff',
            'email' => 'staff@example.com',
            'phone' => '09123456789',
            'password' => 'secret-password',
            'role' => 'admin',
            'status' => 'active',
        ]);

        $response->assertCreated()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.admin_user.email', 'staff@example.com')
            ->assertJsonPath('data.admin_user.role', 'admin')
            ->assertJsonPath('data.admin_user.status', 'active');

        $this->assertArrayNotHasKey('password', $response->json('data.admin_user'));
        $this->assertDatabaseHas('admins', ['email' => 'staff@example.com', 'role' => 'admin']);
        $this->assertTrue(
            Hash::check('secret-password', Admin::query()->where('email', 'staff@example.com')->sole()->password),
        );
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'admin.created',
            'entity_type' => 'admin',
        ]);
    }

    public function test_admin_user_validation_rules_apply(): void
    {
        $this->actingAsSuperAdmin();

        Admin::factory()->create(['email' => 'taken@example.com']);

        $this->postJson('/api/v1/admin/admin-users', [
            'name' => '',
            'email' => 'taken@example.com',
            'password' => 'short',
            'role' => 'owner',
            'status' => 'archived',
        ])->assertUnprocessable()->assertJsonValidationErrors([
            'name',
            'email',
            'password',
            'role',
            'status',
        ]);
    }

    public function test_regular_admin_is_forbidden_from_every_admin_user_route(): void
    {
        $this->actingAsAdmin();
        $target = Admin::factory()->create();

        $this->getJson('/api/v1/admin/admin-users')->assertForbidden();
        $this->postJson('/api/v1/admin/admin-users', [])->assertForbidden();
        $this->getJson("/api/v1/admin/admin-users/{$target->id}")->assertForbidden();
        $this->patchJson("/api/v1/admin/admin-users/{$target->id}", [])->assertForbidden();
        $this->patchJson("/api/v1/admin/admin-users/{$target->id}/password", [])->assertForbidden();
        $this->deleteJson("/api/v1/admin/admin-users/{$target->id}")->assertForbidden();

        $this->assertDatabaseHas('admins', ['id' => $target->id, 'role' => 'admin']);
        $this->assertDatabaseMissing('audit_logs', ['entity_type' => 'admin']);
    }

    public function test_admin_user_list_supports_filters_and_pagination(): void
    {
        $this->actingAsSuperAdmin();

        Admin::factory()->count(3)->create();
        Admin::factory()->superAdmin()->create(['name' => 'Zeta Super', 'email' => 'zeta@example.com']);
        Admin::factory()->inactive()->create(['name' => 'Inactive Person']);

        $this->getJson('/api/v1/admin/admin-users?role=super_admin&search=Zeta&per_page=1')
            ->assertOk()
            ->assertJsonCount(1, 'data.admin_users')
            ->assertJsonPath('data.meta.total', 1)
            ->assertJsonPath('data.meta.per_page', 1)
            ->assertJsonStructure(['data' => ['admin_users', 'meta' => ['current_page', 'per_page', 'total', 'last_page']]]);

        $this->getJson('/api/v1/admin/admin-users?status=inactive')
            ->assertOk()
            ->assertJsonCount(1, 'data.admin_users');

        $this->getJson('/api/v1/admin/admin-users?per_page=101')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['per_page']);

        $this->getJson('/api/v1/admin/admin-users?role=owner')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['role']);
    }

    public function test_super_admin_can_update_an_admin_user(): void
    {
        $this->actingAsSuperAdmin();
        $target = Admin::factory()->create();

        $this->patchJson("/api/v1/admin/admin-users/{$target->id}", [
            'name' => 'Renamed Staff',
            'role' => 'super_admin',
            'status' => 'inactive',
        ])->assertOk()
            ->assertJsonPath('data.admin_user.name', 'Renamed Staff')
            ->assertJsonPath('data.admin_user.role', 'super_admin')
            ->assertJsonPath('data.admin_user.status', 'inactive');

        $this->assertDatabaseHas('admins', ['id' => $target->id, 'name' => 'Renamed Staff']);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'admin.updated',
            'entity_type' => 'admin',
            'entity_id' => (string) $target->id,
        ]);
    }

    public function test_password_is_not_updatable_through_the_update_endpoint(): void
    {
        $this->actingAsSuperAdmin();
        $target = Admin::factory()->create(['password' => Hash::make('original-password')]);

        $this->patchJson("/api/v1/admin/admin-users/{$target->id}", [
            'name' => 'Still Named',
            'password' => 'hijacked-password',
        ])->assertOk();

        $target->refresh();

        $this->assertSame('Still Named', $target->name);
        $this->assertTrue(Hash::check('original-password', $target->password));
        $this->assertFalse(Hash::check('hijacked-password', $target->password));
    }

    public function test_super_admin_can_reset_another_admins_password(): void
    {
        $actor = $this->actingAsSuperAdmin();
        $actor->createToken('actor-session', ['admin']);
        $target = Admin::factory()->create(['password' => Hash::make('old-password')]);
        $target->createToken('session', ['admin']);

        $this->patchJson("/api/v1/admin/admin-users/{$target->id}/password", [
            'password' => 'brand-new-password',
        ])->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.admin_user.email', $target->email);

        $target->refresh();

        $this->assertTrue(Hash::check('brand-new-password', $target->password));
        $this->assertSame(0, $target->tokens()->count(), 'Existing sessions should be revoked.');
        $this->assertSame(1, $actor->tokens()->count(), 'The acting admin keeps their session.');

        $log = AuditLog::query()->where('action', 'admin.password_reset')->sole();

        $this->assertSame((string) $target->id, $log->entity_id);
        $this->assertSame('***', $log->new_data['password']);
        $this->assertStringNotContainsString('brand-new-password', json_encode($log->new_data));
    }

    public function test_password_reset_requires_a_long_enough_password(): void
    {
        $this->actingAsSuperAdmin();
        $target = Admin::factory()->create();

        $this->patchJson("/api/v1/admin/admin-users/{$target->id}/password", [
            'password' => 'short',
        ])->assertUnprocessable()->assertJsonValidationErrors(['password']);
    }

    public function test_admin_cannot_delete_their_own_account(): void
    {
        $actor = $this->actingAsSuperAdmin();

        $this->deleteJson("/api/v1/admin/admin-users/{$actor->id}")
            ->assertStatus(409)
            ->assertJsonPath('success', false);

        $this->assertDatabaseHas('admins', ['id' => $actor->id]);
    }

    public function test_super_admin_cannot_demote_the_last_super_admin(): void
    {
        $actor = $this->actingAsSuperAdmin();

        $this->patchJson("/api/v1/admin/admin-users/{$actor->id}", ['role' => 'admin'])
            ->assertStatus(409)
            ->assertJsonPath('success', false);

        $this->assertSame('super_admin', $actor->fresh()->role);
    }

    public function test_admin_assigned_to_quotation_requests_cannot_be_deleted(): void
    {
        $this->actingAsSuperAdmin();
        $target = Admin::factory()->create();
        QuotationRequest::factory()->create(['assigned_admin_id' => $target->id]);

        $this->deleteJson("/api/v1/admin/admin-users/{$target->id}")
            ->assertStatus(409)
            ->assertJsonPath('success', false);

        $this->assertDatabaseHas('admins', ['id' => $target->id]);
    }

    public function test_super_admin_can_delete_an_unreferenced_admin_user(): void
    {
        $this->actingAsSuperAdmin();
        $target = Admin::factory()->create();

        $this->deleteJson("/api/v1/admin/admin-users/{$target->id}")
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->assertDatabaseMissing('admins', ['id' => $target->id]);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'admin.deleted',
            'entity_type' => 'admin',
            'entity_id' => (string) $target->id,
        ]);
    }

    public function test_admin_who_created_records_cannot_be_deleted(): void
    {
        $this->actingAsSuperAdmin();
        $target = Admin::factory()->create();

        // The audit trail itself references the account.
        AuditLog::factory()->create(['admin_id' => $target->id]);

        $this->deleteJson("/api/v1/admin/admin-users/{$target->id}")
            ->assertStatus(409)
            ->assertJsonPath('success', false);

        $this->assertDatabaseHas('admins', ['id' => $target->id]);
    }

    private function actingAsSuperAdmin(): Admin
    {
        $admin = Admin::factory()->superAdmin()->create();
        Sanctum::actingAs($admin, ['admin']);

        return $admin;
    }

    private function actingAsAdmin(): Admin
    {
        $admin = Admin::factory()->create();
        Sanctum::actingAs($admin, ['admin']);

        return $admin;
    }
}
