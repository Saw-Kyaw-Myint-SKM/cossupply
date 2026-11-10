<?php

namespace Tests\Unit\Services\Quotation;

use App\Services\Pdf\PdfRenderer;
use App\Services\Quotation\QuotationPdfService;
use App\Services\Quotation\QuotationPdfTemplate;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class QuotationPdfServiceTest extends TestCase
{
    private QuotationPdfService $service;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');

        $this->service = new QuotationPdfService(
            app(QuotationPdfTemplate::class),
            app(PdfRenderer::class),
        );
    }

    public function test_a_missing_file_is_not_renderable(): void
    {
        $this->assertFalse($this->service->isRenderable('quotations/missing.pdf'));
    }

    public function test_a_header_only_placeholder_is_not_renderable(): void
    {
        Storage::disk('local')->put('quotations/placeholder.pdf', <<<'PDF'
%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
%%EOF
PDF);

        $this->assertFalse($this->service->isRenderable('quotations/placeholder.pdf'));
    }

    public function test_a_pdf_written_by_the_retired_helvetica_writer_is_not_renderable(): void
    {
        // The old writer used non-embedded base-14 fonts, so Burmese text was
        // dropped. Such files must be regenerated instead of served.
        Storage::disk('local')->put('quotations/legacy.pdf', <<<'PDF'
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
3 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>
endobj
%%EOF
PDF);

        $this->assertFalse($this->service->isRenderable('quotations/legacy.pdf'));
    }

    public function test_a_pdf_with_an_embedded_unicode_font_is_renderable(): void
    {
        Storage::disk('local')->put('quotations/current.pdf', <<<'PDF'
%PDF-1.4
1 0 obj
<< /Type /Page /Contents 2 0 R >>
endobj
2 0 obj
<< /Length 44 >>
stream
BT /F1 12.00 Tf 1 0 0 1 48 794 Tm <0041> Tj ET
endstream
endobj
3 0 obj
<< /Type /Font /Subtype /TrueType /FontDescriptor 4 0 R >>
endobj
4 0 obj
<< /Type /FontDescriptor /FontFile2 5 0 R >>
endobj
%%EOF
PDF);

        $this->assertTrue($this->service->isRenderable('quotations/current.pdf'));
    }
}
