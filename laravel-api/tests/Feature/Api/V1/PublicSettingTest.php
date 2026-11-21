<?php

namespace Tests\Feature\Api\V1;

use Database\Seeders\SettingSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PublicSettingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(SettingSeeder::class);
    }

    public function test_guest_can_read_only_public_settings(): void
    {
        $response = $this->getJson('/api/v1/settings/public')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.settings.company_name', 'CoSupply')
            ->assertJsonPath('data.settings.storefront_supplier_display', 'CARD');

        $settings = $response->json('data.settings');

        $this->assertSame([
            'company_address',
            'company_email',
            'company_name',
            'company_phone',
            'storefront_supplier_display',
        ], array_keys($settings));

        // Internal operational settings stay behind the admin token.
        $this->assertArrayNotHasKey('quotation_validity_days', $settings);
        $this->assertArrayNotHasKey('payment_method', $settings);
    }
}
