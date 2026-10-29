<?php

namespace App\Services\Quotation;

use App\Models\Admin;
use App\Models\Quotation;
use App\Models\QuotationPdf;
use App\Models\QuotationVersionItem;
use App\Services\Setting\SettingService;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Builds a version-specific quotation PDF into private local storage.
 *
 * Every generation creates a new file path and a new append-only
 * `quotation_pdfs` row, so an earlier version's PDF is never overwritten.
 */
class QuotationPdfService
{
    public function __construct(
        private readonly SettingService $settings,
    ) {}

    public function generate(Quotation $quotation, Admin $admin): QuotationPdf
    {
        $quotation->loadMissing([
            'quotationRequest',
            'items.supplier',
            'createdByAdmin',
        ]);

        $generatedAt = now();
        $pdf = $this->render($quotation, $generatedAt);

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

    private function render(Quotation $quotation, \DateTimeInterface $generatedAt): string
    {
        $request = $quotation->quotationRequest;
        $companyName = (string) $this->settings->get('company_name', 'CoSupply');
        $companyPhone = (string) $this->settings->get('company_phone', '');
        $companyEmail = (string) $this->settings->get('company_email', '');
        $companyAddress = (string) $this->settings->get('company_address', '');

        $doc = new SimplePdfDocument;
        $right = 547.0;

        $doc->text(48, 790, 18, $companyName, true);
        $doc->text(48, 773, 9, $companyAddress);
        $doc->text(48, 760, 9, trim($companyPhone.'  '.$companyEmail));
        $doc->textRight($right, 792, 22, 'QUOTATION', true);
        $doc->textRight($right, 774, 10, $quotation->quotation_number.'  |  Version '.$quotation->version, true);
        $doc->textRight($right, 760, 9, 'Issued '.($quotation->created_at?->format('d M Y') ?? ''));
        $doc->textRight($right, 747, 9, 'Valid until '.($quotation->valid_until?->format('d M Y') ?? ''));

        $doc->line(48, 736, $right, 736, 1.2);
        $doc->setY(716);

        $doc->text(48, $doc->y(), 11, 'QUOTATION TO', true);
        $doc->text(310, $doc->y(), 11, 'DELIVERY DETAILS', true);
        $doc->moveY(-16);

        $customerLines = array_values(array_filter([
            $request->customer_name,
            $request->company_name,
            $request->phone,
            $request->email,
            $request->township !== null ? $request->township.', '.$request->city : $request->city,
        ]));

        $deliveryLines = array_values(array_filter([
            $request->delivery_address,
            $request->landmark,
            $request->required_delivery_date !== null
                ? 'Requested delivery: '.$request->required_delivery_date->format('d M Y')
                : null,
            'Payment: Cash on Delivery',
        ]));

        $blockHeight = max(count($customerLines), count($deliveryLines)) * 13;
        $startY = $doc->y();

        foreach ($customerLines as $index => $line) {
            $doc->text(48, $startY - ($index * 13), 9, $line);
        }

        foreach ($deliveryLines as $index => $line) {
            $doc->text(310, $startY - ($index * 13), 9, $this->truncate($line, 48));
        }

        $doc->setY($startY - $blockHeight - 16);
        $doc->line(48, $doc->y(), $right, $doc->y(), 0.6);
        $doc->moveY(-22);

        $this->writeTableHeader($doc, $right);

        foreach ($quotation->items as $index => $item) {
            $this->writeItem($doc, $item, $index + 1, $right);
        }

        $doc->line(48, $doc->y(), $right, $doc->y(), 0.6);
        $doc->moveY(-18);

        $this->writeTotals($doc, $quotation, $right);

        $doc->moveY(-8);
        $doc->ensureSpace(110);
        $doc->text(48, $doc->y(), 10, 'PAYMENT TERMS', true);
        $doc->moveY(-15);
        foreach ($this->wrap($quotation->payment_terms, 95) as $line) {
            $doc->write($line, 9, false, 48, 13);
        }

        if ($quotation->admin_note !== null && $quotation->admin_note !== '') {
            $doc->moveY(-4);
            $doc->text(48, $doc->y(), 10, 'ADMIN NOTE', true);
            $doc->moveY(-15);
            foreach ($this->wrap($quotation->admin_note, 95) as $line) {
                $doc->write($line, 9, false, 48, 13);
            }
        }

        $doc->moveY(-4);
        $doc->write(
            sprintf(
                'Generated by %s from CoSupply on %s.',
                $quotation->createdByAdmin?->name ?? 'Admin',
                $generatedAt->format('d M Y, H:i'),
            ),
            8,
            false,
            48,
            12,
        );

        return $doc->output();
    }

    private function writeTableHeader(SimplePdfDocument $doc, float $right): void
    {
        $y = $doc->y();

        $doc->text(48, $y, 8, '#', true);
        $doc->text(68, $y, 8, 'ITEM', true);
        $doc->text(320, $y, 8, 'QTY', true);
        $doc->text(355, $y, 8, 'UNIT PRICE', true);
        $doc->text(425, $y, 8, 'DISC.', true);
        $doc->text(480, $y, 8, 'LINE TOTAL', true);
        $doc->line(48, $y - 5, $right, $y - 5, 0.5);
        $doc->setY($y - 18);
    }

    private function writeItem(SimplePdfDocument $doc, QuotationVersionItem $item, int $position, float $right): void
    {
        $detailLines = array_values(array_filter([
            trim(implode('  |  ', array_filter([
                $item->sku_snapshot !== null ? 'SKU '.$item->sku_snapshot : null,
                $item->supplier !== null ? 'Supplier '.$item->supplier->shop_name : null,
            ]))),
            $item->delivery_date !== null ? 'Delivery '.$item->delivery_date->format('d M Y') : null,
            $item->warranty_note !== null ? 'Warranty: '.$item->warranty_note : null,
            $item->supplier_note !== null ? 'Supplier note: '.$item->supplier_note : null,
        ]));

        $nameLines = $this->wrap($item->product_name_snapshot, 38);
        $lineCount = count($nameLines) + count($detailLines);
        $rowHeight = max(30, $lineCount * 12 + 6);

        $previousPage = $doc->pageCount();
        $doc->ensureSpace($rowHeight);

        if ($doc->pageCount() !== $previousPage) {
            $this->writeTableHeader($doc, $right);
        }

        $top = $doc->y();
        $doc->text(48, $top, 9, (string) $position);
        $doc->text(320, $top, 9, (string) $item->quantity);
        $doc->text(355, $top, 9, $this->money($item->unit_price));
        $doc->text(425, $top, 9, $this->money($item->discount));
        $doc->text(480, $top, 9, $this->money($item->line_total), true);

        foreach ($nameLines as $index => $line) {
            $doc->text(68, $top - ($index * 12), 9, $line);
        }

        $detailStart = $top - (count($nameLines) * 12);

        foreach ($detailLines as $index => $line) {
            $doc->text(68, $detailStart - ($index * 11), 7.5, $this->truncate($line, 62));
        }

        $doc->setY($top - $rowHeight);
        $doc->line(48, $doc->y(), $right, $doc->y(), 0.25);
        $doc->moveY(-8);
    }

    private function writeTotals(SimplePdfDocument $doc, Quotation $quotation, float $right): void
    {
        $labelX = 360;
        $valueX = 500;

        $rows = [
            ['Subtotal', $this->money($quotation->subtotal), false],
            ['Discount', $this->money($quotation->discount), false],
            ['Delivery fee', $this->money($quotation->delivery_fee), false],
            [
                sprintf('Service fee (%d%%)', $quotation->service_fee_percentage),
                $this->money($quotation->service_fee),
                false,
            ],
            ['TOTAL (COD)', $this->money($quotation->total_amount), true],
        ];

        foreach ($rows as [$label, $value, $bold]) {
            $doc->text($labelX, $doc->y(), $bold ? 11 : 9, $label, $bold);
            $doc->text($valueX, $doc->y(), $bold ? 11 : 9, $value, $bold);
            $doc->moveY($bold ? -18 : -14);
        }
    }

    /**
     * @return list<string>
     */
    private function wrap(string $text, int $maxChars): array
    {
        $text = trim($text);

        if ($text === '') {
            return [''];
        }

        $words = preg_split('/\s+/', $text) ?: [];
        $lines = [];
        $current = '';

        foreach ($words as $word) {
            if ($current === '') {
                $current = $word;

                continue;
            }

            if (strlen($current) + 1 + strlen($word) <= $maxChars) {
                $current .= ' '.$word;

                continue;
            }

            $lines[] = $current;
            $current = $word;
        }

        if ($current !== '') {
            $lines[] = $current;
        }

        return array_map(fn (string $line): string => $this->truncate($line, $maxChars), $lines);
    }

    private function truncate(string $text, int $maxChars): string
    {
        return strlen($text) > $maxChars ? substr($text, 0, max($maxChars - 3, 0)).'...' : $text;
    }

    private function money(int $amount): string
    {
        return number_format($amount).' MMK';
    }
}
