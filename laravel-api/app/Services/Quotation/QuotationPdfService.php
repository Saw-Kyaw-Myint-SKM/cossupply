<?php

namespace App\Services\Quotation;

use App\Models\Admin;
use App\Models\Quotation;
use App\Models\QuotationPdf;
use App\Services\Pdf\PdfRenderer;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Builds a version-specific quotation PDF into private local storage.
 *
 * Every generation creates a new file path and a new append-only
 * `quotation_pdfs` row, so an earlier version's PDF is never overwritten.
 *
 * Rendering goes through mPDF so Burmese text in customer names, townships and
 * product names is shaped correctly; see {@see PdfRenderer}.
 */
class QuotationPdfService
{
    public function __construct(
        private readonly QuotationPdfTemplate $template,
        private readonly PdfRenderer $renderer,
    ) {}

    /**
     * Whether the stored file is a PDF rendered by the current engine.
     *
     * Two kinds of leftovers must be treated as missing and regenerated:
     *
     *  - demo/legacy seed data wrote a header-only placeholder PDF with no
     *    content stream, which downloads as a blank page;
     *  - files written by the retired Helvetica/WinAnsi writer, which drops
     *    Burmese text because base-14 fonts have no Myanmar glyphs.
     *
     * The current renderer always embeds a TrueType subset (`/FontFile2`),
     * while the old writer used non-embedded base-14 fonts, so that marker
     * separates the two generations.
     */
    public function isRenderable(string $path): bool
    {
        $disk = Storage::disk('local');

        if (! $disk->exists($path)) {
            return false;
        }

        $contents = $disk->get($path);

        return is_string($contents)
            && str_starts_with($contents, '%PDF-')
            && str_contains($contents, '/Contents')
            && str_contains($contents, '/FontFile2');
    }

    public function generate(Quotation $quotation, Admin $admin): QuotationPdf
    {
        $quotation->loadMissing([
            'quotationRequest',
            'items.supplier',
            'createdByAdmin',
        ]);

        $generatedAt = now();
        $pdf = $this->renderDocument($quotation, $generatedAt);

        $number = preg_replace('/[^A-Za-z0-9_-]/', '_', $quotation->quotation_number) ?: 'quotation';
        $fileName = sprintf('%s-v%d.pdf', $number, $quotation->version);
        $path = sprintf(
            'quotations/%s/v%d-%s-%s.pdf',
            $number,
            $quotation->version,
            now()->format('YmdHis'),
            Str::lower(Str::random(8)),
        );

        if (! Storage::disk('local')->put($path, $pdf)) {
            throw new RuntimeException('The quotation PDF could not be written to private storage.');
        }

        return QuotationPdf::create([
            'quotation_id' => $quotation->id,
            'file_path' => $path,
            'file_name' => $fileName,
            'generated_by_admin_id' => $admin->id,
            'generated_at' => $generatedAt,
        ]);
    }

    /**
     * Render the document bytes for the given generation timestamp.
     *
     * Public so documents written by an older engine can be re-rendered in
     * place without creating a second version row.
     */
    public function renderDocument(Quotation $quotation, \DateTimeInterface $generatedAt): string
    {
        $quotation->loadMissing([
            'quotationRequest',
            'items.supplier',
            'createdByAdmin',
        ]);

        return $this->renderer->render(
            $this->template->html($quotation, $generatedAt),
            $this->template->footer($generatedAt),
        );
    }
}
