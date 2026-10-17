<?php

namespace Tests\Feature\Api\V1;

use App\Models\Admin;
use App\Models\AuditLog;
use App\Models\Supplier;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminSupplierTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');
    }

    public function test_admin_can_create_supplier_with_defaults_and_logo(): void
    {
        $admin = $this->actingAsAdmin();

        $response = $this->post('/api/v1/admin/suppliers', [
            'shop_name' => 'Mandalay Office Supply',
            'company_name' => 'Mandalay Office Supply Co., Ltd.',
            'contact_person' => 'Daw Mya',
            'phone' => '09123456789',
            'viber_phone' => '09987654321',
            'email' => 'sales@example.com',
            'address' => 'No. 12, 35th Street',
            'city' => 'Mandalay',
            'township' => 'Chan Aye Thar Zan',
            'logo' => UploadedFile::fake()->image('logo.jpg'),
        ], ['Accept' => 'application/json']);

        $response->assertCreated()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.supplier.status', 'ACTIVE')
            ->assertJsonPath('data.supplier.verified', false)
            ->assertJsonPath('data.supplier.created_by_admin_id', $admin->id);

        $path = $response->json('data.supplier.logo');

        $this->assertIsString($path);
        $this->assertStringStartsWith('suppliers/logos/', $path);
        Storage::disk('public')->assertExists($path);
        $this->assertSame(url(Storage::disk('public')->url($path)), $response->json('data.supplier.logo_url'));

        $this->assertDatabaseHas('suppliers', [
            'shop_name' => 'Mandalay Office Supply',
            'status' => 'ACTIVE',
            'verified' => false,
            'created_by_admin_id' => $admin->id,
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'supplier.created',
            'entity_type' => 'supplier',
        ]);
    }

    public function test_supplier_create_requires_shop_name_contact_person_phone_address_and_city(): void
    {
        $this->actingAsAdmin();

        $this->postJson('/api/v1/admin/suppliers', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['shop_name', 'contact_person', 'phone', 'address', 'city']);
    }

    public function test_admin_can_update_supplier_status_and_verified_with_audit(): void
    {
        $this->actingAsAdmin();

        $supplier = Supplier::factory()->create(['status' => 'ACTIVE', 'verified' => false]);

        $this->patchJson("/api/v1/admin/suppliers/{$supplier->id}", [
            'status' => 'SUSPENDED',
            'verified' => true,
        ])->assertOk()
            ->assertJsonPath('data.supplier.status', 'SUSPENDED')
            ->assertJsonPath('data.supplier.verified', true);

        $this->assertDatabaseHas('suppliers', [
            'id' => $supplier->id,
            'status' => 'SUSPENDED',
            'verified' => true,
        ]);

        $log = AuditLog::query()->where('action', 'supplier.updated')->sole();

        $this->assertSame('ACTIVE', $log->old_data['status']);
        $this->assertFalse($log->old_data['verified']);
        $this->assertSame('SUSPENDED', $log->new_data['status']);
        $this->assertTrue($log->new_data['verified']);
    }

    public function test_supplier_update_rejects_invalid_status(): void
    {
        $this->actingAsAdmin();

        $supplier = Supplier::factory()->create();

        $this->patchJson("/api/v1/admin/suppliers/{$supplier->id}", ['status' => 'DISABLED'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['status']);
    }

    public function test_supplier_logo_replacement_removes_the_old_file(): void
    {
        $this->actingAsAdmin();

        $supplier = Supplier::factory()->create(['logo' => 'suppliers/logos/old-logo.jpg']);
        Storage::disk('public')->put('suppliers/logos/old-logo.jpg', 'old contents');

        $response = $this->post("/api/v1/admin/suppliers/{$supplier->id}", [
            '_method' => 'PATCH',
            'logo' => UploadedFile::fake()->image('new-logo.png'),
        ], ['Accept' => 'application/json']);

        $response->assertOk();

        $newPath = $response->json('data.supplier.logo');

        $this->assertStringStartsWith('suppliers/logos/', $newPath);
        Storage::disk('public')->assertMissing('suppliers/logos/old-logo.jpg');
        Storage::disk('public')->assertExists($newPath);
    }

    public function test_supplier_list_supports_status_and_search_filters(): void
    {
        $this->actingAsAdmin();

        Supplier::factory()->create(['shop_name' => 'Alpha Supplies', 'status' => 'ACTIVE']);
        Supplier::factory()->suspended()->create(['shop_name' => 'Zeta Trading', 'status' => 'SUSPENDED']);

        $this->getJson('/api/v1/admin/suppliers?status=SUSPENDED&search=Zeta')
            ->assertOk()
            ->assertJsonCount(1, 'data.suppliers')
            ->assertJsonPath('data.suppliers.0.shop_name', 'Zeta Trading')
            ->assertJsonPath('data.suppliers.0.status', 'SUSPENDED')
            ->assertJsonStructure(['data' => ['suppliers', 'meta' => ['current_page', 'per_page', 'total', 'last_page']]]);
    }

    public function test_suppliers_have_no_delete_route(): void
    {
        $this->actingAsAdmin();

        $supplier = Supplier::factory()->create();

        $this->deleteJson("/api/v1/admin/suppliers/{$supplier->id}")->assertStatus(405);

        $this->assertDatabaseHas('suppliers', ['id' => $supplier->id]);
    }

    private function actingAsAdmin(): Admin
    {
        $admin = Admin::factory()->create();
        Sanctum::actingAs($admin, ['admin']);

        return $admin;
    }
}
