<?php

namespace Tests\Feature\Api\V1;

use App\Models\Admin;
use App\Models\Customer;
use App\Models\CustomerAddress;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CustomerProfileAddressTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array{0: Customer, 1: string}
     */
    private function authenticate(array $customerAttributes = []): array
    {
        $customer = Customer::factory()->create($customerAttributes);
        $token = $customer->createToken('customer-token', ['customer'])->plainTextToken;

        return [$customer, $token];
    }

    /**
     * @return array<string, mixed>
     */
    private function addressPayload(array $overrides = []): array
    {
        return array_merge([
            'contact_name' => 'Kyaw Kyaw',
            'phone' => '0987654321',
            'city' => 'Yangon',
            'township' => 'Bahan',
            'ward' => '9',
            'street' => 'University Avenue',
            'building_no' => 'No. 45',
            'landmark' => 'Opposite the park',
            'full_address' => 'No. 45, University Avenue, 9 Ward, Bahan, Yangon',
            'is_default' => false,
        ], $overrides);
    }

    public function test_guest_cannot_access_any_profile_or_address_route(): void
    {
        $id = CustomerAddress::factory()->create()->id;

        $this->getJson('/api/v1/customer/profile')->assertUnauthorized();
        $this->putJson('/api/v1/customer/profile', ['name' => 'X'])->assertUnauthorized();
        $this->getJson('/api/v1/customer/addresses')->assertUnauthorized();
        $this->postJson('/api/v1/customer/addresses', $this->addressPayload())->assertUnauthorized();
        $this->getJson("/api/v1/customer/addresses/{$id}")->assertUnauthorized();
        $this->putJson("/api/v1/customer/addresses/{$id}", $this->addressPayload())->assertUnauthorized();
        $this->deleteJson("/api/v1/customer/addresses/{$id}")->assertUnauthorized();
    }

    public function test_admin_token_cannot_access_any_profile_or_address_route(): void
    {
        $admin = Admin::factory()->create();
        $token = $admin->createToken('admin-token', ['admin'])->plainTextToken;
        $id = CustomerAddress::factory()->create()->id;

        $this->withToken($token)->getJson('/api/v1/customer/profile')->assertForbidden();
        $this->withToken($token)->putJson('/api/v1/customer/profile', ['name' => 'X'])->assertForbidden();
        $this->withToken($token)->getJson('/api/v1/customer/addresses')->assertForbidden();
        $this->withToken($token)->postJson('/api/v1/customer/addresses', $this->addressPayload())->assertForbidden();
        $this->withToken($token)->getJson("/api/v1/customer/addresses/{$id}")->assertForbidden();
        $this->withToken($token)->putJson("/api/v1/customer/addresses/{$id}", $this->addressPayload())->assertForbidden();
        $this->withToken($token)->deleteJson("/api/v1/customer/addresses/{$id}")->assertForbidden();
    }

    public function test_customer_can_view_own_profile_without_password(): void
    {
        [$customer, $token] = $this->authenticate();

        $response = $this->withToken($token)->getJson('/api/v1/customer/profile');

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.customer.id', $customer->id)
            ->assertJsonPath('data.customer.phone', $customer->phone)
            ->assertJsonStructure([
                'data' => ['customer' => ['id', 'name', 'company_name', 'email', 'phone', 'customer_type', 'status', 'created_at']],
            ]);

        $this->assertStringNotContainsString('password', $response->content());
    }

    public function test_customer_cannot_change_phone_through_profile_update(): void
    {
        [$customer, $token] = $this->authenticate(['phone' => '09111111111']);

        $response = $this->withToken($token)->putJson('/api/v1/customer/profile', [
            'name' => 'Updated Name',
            'company_name' => 'Updated Company',
            'email' => 'updated@example.com',
            // Login identifier: silently ignored, never changed.
            'phone' => '09222222222',
        ]);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.customer.name', 'Updated Name')
            ->assertJsonPath('data.customer.company_name', 'Updated Company')
            ->assertJsonPath('data.customer.email', 'updated@example.com')
            ->assertJsonPath('data.customer.phone', '09111111111');

        $this->assertDatabaseHas('customers', [
            'id' => $customer->id,
            'phone' => '09111111111',
        ]);
    }

    public function test_profile_update_validates_email_uniqueness(): void
    {
        [$customer, $token] = $this->authenticate(['email' => 'mine@example.com']);
        Customer::factory()->create(['email' => 'taken@example.com']);

        $this->withToken($token)->putJson('/api/v1/customer/profile', ['name' => 'Name', 'email' => 'taken@example.com'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);

        // Re-submitting the customer's own email stays valid.
        $this->withToken($token)->putJson('/api/v1/customer/profile', ['name' => 'Name', 'email' => 'mine@example.com'])
            ->assertOk();
    }

    public function test_first_address_is_automatically_the_default(): void
    {
        [$customer, $token] = $this->authenticate();

        $response = $this->withToken($token)->postJson('/api/v1/customer/addresses', $this->addressPayload());

        $response->assertCreated()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.address.is_default', true);

        $this->assertDatabaseHas('customer_addresses', [
            'customer_id' => $customer->id,
            'is_default' => true,
        ]);
    }

    public function test_second_address_without_explicit_default_does_not_steal_the_default(): void
    {
        [$customer, $token] = $this->authenticate();

        $this->withToken($token)->postJson('/api/v1/customer/addresses', $this->addressPayload(['township' => 'Bahan']))
            ->assertCreated();
        $second = $this->withToken($token)->postJson('/api/v1/customer/addresses', $this->addressPayload(['township' => 'Insein']))
            ->assertCreated()
            ->assertJsonPath('data.address.is_default', false);

        $this->assertSame(2, CustomerAddress::query()->where('customer_id', $customer->id)->count());
        $this->assertSame(1, CustomerAddress::query()->where('customer_id', $customer->id)->where('is_default', true)->count());
        $this->assertSame(
            [$second->json('data.address.id')],
            CustomerAddress::query()->where('customer_id', $customer->id)->where('is_default', false)->pluck('id')->all(),
        );
    }

    public function test_marking_an_address_default_demotes_the_previous_default(): void
    {
        [$customer, $token] = $this->authenticate();

        $first = $this->withToken($token)->postJson('/api/v1/customer/addresses', $this->addressPayload())
            ->assertCreated()->json('data.address.id');
        $second = $this->withToken($token)->postJson('/api/v1/customer/addresses', $this->addressPayload(['township' => 'Insein']))
            ->assertCreated()->json('data.address.id');

        $this->withToken($token)->putJson("/api/v1/customer/addresses/{$second}", $this->addressPayload(['is_default' => true]))
            ->assertOk()
            ->assertJsonPath('data.address.is_default', true);

        $defaults = CustomerAddress::query()->where('customer_id', $customer->id)->where('is_default', true)->pluck('id')->all();
        $this->assertSame([$second], $defaults, 'At most one default per customer.');

        $this->assertDatabaseHas('customer_addresses', ['id' => $first, 'is_default' => false]);
    }

    public function test_address_list_orders_default_first_then_newest(): void
    {
        [$customer, $token] = $this->authenticate();

        $first = $this->withToken($token)->postJson('/api/v1/customer/addresses', $this->addressPayload())
            ->assertCreated()->json('data.address.id');
        $second = $this->withToken($token)->postJson('/api/v1/customer/addresses', $this->addressPayload(['township' => 'Insein']))
            ->assertCreated()->json('data.address.id');
        $third = $this->withToken($token)->postJson('/api/v1/customer/addresses', $this->addressPayload(['township' => 'Mayangone']))
            ->assertCreated()->json('data.address.id');

        $response = $this->withToken($token)->getJson('/api/v1/customer/addresses');

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonStructure(['data' => ['addresses', 'meta' => ['current_page', 'per_page', 'total', 'last_page']]]);

        $this->assertSame([$first, $third, $second], collect($response->json('data.addresses'))->pluck('id')->all());
    }

    public function test_foreign_or_unknown_address_ids_answer_404(): void
    {
        [$customer, $token] = $this->authenticate();

        $foreignCustomer = Customer::factory()->create();
        $foreign = CustomerAddress::factory()->create(['customer_id' => $foreignCustomer->id]);

        $this->withToken($token)->getJson("/api/v1/customer/addresses/{$foreign->id}")->assertNotFound();
        $this->withToken($token)->putJson("/api/v1/customer/addresses/{$foreign->id}", $this->addressPayload())->assertNotFound();
        $this->withToken($token)->deleteJson("/api/v1/customer/addresses/{$foreign->id}")->assertNotFound();
        $this->withToken($token)->getJson('/api/v1/customer/addresses/999999')->assertNotFound();

        // The foreign address is untouched.
        $this->assertDatabaseHas('customer_addresses', ['id' => $foreign->id, 'contact_name' => CustomerAddress::find($foreign->id)->contact_name]);
    }

    public function test_phone_is_required_for_addresses(): void
    {
        [$customer, $token] = $this->authenticate();

        $payload = $this->addressPayload();
        unset($payload['phone']);

        $this->withToken($token)->postJson('/api/v1/customer/addresses', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['phone']);

        $this->assertDatabaseCount('customer_addresses', 0);
    }

    public function test_deleting_the_default_address_promotes_the_newest_remaining(): void
    {
        [$customer, $token] = $this->authenticate();

        $first = $this->withToken($token)->postJson('/api/v1/customer/addresses', $this->addressPayload())
            ->assertCreated()->json('data.address.id');
        $second = $this->withToken($token)->postJson('/api/v1/customer/addresses', $this->addressPayload(['township' => 'Insein']))
            ->assertCreated()->json('data.address.id');

        $this->withToken($token)->deleteJson("/api/v1/customer/addresses/{$first}")
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->assertDatabaseMissing('customer_addresses', ['id' => $first]);
        $this->assertDatabaseHas('customer_addresses', ['id' => $second, 'is_default' => true]);
    }

    public function test_deleting_the_only_address_leaves_no_default(): void
    {
        [$customer, $token] = $this->authenticate();

        $only = $this->withToken($token)->postJson('/api/v1/customer/addresses', $this->addressPayload())
            ->assertCreated()->json('data.address.id');

        $this->withToken($token)->deleteJson("/api/v1/customer/addresses/{$only}")->assertOk();

        $this->assertSame(0, CustomerAddress::query()->where('customer_id', $customer->id)->count());
        $this->assertSame(0, CustomerAddress::query()->where('customer_id', $customer->id)->where('is_default', true)->count());
    }
}
