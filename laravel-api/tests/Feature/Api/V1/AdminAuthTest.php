<?php

namespace Tests\Feature\Api\V1;

use App\Models\Admin;
use App\Models\Customer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminAuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_log_in_with_valid_credentials(): void
    {
        $admin = Admin::factory()->create([
            'email' => 'admin@example.com',
        ]);

        $response = $this->postJson('/api/v1/admin/login', [
            'email' => 'admin@example.com',
            'password' => 'password',
        ]);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.admin.email', 'admin@example.com')
            ->assertJsonStructure(['data' => ['admin' => ['id', 'name', 'email', 'role', 'status'], 'token']]);

        $this->assertNotNull($admin->fresh()->last_login_at);
    }

    public function test_admin_login_fails_with_invalid_credentials(): void
    {
        Admin::factory()->create(['email' => 'admin@example.com']);

        $this->postJson('/api/v1/admin/login', [
            'email' => 'admin@example.com',
            'password' => 'wrong-password',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);

        $this->postJson('/api/v1/admin/login', [
            'email' => 'missing@example.com',
            'password' => 'password',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);
    }

    public function test_inactive_admin_cannot_log_in(): void
    {
        Admin::factory()->inactive()->create(['email' => 'inactive@example.com']);

        $this->postJson('/api/v1/admin/login', [
            'email' => 'inactive@example.com',
            'password' => 'password',
        ])->assertForbidden();
    }

    public function test_admin_can_fetch_own_profile_and_log_out(): void
    {
        $admin = Admin::factory()->create(['email' => 'admin@example.com']);

        $login = $this->postJson('/api/v1/admin/login', [
            'email' => 'admin@example.com',
            'password' => 'password',
        ]);

        $login->assertOk();
        $token = $login->json('data.token');

        $this->withToken($token)
            ->getJson('/api/v1/admin/user')
            ->assertOk()
            ->assertJsonPath('data.admin.id', $admin->id)
            ->assertJsonMissingPath('data.admin.password');

        $this->withToken($token)
            ->postJson('/api/v1/admin/logout')
            ->assertOk();

        $this->assertDatabaseCount('personal_access_tokens', 0);

        // The test application caches the resolved guard user between
        // requests; forget it so the revoked token is re-evaluated.
        $this->app['auth']->forgetGuards();

        $this->withToken($token)
            ->getJson('/api/v1/admin/user')
            ->assertUnauthorized();
    }

    public function test_guest_cannot_access_protected_admin_routes(): void
    {
        $this->getJson('/api/v1/admin/user')->assertUnauthorized();
        $this->postJson('/api/v1/admin/logout')->assertUnauthorized();
    }

    public function test_customer_token_cannot_access_admin_routes(): void
    {
        $customer = Customer::factory()->create();
        $token = $customer->createToken('customer-token', ['customer'])->plainTextToken;

        $this->withToken($token)
            ->getJson('/api/v1/admin/user')
            ->assertForbidden();
    }

    public function test_admin_token_cannot_access_customer_routes(): void
    {
        $admin = Admin::factory()->create();
        $token = $admin->createToken('admin-token', ['admin'])->plainTextToken;

        $this->withToken($token)
            ->getJson('/api/v1/auth/user')
            ->assertForbidden();
    }
}
