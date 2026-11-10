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
    /**
     * Quotation palette as 0..1 RGB triples.
     *
     * @var array{0: float, 1: float, 2: float}
     */
    private const CYAN = [0.000, 0.557, 0.800];   // #008ecc

    /**
     * @var array{0: float, 1: float, 2: float}
     */
    private const INK = [0.102, 0.102, 0.102];    // #1a1a1a

    /**
     * @var array{0: float, 1: float, 2: float}
     */
    private const MUTED = [0.361, 0.361, 0.361];  // #5c5c5c

    /**
     * @var array{0: float, 1: float, 2: float}
     */
    private const SUBTLE = [0.549, 0.549, 0.549]; // #8c8c8c

    /**
     * @var array{0: float, 1: float, 2: float}
     */
    private const LINE = [0.831, 0.831, 0.831];   // #d4d4d4

    /**
     * @var array{0: float, 1: float, 2: float}
     */
    private const RULE = [0.922, 0.922, 0.922];   // #ebebeb

    public function __construct(
        private readonly SettingService $settings,
    ) {}

    /**
     * Whether the stored file is a PDF that actually renders a document.
     *
     * Demo and legacy seed data wrote a header-only placeholder PDF with no
     * content stream, which downloads as a blank page. Those files must be
     * treated as missing so a real document is generated on demand.
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
            && str_contains($contents, '/Contents');
    }

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
        $doc->setFooterStyle(7.5, ...self::SUBTLE);
        $right = 547.0;

        // HEADER
        $this->fill($doc, self::CYAN);
        $doc->text(48, 790, 20, $companyName, true);
        $this->fill($doc, self::MUTED);
        $doc->text(48, 773, 8.5, $companyAddress);
        $doc->text(48, 760, 8.5, trim($companyPhone.'  '.$companyEmail));
        $this->fill($doc, self::MUTED);
        $doc->textRight($right, 792, 16, 'QUOTATION', true);
        $this->fill($doc, self::CYAN);
        $doc->textRight($right, 774, 9.5, $quotation->quotation_number.'  |  Version '.$quotation->version, true);
        $this->fill($doc, self::MUTED);
        $doc->textRight($right, 760, 8.5, 'Issued '.($quotation->created_at?->format('d M Y') ?? ''));
        $doc->textRight($right, 747, 8.5, 'Valid until '.($quotation->valid_until?->format('d M Y') ?? ''));

        $this->stroke($doc, self::CYAN);
        $doc->line(48, 736, $right, 736, 1.5);
        $doc->setY(716);

        // PARTY BLOCK
        $this->fill($doc, self::CYAN);
        $doc->text(48, $doc->y(), 8, 'QUOTATION TO', true);
        $doc->text(310, $doc->y(), 8, 'DELIVERY DETAILS', true);
        $doc->moveY(-16);

        $customerAddress = trim(implode(', ', array_filter([
            $request->township,
            $request->city,
        ])));

        $customerRows = [];

        foreach ([
            ['Name', $request->customer_name],
            ['Company', $request->company_name],
            ['Phone', $request->phone],
            ['Email', $request->email],
            ['Address', $customerAddress],
        ] as [$label, $value]) {
            $value = trim((string) $value);

            if ($value !== '') {
                $customerRows[] = [$label, $value];
            }
        }

        $deliveryLines = array_values(array_filter([
            $request->delivery_address,
            $request->landmark,
            $request->required_delivery_date !== null
                ? 'Requested delivery: '.$request->required_delivery_date->format('d M Y')
                : null,
            'Payment: Cash on Delivery',
        ]));

        $blockHeight = max(count($customerRows), count($deliveryLines)) * 13;
        $startY = $doc->y();

        $labelWidth = 0.0;

        foreach ($customerRows as [$label]) {
            $labelWidth = max($labelWidth, $doc->textWidth($label.' :', 8.5));
        }

        $valueX = 48 + $labelWidth + 10;
        $valueWidth = max(310 - 12 - $valueX, 60);

        foreach ($customerRows as $index => [$label, $value]) {
            $rowY = $startY - ($index * 13);

            $this->fill($doc, self::MUTED);
            $doc->text(48, $rowY, 8.5, $label.' :');

            $this->fill($doc, self::INK);
            $doc->text($valueX, $rowY, 9.5, $this->truncateToWidth($doc, $value, $valueWidth, 9.5));
        }

        foreach ($deliveryLines as $index => $line) {
            $isHeading = $index === 0;
            $this->fill($doc, $isHeading ? self::INK : self::MUTED);
            $doc->text(310, $startY - ($index * 13), $isHeading ? 9.5 : 8.5, $this->truncate($line, 48));
        }

        $doc->setY($startY - $blockHeight - 16);
        $this->stroke($doc, self::LINE);
        $doc->line(48, $doc->y(), $right, $doc->y(), 0.5);
        $doc->moveY(-22);

        $this->writeTableHeader($doc, $right);

        foreach ($quotation->items as $index => $item) {
            $this->writeItem($doc, $item, $index + 1, $right);
        }

        $this->stroke($doc, self::CYAN);
        $doc->line(48, $doc->y(), $right, $doc->y(), 0.75);

        $doc->moveY(-10);
        $this->fill($doc, self::SUBTLE);
        $doc->textRight($right, $doc->y(), 8, 'All amounts in MMK', false, true);
        $doc->moveY(-20);

        $this->writeTotals($doc, $quotation);

        $this->sectionHeader($doc, 'PAYMENT TERMS');
        foreach ($this->paragraphs($quotation->payment_terms) as $paragraphIndex => $paragraph) {
            if ($paragraphIndex > 0) {
                $doc->moveY(-3);
            }
            foreach ($this->wrap($paragraph, 95) as $line) {
                $doc->write($line, 9, false, 48, 13);
            }
        }

        $warrantyPolicies = $quotation->items
            ->map(fn ($item) => $item->supplier?->warranty_policy)
            ->filter(fn ($policy) => is_string($policy) && trim($policy) !== '')
            ->map(fn ($policy) => trim($policy))
            ->unique()
            ->values();

        if ($warrantyPolicies->isNotEmpty()) {
            $this->sectionHeader($doc, 'WARRANTY');
            foreach ($warrantyPolicies as $policyIndex => $policy) {
                if ($policyIndex > 0) {
                    $doc->moveY(-3);
                }
                foreach ($this->wrap($policy, 95) as $line) {
                    $doc->write($line, 9, false, 48, 13);
                }
            }
        }

        if ($quotation->admin_note !== null && $quotation->admin_note !== '') {
            $this->sectionHeader($doc, 'ADMIN NOTE');
            foreach ($this->paragraphs($quotation->admin_note) as $paragraphIndex => $paragraph) {
                if ($paragraphIndex > 0) {
                    $doc->moveY(-3);
                }
                foreach ($this->wrap($paragraph, 95) as $line) {
                    $doc->write($line, 9, false, 48, 13);
                }
            }
        }

        $doc->ensureSpace(46);
        $doc->moveY(-18);
        $this->stroke($doc, self::RULE);
        $doc->line(48, $doc->y(), $right, $doc->y(), 0.5);
        $doc->moveY(-16);

        $this->fill($doc, self::SUBTLE);
        $generatedLine = sprintf(
            'Generated by %s from CoSupply on %s.',
            $quotation->createdByAdmin?->name ?? 'Admin',
            $generatedAt->format('d M Y, H:i'),
        );
        $doc->ensureSpace(12);
        $doc->textCenter((48 + $right) / 2, $doc->y(), 7.5, $generatedLine);
        $doc->moveY(-12);

        return $doc->output();
    }

    private function writeTableHeader(SimplePdfDocument $doc, float $right): void
    {
        $y = $doc->y();

        $this->fill($doc, self::CYAN);
        $doc->text(52, $y, 8, '#', true);
        $doc->text(70, $y, 8, 'ITEM', true);
        $doc->textRight(386, $y, 8, 'QTY', true);
        $doc->textRight(456, $y, 8, 'UNIT PRICE', true);
        $doc->textRight(494, $y, 8, 'DISC.', true);
        $doc->textRight(543, $y, 8, 'AMOUNT', true);
        $this->stroke($doc, self::LINE);
        $doc->line(48, $y - 5, $right, $y - 5, 0.5);
        $this->drawColumnRules($doc, $y + 10, $y - 5);
        $doc->setY($y - 18);
    }

    private function writeItem(SimplePdfDocument $doc, QuotationVersionItem $item, int $position, float $right): void
    {
        $nameLines = $this->wrap($item->product_name_snapshot, 44);
        $rowHeight = max(28, count($nameLines) * 12 + 8);

        $previousPage = $doc->pageCount();
        $doc->ensureSpace($rowHeight);

        if ($doc->pageCount() !== $previousPage) {
            $this->writeTableHeader($doc, $right);
        }

        $top = $doc->y();
        $this->fill($doc, self::MUTED);
        $doc->text(52, $top, 9.5, (string) $position);
        $doc->textRight(386, $top, 9.5, (string) $item->quantity);
        $doc->textRight(456, $top, 9.5, $this->price($item->unit_price));
        $doc->textRight(494, $top, 9.5, $this->price($item->discount));
        $this->fill($doc, self::INK);
        $doc->textRight(543, $top, 9.5, $this->price($item->line_total), true);

        foreach ($nameLines as $index => $line) {
            $doc->text(70, $top - ($index * 12), 9.5, $line);
        }

        $doc->setY($top - $rowHeight);
        $this->stroke($doc, self::RULE);
        $doc->line(48, $doc->y(), $right, $doc->y(), 0.25);
        $this->drawColumnRules($doc, $top + 12, $doc->y());
        $doc->moveY(-8);
    }

    private function writeTotals(SimplePdfDocument $doc, Quotation $quotation): void
    {
        $doc->ensureSpace(122);

        $x1 = 330.0;
        $x2 = 547.0;
        $labelX = 340.0;
        $valueX = 539.0;

        $boxTop = $doc->y();

        $rows = [
            ['Subtotal', $this->price($quotation->subtotal)],
            ['Discount', $this->price($quotation->discount)],
            ['Delivery fee', $this->price($quotation->delivery_fee)],
            [
                sprintf('Service fee (%d%%)', $quotation->service_fee_percentage),
                $this->price($quotation->service_fee),
            ],
        ];

        foreach ($rows as $index => [$label, $value]) {
            $baseline = $boxTop - 18 - ($index * 16);
            $this->fill($doc, self::MUTED);
            $doc->text($labelX, $baseline, 9, $label);
            $this->fill($doc, self::INK);
            $doc->textRight($valueX, $baseline, 9, $value);
        }

        $separatorY = $boxTop - 78;
        $this->stroke($doc, self::CYAN);
        $doc->line($x1, $separatorY, $x2, $separatorY, 0.5);

        $totalBaseline = $boxTop - 96;
        $this->fill($doc, self::CYAN);
        $doc->text($labelX, $totalBaseline, 12, 'TOTAL (COD)', true);
        $doc->textRight($valueX, $totalBaseline, 14, $this->money($quotation->total_amount), true);

        $boxBottom = $boxTop - 110;

        $doc->line($x1, $boxTop, $x2, $boxTop, 0.75);
        $doc->line($x1, $boxBottom, $x2, $boxBottom, 0.75);
        $doc->line($x1, $boxTop, $x1, $boxBottom, 0.75);
        $doc->line($x2, $boxTop, $x2, $boxBottom, 0.75);

        $doc->setY($boxBottom - 14);
    }

    private function sectionHeader(SimplePdfDocument $doc, string $title): void
    {
        $doc->moveY(-18);
        $doc->ensureSpace(90);
        $this->stroke($doc, self::SUBTLE);
        $doc->line(48, $doc->y(), 547, $doc->y(), 0.75);
        $doc->moveY(-18);
        $this->fill($doc, self::CYAN);
        $doc->text(48, $doc->y(), 12, $title, true);
        $doc->moveY(-18);
        $this->fill($doc, self::INK);
    }

    /**
     * Split a free-text field into blank-line separated paragraphs.
     *
     * @return list<string>
     */
    private function paragraphs(string $text): array
    {
        $parts = preg_split('/\R\s*\R/', trim($text)) ?: [];
        $parts = array_map('trim', $parts);

        return array_values(array_filter($parts, static fn (string $part): bool => $part !== ''));
    }

    private function drawColumnRules(SimplePdfDocument $doc, float $top, float $bottom): void
    {
        $this->stroke($doc, self::LINE);

        foreach ([62.0, 340.0, 392.0, 462.0, 500.0] as $x) {
            $doc->line($x, $top, $x, $bottom, 0.5);
        }
    }

    /**
     * @param  array{0: float, 1: float, 2: float}  $color
     */
    private function fill(SimplePdfDocument $doc, array $color): void
    {
        $doc->setTextColor($color[0], $color[1], $color[2]);
    }

    /**
     * @param  array{0: float, 1: float, 2: float}  $color
     */
    private function stroke(SimplePdfDocument $doc, array $color): void
    {
        $doc->setStrokeColor($color[0], $color[1], $color[2]);
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

    private function truncateToWidth(SimplePdfDocument $doc, string $text, float $maxWidth, float $size): string
    {
        if ($doc->textWidth($text, $size) <= $maxWidth) {
            return $text;
        }

        $length = strlen($text);

        while ($length > 0 && $doc->textWidth(substr($text, 0, $length).'...', $size) > $maxWidth) {
            $length--;
        }

        return substr($text, 0, $length).'...';
    }

    private function price(int $amount): string
    {
        return number_format($amount);
    }

    private function money(int $amount): string
    {
        return number_format($amount).' MMK';
    }
}
