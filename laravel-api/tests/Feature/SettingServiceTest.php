<?php

namespace Tests\Feature;

use App\Models\Setting;
use App\Services\Setting\SettingService;
use Database\Seeders\SettingSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SettingServiceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(SettingSeeder::class);
    }

    public function test_get_returns_typed_values_and_defaults_for_unknown_keys(): void
    {
        $service = app(SettingService::class);

        $this->assertSame(7, $service->get('quotation_validity_days'));
        $this->assertSame('MMK', $service->get('default_currency'));
        $this->assertTrue($service->get('require_full_payment'));
        $this->assertSame('fallback', $service->get('unknown_key', 'fallback'));
        $this->assertNull($service->get('unknown_key'));
    }

    public function test_values_returns_all_settings_as_typed_key_value_pairs(): void
    {
        $values = app(SettingService::class)->values();

        $this->assertCount(15, $values);
        $this->assertSame(7, $values['quotation_validity_days']);
        $this->assertSame(0, $values['quotation_service_fee_percentage']);
        $this->assertTrue($values['require_receipt_number']);
        $this->assertSame('Asia/Yangon', $values['timezone']);
    }

    public function test_public_filtering_only_returns_public_settings(): void
    {
        $publicSettings = Setting::query()->public()->pluck('key')->all();
        sort($publicSettings);

        $this->assertSame([
            'company_address',
            'company_email',
            'company_name',
            'company_phone',
        ], $publicSettings);

        $publicValues = app(SettingService::class)->publicValues();

        $this->assertSame([
            'company_address',
            'company_email',
            'company_name',
            'company_phone',
        ], array_keys($publicValues));

        $this->assertArrayNotHasKey('quotation_validity_days', $publicValues);
    }
}
