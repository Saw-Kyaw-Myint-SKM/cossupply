<?php

namespace Tests\Unit\Services\Pdf;

use App\Services\Pdf\PdfRenderer;
use Tests\TestCase;

class PdfRendererTest extends TestCase
{
    public function test_renders_a_valid_pdf_document(): void
    {
        $pdf = (new PdfRenderer)->render('<p>Quotation</p>');

        $this->assertStringStartsWith('%PDF-', $pdf);
        $this->assertStringContainsString('/Type /Page', $pdf);
    }

    public function test_embeds_a_unicode_font_for_burmese_text(): void
    {
        $pdf = (new PdfRenderer)->render(
            '<p>ပစ္စည်းအမည်: တီရှပ်</p><p>ကျွန်ုပ်၏ အော်ဒါများ</p>',
        );

        // A Unicode TrueType subset is embedded for the Myanmar run. The old
        // WinAnsi/Helvetica writer never embedded a font and dropped the
        // characters instead.
        $this->assertStringStartsWith('%PDF-', $pdf);
        $this->assertStringContainsString('/FontFile2', $pdf);
        $this->assertStringContainsString('/Identity-H', $pdf);
    }

    public function test_accepts_a_page_footer(): void
    {
        $pdf = (new PdfRenderer)->render(
            '<p>Body</p>',
            '<div>Page {PAGENO} of {nbpg}</div>',
        );

        $this->assertStringStartsWith('%PDF-', $pdf);
    }
}
