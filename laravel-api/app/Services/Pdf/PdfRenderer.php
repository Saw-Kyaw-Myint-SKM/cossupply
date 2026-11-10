<?php

namespace App\Services\Pdf;

use Mpdf\Mpdf;
use Mpdf\Output\Destination;
use RuntimeException;

/**
 * Shared HTML-to-PDF renderer for printable documents.
 *
 * mPDF is used instead of the previous hand-rolled writer because quotations
 * and receipts carry Burmese text (customer names, townships, product names)
 * and Myanmar is a complex script: it needs OpenType shaping and a reordering
 * pass that a plain WinAnsi/Helvetica writer cannot do.
 *
 * Script detection is left to mPDF so Latin text keeps the default sans-serif
 * face while Myanmar runs are automatically switched to the bundled Padauk
 * Book font with full GSUB/GPOS shaping.
 */
class PdfRenderer
{
    /**
     * Render the given HTML body into a PDF byte string.
     */
    public function render(string $html, ?string $footerHtml = null): string
    {
        $mpdf = new Mpdf([
            'mode' => 'utf-8',
            'format' => 'A4',
            'tempDir' => $this->tempDir(),
            'default_font' => 'dejavusans',
            'margin_left' => 15,
            'margin_right' => 15,
            'margin_top' => 14,
            'margin_bottom' => 18,
            'margin_footer' => 8,
        ]);

        // Detect script runs and map them to a font that can render them.
        // Without this, Burmese text falls back to a Latin-only face and
        // renders as missing glyphs.
        $mpdf->autoScriptToLang = true;
        $mpdf->autoLangToFont = true;
        $mpdf->useSubstitutions = true;

        if ($footerHtml !== null) {
            $mpdf->SetHTMLFooter($footerHtml);
        }

        $mpdf->WriteHTML($html);

        $output = $mpdf->Output('', Destination::STRING_RETURN);

        // mPDF builds cyclic object graphs; without an explicit collection a
        // process that renders many documents (the test suite, the re-render
        // command) creeps up to the memory limit instead of freeing them.
        unset($mpdf);
        gc_collect_cycles();

        return $output;
    }

    /**
     * mPDF keeps its temporary files outside the repository's public tree.
     */
    private function tempDir(): string
    {
        $dir = storage_path('app/mpdf');

        if (! is_dir($dir) && ! @mkdir($dir, 0777, true) && ! is_dir($dir)) {
            throw new RuntimeException('The PDF temporary directory could not be created.');
        }

        return $dir;
    }
}
