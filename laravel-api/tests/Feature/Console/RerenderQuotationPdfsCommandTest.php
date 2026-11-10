<?php

namespace Tests\Feature\Console;

use App\Models\Admin;
use App\Models\Quotation;
use App\Models\QuotationPdf;
use App\Models\QuotationRequest;
use App\Models\QuotationVersionItem;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class RerenderQuotationPdfsCommandTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');
    }

    public function test_it_rewrites_pdfs_written_by_the_retired_engine(): void
    {
        $quotation = $this->quotation();
        $path = 'quotations/legacy.pdf';

        Storage::disk('local')->put($path, <<<'PDF'
%PDF-1.4
1 0 obj
<< /Type /Page /Contents 2 0 R >>
endobj
2 0 obj
<< /Length 44 >>
stream
BT /F1 12.00 Tf 1 0 0 1 48 794 Tm (Quotation) Tj ET
endstream
endobj
%%EOF
PDF);

        $pdf = $this->pdfRow($quotation, $path);

        $this->artisan('quotations:rerender-pdfs')->assertExitCode(0);

        $contents = Storage::disk('local')->get($path);

        $this->assertStringStartsWith('%PDF-', $contents);
        $this->assertStringContainsString('/FontFile2', $contents);
        $this->assertStringContainsString('/Identity-H', $contents);

        // The append-only version row keeps its identity and path.
        $this->assertSame($path, $pdf->fresh()->file_path);
    }

    public function test_it_leaves_current_pdfs_untouched(): void
    {
        $quotation = $this->quotation();
        $path = 'quotations/current.pdf';
        $original = "%PDF-1.4\n2 0 obj\n<< /Contents 1 0 R /FontFile2 3 0 R >>\nendobj\n%%EOF\n";

        Storage::disk('local')->put($path, $original);
        $this->pdfRow($quotation, $path);

        $this->artisan('quotations:rerender-pdfs')->assertExitCode(0);

        $this->assertSame($original, Storage::disk('local')->get($path));
    }

    private function pdfRow(Quotation $quotation, string $path): QuotationPdf
    {
        return QuotationPdf::create([
            'quotation_id' => $quotation->id,
            'file_path' => $path,
            'file_name' => 'legacy.pdf',
            'generated_by_admin_id' => Admin::factory()->create()->id,
            'generated_at' => now()->subDay(),
        ]);
    }

    private function quotation(): Quotation
    {
        $request = QuotationRequest::factory()->create([
            'customer_name' => 'ဦးအောင်အောင်',
            'city' => 'ရန်ကုန်',
            'township' => 'လှိုင်',
        ]);

        $quotation = Quotation::factory()
            ->for($request, 'quotationRequest')
            ->priced(20000)
            ->create();

        QuotationVersionItem::factory()
            ->forQuotation($quotation)
            ->create([
                'product_name_snapshot' => 'တီရှပ်',
                'quantity' => 2,
                'unit_price' => 10000,
                'line_total' => 20000,
            ]);

        return $quotation;
    }
}
