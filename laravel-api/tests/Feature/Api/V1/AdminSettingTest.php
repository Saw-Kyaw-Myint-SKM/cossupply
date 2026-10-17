<?php

namespace Tests\Feature\Api\V1;

use App\Models\Admin;
use App\Models\AuditLog;
use App\Models\Customer;
use App\Models\Setting;
use Database\Seeders\SettingSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminSettingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(SettingSeeder::class);
    }

    public function test_admin_can_list_all_settings_with_typed_values(): void
    {
        $admin = Admin::factory()->create();
        Sanctum::actingAs($admin, ['admin']);

        $response = $this->getJson('/api/v1/admin/settings');

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonCount(15, 'data.settings')
            ->assertJsonStructure([
                'data' => [
                    'settings' => [
                        ['key', 'value', 'value_type', 'group_name', 'label', 'description', 'is_public', 'updated_at'],
                    ],
                ],
            ]);

        $settings = collect($response->json('data.settings'))->keyBy('key');

        $this->assertSame('MMK', $settings['default_currency']['value']);
        $this->assertSame(7, $settings['quotation_validity_days']['value']);
        $this->assertSame('integer', $settings['quotation_validity_days']['value_type']);
        $this->assertTrue($settings['require_full_payment']['value']);
        $this->assertFalse($settings['quotation_service_fee_percentage']['is_public']);
        $this->assertTrue($settings['company_name']['is_public']);
    }

    public function test_admin_can_update_a_single_setting(): void
    {
        $admin = Admin::factory()->create();
        Sanctum::actingAs($admin, ['admin']);

        $response = $this->putJson('/api/v1/admin/settings/quotation_validity_days', [
            'value' => 14,
        ]);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.setting.key', 'quotation_validity_days')
            ->assertJsonPath('data.setting.value', 14)
            ->assertJsonPath('data.setting.value_type', 'integer');

        $this->assertDatabaseHas('settings', [
            'key' => 'quotation_validity_days',
            'value' => '14',
            'updated_by_admin_id' => $admin->id,
        ]);
    }

    public function test_single_setting_update_validates_against_the_declared_type(): void
    {
        $admin = Admin::factory()->create();
        Sanctum::actingAs($admin, ['admin']);

        $this->putJson('/api/v1/admin/settings/quotation_validity_days', ['value' => 0])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['value']);

        $this->putJson('/api/v1/admin/settings/quotation_service_fee_percentage', ['value' => 101])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['value']);

        $this->putJson('/api/v1/admin/settings/default_currency', ['value' => 'USD'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['value']);

        $this->putJson('/api/v1/admin/settings/require_full_payment', ['value' => 'not-a-boolean'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['value']);

        $this->assertDatabaseHas('settings', ['key' => 'quotation_validity_days', 'value' => '7']);
        $this->assertDatabaseHas('settings', ['key' => 'default_currency', 'value' => 'MMK']);
    }

    public function test_unknown_setting_key_returns_not_found(): void
    {
        $admin = Admin::factory()->create();
        Sanctum::actingAs($admin, ['admin']);

        $this->putJson('/api/v1/admin/settings/unknown_key', ['value' => 'anything'])
            ->assertNotFound();
    }

    public function test_settings_endpoints_require_authentication(): void
    {
        $this->getJson('/api/v1/admin/settings')->assertUnauthorized();
        $this->putJson('/api/v1/admin/settings/default_currency', ['value' => 'MMK'])->assertUnauthorized();
        $this->patchJson('/api/v1/admin/settings', ['settings' => ['default_currency' => 'MMK']])->assertUnauthorized();
    }

    public function test_customer_token_cannot_access_settings_endpoints(): void
    {
        $customer = Customer::factory()->create();
        $token = $customer->createToken('customer-token', ['customer'])->plainTextToken;

        $this->withToken($token)
            ->getJson('/api/v1/admin/settings')
            ->assertForbidden();

        $this->withToken($token)
            ->putJson('/api/v1/admin/settings/default_currency', ['value' => 'MMK'])
            ->assertForbidden();
    }

    public function test_admin_can_bulk_update_settings_in_one_request(): void
    {
        $admin = Admin::factory()->create();
        Sanctum::actingAs($admin, ['admin']);

        $response = $this->patchJson('/api/v1/admin/settings', [
            'settings' => [
                'quotation_validity_days' => 10,
                'require_receipt_number' => false,
                'company_name' => 'CoSupply Trading',
            ],
        ]);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonCount(3, 'data.settings');

        $this->assertDatabaseHas('settings', ['key' => 'quotation_validity_days', 'value' => '10']);
        $this->assertDatabaseHas('settings', ['key' => 'require_receipt_number', 'value' => '0']);
        $this->assertDatabaseHas('settings', ['key' => 'company_name', 'value' => 'CoSupply Trading']);
    }

    public function test_bulk_update_is_all_or_nothing_when_validation_fails(): void
    {
        $admin = Admin::factory()->create();
        Sanctum::actingAs($admin, ['admin']);

        $response = $this->patchJson('/api/v1/admin/settings', [
            'settings' => [
                'quotation_validity_days' => 10,
                'quotation_service_fee_percentage' => 150,
            ],
        ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['settings.quotation_service_fee_percentage']);

        $this->assertDatabaseHas('settings', ['key' => 'quotation_validity_days', 'value' => '7']);
        $this->assertDatabaseHas('settings', ['key' => 'quotation_service_fee_percentage', 'value' => '0']);
        $this->assertDatabaseCount('audit_logs', 0);
    }

    public function test_bulk_update_rejects_unknown_setting_keys(): void
    {
        $admin = Admin::factory()->create();
        Sanctum::actingAs($admin, ['admin']);

        $response = $this->patchJson('/api/v1/admin/settings', [
            'settings' => [
                'no_such_setting' => 'value',
            ],
        ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['settings.no_such_setting']);

        $this->assertDatabaseCount('audit_logs', 0);
    }

    public function test_setting_update_writes_audit_log_with_old_and_new_values(): void
    {
        $admin = Admin::factory()->create();
        Sanctum::actingAs($admin, ['admin']);

        $setting = Setting::query()->where('key', 'quotation_validity_days')->sole();

        $this->putJson('/api/v1/admin/settings/quotation_validity_days', ['value' => 14])
            ->assertOk();

        $log = AuditLog::query()->sole();

        $this->assertSame($admin->id, $log->admin_id);
        $this->assertSame('setting.updated', $log->action);
        $this->assertSame('setting', $log->entity_type);
        $this->assertSame((string) $setting->id, $log->entity_id);
        $this->assertSame(['key' => 'quotation_validity_days', 'value' => 7], $log->old_data);
        $this->assertSame(['key' => 'quotation_validity_days', 'value' => 14], $log->new_data);
        $this->assertSame('127.0.0.1', $log->ip_address);
    }

    public function test_unchanged_setting_value_does_not_write_an_audit_log(): void
    {
        $admin = Admin::factory()->create();
        Sanctum::actingAs($admin, ['admin']);

        $this->putJson('/api/v1/admin/settings/quotation_validity_days', ['value' => 7])
            ->assertOk();

        $this->assertDatabaseCount('audit_logs', 0);
        $this->assertDatabaseHas('settings', [
            'key' => 'quotation_validity_days',
            'updated_by_admin_id' => null,
        ]);
    }

    public function test_bulk_update_audits_each_changed_key_only(): void
    {
        $admin = Admin::factory()->create();
        Sanctum::actingAs($admin, ['admin']);

        $this->patchJson('/api/v1/admin/settings', [
            'settings' => [
                'quotation_validity_days' => 10,
                'quotation_service_fee_percentage' => 5,
                'company_name' => 'CoSupply',
            ],
        ])->assertOk();

        $this->assertDatabaseCount('audit_logs', 2);

        $keys = AuditLog::query()->get()
            ->map(fn (AuditLog $log) => $log->new_data['key'])
            ->sort()
            ->values()
            ->all();

        $this->assertSame(['quotation_service_fee_percentage', 'quotation_validity_days'], $keys);
    }
}
