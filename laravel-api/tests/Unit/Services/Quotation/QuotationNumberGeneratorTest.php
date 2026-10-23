<?php

namespace Tests\Unit\Services\Quotation;

use App\Models\Setting;
use App\Services\Audit\AuditLogService;
use App\Services\Quotation\QuotationNumberGenerator;
use App\Services\Setting\SettingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class QuotationNumberGeneratorTest extends TestCase
{
    use RefreshDatabase;

    private QuotationNumberGenerator $generator;

    protected function setUp(): void
    {
        parent::setUp();

        $this->generator = new QuotationNumberGenerator(new SettingService(new AuditLogService));
    }

    public function test_generates_the_default_format_from_the_row_id(): void
    {
        $request = new \App\Models\QuotationRequest;
        $request->id = 42;

        $this->assertSame('QT-'.now()->year.'-0042', $this->generator->generate($request));
    }

    public function test_pads_the_id_to_four_digits_and_grows_naturally_beyond(): void
    {
        $request = new \App\Models\QuotationRequest;
        $request->id = 7;

        $this->assertSame('QT-'.now()->year.'-0007', $this->generator->generate($request));

        $request->id = 12345;

        $this->assertSame('QT-'.now()->year.'-12345', $this->generator->generate($request));
    }

    public function test_uses_the_master_setting_prefix(): void
    {
        Setting::query()->create([
            'key' => 'quotation_number_prefix',
            'value' => 'SUP',
            'value_type' => 'string',
            'group_name' => 'quotation',
            'label' => 'Quotation Number Prefix',
            'is_public' => false,
        ]);

        $request = new \App\Models\QuotationRequest;
        $request->id = 1;

        $this->assertSame('SUP-'.now()->year.'-0001', $this->generator->generate($request));
    }
}
