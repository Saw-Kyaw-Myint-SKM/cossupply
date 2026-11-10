<?php

namespace Tests\Unit\Services\Quotation;

use App\Services\Quotation\SimplePdfDocument;
use PHPUnit\Framework\TestCase;

/**
 * The writer estimates right-aligned text from the real Helvetica advance
 * widths, so uppercase strings no longer run past the 547pt right margin.
 */
class SimplePdfDocumentTest extends TestCase
{
    private SimplePdfDocument $document;

    protected function setUp(): void
    {
        parent::setUp();

        $this->document = new SimplePdfDocument;
    }

    public function test_bold_quotation_title_width_matches_helvetica_bold_metrics(): void
    {
        // Q 778 + U 722 + O 778 + T 611 + A 722 + T 611 + I 278 + O 778 + N 722
        // = 6000 units → 96.0pt at 16pt.
        $this->assertEqualsWithDelta(96.0, $this->document->textWidth('QUOTATION', 16, true), 0.5);
    }

    public function test_regular_text_width_uses_the_regular_metrics(): void
    {
        // M 833 + M 833 + K 667 = 2333 units → 20.997pt at 9pt.
        $this->assertEqualsWithDelta(20.997, $this->document->textWidth('MMK', 9), 0.01);
    }

    public function test_italic_does_not_change_the_width_table(): void
    {
        // Helvetica-Oblique shares the regular widths and BoldOblique the bold ones.
        $this->assertSame(
            $this->document->textWidth('All amounts in MMK', 8),
            $this->document->textWidth('All amounts in MMK', 8, false, true),
        );
        $this->assertSame(
            $this->document->textWidth('All amounts in MMK', 8, true),
            $this->document->textWidth('All amounts in MMK', 8, true, true),
        );
    }

    public function test_a_long_right_aligned_amount_fits_the_content_width(): void
    {
        $right = 547.0;
        $left = 48.0;

        $width = $this->document->textWidth('125,451 MMK', 9.5, true);

        $this->assertLessThanOrEqual($right - $left, $width);
    }
}
