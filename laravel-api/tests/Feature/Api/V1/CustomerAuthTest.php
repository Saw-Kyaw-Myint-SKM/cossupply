<?php

namespace Tests\Feature\Api\V1;

use App\Models\Customer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class CustomerAuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_can_register_with_valid_data(): void
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'Aung Aung',
            'phone' => '09123456789',
            'email' => 'aung@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ]);

        $response->assertCreated()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.user.phone', '09123456789')
            ->assertJsonPath('data.user.status', 'active')
            ->assertJsonStructure(['data' => ['user' => ['id', 'name', 'phone', 'email', 'customer_type', 'status'], 'token']]);

        $this->assertDatabaseHas('customers', [
            'phone' => '09123456789',
            'status' => 'active',
            'customer_type' => 'individual',
        ]);

        $customer = Customer::query()->where('phone', '09123456789')->sole();
        $this->assertNotSame('password123', $customer->password);
        $this->assertTrue(Hash::check('password123', $customer->password));
    }

    public function test_registration_accepts_common_phone_formatting(): void
    {
        $this->postJson('/api/v1/auth/register', [
            'name' => 'Formatted Phone',
            'phone' => '09-770-100-200',
            'email' => 'formatted@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ])->assertCreated();

        $this->postJson('/api/v1/auth/register', [
            'name' => 'International Phone',
            'phone' => '+95 9 770 100 200',
            'email' => 'international@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ])->assertCreated();

        $this->assertDatabaseHas('customers', ['phone' => '09-770-100-200']);
        $this->assertDatabaseHas('customers', ['phone' => '+95 9 770 100 200']);
    }

    public function test_registration_rejects_malformed_phone_numbers(): void
    {
        foreach (['not-a-phone', '12345', '1234567890123456'] as $index => $phone) {
            $this->postJson('/api/v1/auth/register', [
                'name' => 'Bad Phone',
                'phone' => $phone,
                'email' => "bad{$index}@example.com",
                'password' => 'password123',
                'password_confirmation' => 'password123',
            ])->assertUnprocessable()->assertJsonValidationErrors(['phone']);
        }
    }

    public function test_registration_requires_valid_and_unique_fields(): void
    {
        Customer::factory()->create(['phone' => '09999999999']);

        $this->postJson('/api/v1/auth/register', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name', 'phone', 'email', 'password']);

        $this->postJson('/api/v1/auth/register', [
            'name' => 'Duplicate Phone',
            'phone' => '09999999999',
            'email' => 'not-an-email',
            'password' => 'short',
            'password_confirmation' => 'mismatch',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['phone', 'email', 'password']);
    }

    public function test_customer_can_log_in_with_valid_credentials(): void
    {
        $customer = Customer::factory()->create([
            'phone' => '09123456789',
            'email' => 'buyer@example.com',
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'buyer@example.com',
            'password' => 'password',
        ]);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.user.id', $customer->id)
            ->assertJsonStructure(['data' => ['user', 'token']]);
    }

    public function test_customer_login_email_is_case_insensitive(): void
    {
        $customer = Customer::factory()->create(['email' => 'buyer@example.com']);

        $this->postJson('/api/v1/auth/login', [
            'email' => 'BUYER@Example.com',
            'password' => 'password',
        ])->assertOk()
            ->assertJsonPath('data.user.id', $customer->id);
    }

    public function test_customer_login_fails_with_invalid_credentials(): void
    {
        Customer::factory()->create(['email' => 'buyer@example.com']);

        $this->postJson('/api/v1/auth/login', [
            'email' => 'buyer@example.com',
            'password' => 'wrong-password',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);

        $this->postJson('/api/v1/auth/login', [
            'email' => 'nobody@example.com',
            'password' => 'password',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);
    }

    public function test_phone_is_no_longer_a_login_identifier(): void
    {
        Customer::factory()->create(['phone' => '09123456789', 'email' => null]);

        $this->postJson('/api/v1/auth/login', [
            'email' => '09123456789',
            'password' => 'password',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);
    }

    public function test_suspended_customer_cannot_log_in(): void
    {
        Customer::factory()->suspended()->create(['email' => 'buyer@example.com']);

        $this->postJson('/api/v1/auth/login', [
            'email' => 'buyer@example.com',
            'password' => 'password',
        ])->assertForbidden();
    }

    public function test_customer_can_fetch_own_profile(): void
    {
        $customer = Customer::factory()->create(['phone' => '09123456789']);
        $token = $customer->createToken('customer-token', ['customer'])->plainTextToken;

        $this->withToken($token)
            ->getJson('/api/v1/auth/user')
            ->assertOk()
            ->assertJsonPath('data.user.id', $customer->id)
            ->assertJsonPath('data.user.phone', '09123456789');
    }

    public function test_guest_cannot_access_protected_customer_routes(): void
    {
        $this->getJson('/api/v1/auth/user')->assertUnauthorized();
        $this->postJson('/api/v1/auth/logout')->assertUnauthorized();
    }

    public function test_customer_can_log_out_and_token_is_revoked(): void
    {
        $customer = Customer::factory()->create(['phone' => '09123456789']);
        $token = $customer->createToken('customer-token', ['customer'])->plainTextToken;

        $this->assertDatabaseCount('personal_access_tokens', 1);

        $this->withToken($token)
            ->postJson('/api/v1/auth/logout')
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->assertDatabaseCount('personal_access_tokens', 0);

        // The test application caches the resolved guard user between
        // requests; forget it so the revoked token is re-evaluated.
        $this->app['auth']->forgetGuards();

        $this->withToken($token)
            ->getJson('/api/v1/auth/user')
            ->assertUnauthorized();
    }

    public function test_password_is_never_returned_from_auth_endpoints(): void
    {
        $register = $this->postJson('/api/v1/auth/register', [
            'name' => 'Aung Aung',
            'phone' => '09123456789',
            'email' => 'aung@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ]);

        $register->assertCreated()->assertJsonMissingPath('data.user.password');

        $login = $this->postJson('/api/v1/auth/login', [
            'email' => 'aung@example.com',
            'password' => 'password123',
        ]);

        $login->assertOk()->assertJsonMissingPath('data.user.password');

        $me = $this->withToken($login->json('data.token'))->getJson('/api/v1/auth/user');

        $me->assertOk()->assertJsonMissingPath('data.user.password');
    }
}
