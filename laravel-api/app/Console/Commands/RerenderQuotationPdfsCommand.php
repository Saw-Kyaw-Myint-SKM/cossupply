<?php

namespace App\Console\Commands;

use App\Models\QuotationPdf;
use App\Services\Quotation\QuotationPdfService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;
use Throwable;

/**
 * Re-renders stored quotation PDFs with the current mPDF engine.
 *
 * Earlier builds wrote PDFs with a hand-rolled Helvetica/WinAnsi writer; those
 * files have no Myanmar glyphs, so Burmese names, townships and product names
 * are invisible when opened. This command repairs the stored files in place and
 * keeps the existing version history intact.
 */
class RerenderQuotationPdfsCommand extends Command
{
    /**
     * @var string
     */
    protected $signature = 'quotations:rerender-pdfs
                            {--all : Re-render every stored PDF, not only outdated ones}
                            {--quotation= : Only re-render PDFs of this quotation id}';

    /**
     * @var string
     */
    protected $description = 'Re-render stored quotation PDFs that were produced by the retired PDF writer';

    public function handle(QuotationPdfService $pdfs): int
    {
        $query = QuotationPdf::query()
            ->with([
                'quotation.quotationRequest',
                'quotation.items.supplier',
                'quotation.createdByAdmin',
            ])
            ->orderBy('id');

        if ($this->option('quotation') !== null) {
            $query->where('quotation_id', (int) $this->option('quotation'));
        }

        $rows = $query->get();

        if ($rows->isEmpty()) {
            $this->info('No quotation PDFs found.');

            return self::SUCCESS;
        }

        $rendered = 0;
        $skipped = 0;
        $failed = 0;

        foreach ($rows as $row) {
            if (! $this->option('all') && $pdfs->isRenderable($row->file_path)) {
                $skipped++;

                continue;
            }

            $quotation = $row->quotation;

            if ($quotation === null) {
                $this->warn("Skipped PDF #{$row->id}: the quotation no longer exists.");
                $failed++;

                continue;
            }

            try {
                $bytes = $pdfs->renderDocument($quotation, $row->generated_at ?? now());
            } catch (Throwable $exception) {
                $this->error("Failed PDF #{$row->id} ({$row->file_path}): {$exception->getMessage()}");
                $failed++;

                continue;
            }

            if (! Storage::disk('local')->put($row->file_path, $bytes)) {
                $this->error("Could not write PDF #{$row->id} to {$row->file_path}.");
                $failed++;

                continue;
            }

            $rendered++;
            $this->line("Re-rendered #{$row->id} {$row->file_name} (".strlen($bytes).' bytes)');

            unset($bytes, $quotation);

            // Release the loaded relations before the next document is built.
            gc_collect_cycles();
        }

        $this->newLine();
        $this->info("Done. Re-rendered: {$rendered}, skipped: {$skipped}, failed: {$failed}.");

        return $failed > 0 ? self::FAILURE : self::SUCCESS;
    }
}
