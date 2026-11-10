<?php

namespace App\Services\Quotation;

/**
 * Minimal, dependency-free PDF 1.4 writer for the quotation export.
 *
 * It intentionally supports only what the documents need: A4 portrait
 * pages, the four built-in Helvetica weights, text and stroked lines.
 * Using built-in fonts keeps the export self-contained and avoids
 * requiring a PDF package or a font file on the server.
 *
 * Defaults are plain black text and lines with an 8pt black footer, so
 * existing callers such as the cash receipt render unchanged unless they
 * opt into the colour and footer styling helpers.
 */
class SimplePdfDocument
{
    private const PAGE_WIDTH = 595.0;

    private const PAGE_HEIGHT = 842.0;

    private const MARGIN = 48.0;

    private const BOTTOM_MARGIN = 56.0;

    /**
     * Helvetica advance widths in units/1000 for ASCII codes 32..126.
     *
     * @var array<int, int>
     */
    private const HELVETICA_WIDTHS = [
        278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
        556, 556, 556, 556, 556, 556, 556, 556, 556, 556,
        278, 278, 584, 584, 584, 556, 1015,
        667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611,
        278, 278, 278, 469, 556, 333,
        556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500,
        334, 260, 334, 584,
    ];

    /**
     * Helvetica-Bold advance widths in units/1000 for ASCII codes 32..126.
     *
     * @var array<int, int>
     */
    private const HELVETICA_BOLD_WIDTHS = [
        278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
        556, 556, 556, 556, 556, 556, 556, 556, 556, 556,
        333, 333, 584, 584, 584, 611, 975,
        722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611,
        333, 278, 333, 584, 556, 333,
        556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500,
        333, 280, 333, 584,
    ];

    /**
     * @var list<string>
     */
    private array $pages = [];

    private float $y = self::PAGE_HEIGHT - self::MARGIN;

    /**
     * @var array{0: float, 1: float, 2: float}
     */
    private array $textColor = [0.0, 0.0, 0.0];

    /**
     * @var array{0: float, 1: float, 2: float}
     */
    private array $strokeColor = [0.0, 0.0, 0.0];

    private float $footerSize = 8.0;

    /**
     * @var array{0: float, 1: float, 2: float}
     */
    private array $footerColor = [0.0, 0.0, 0.0];

    public function __construct()
    {
        $this->pages[] = '';
    }

    public function y(): float
    {
        return $this->y;
    }

    public function setY(float $y): void
    {
        $this->y = $y;
    }

    public function setTextColor(float $r, float $g, float $b): void
    {
        $this->textColor = [self::clamp($r), self::clamp($g), self::clamp($b)];
    }

    public function setStrokeColor(float $r, float $g, float $b): void
    {
        $this->strokeColor = [self::clamp($r), self::clamp($g), self::clamp($b)];
    }

    public function setFooterStyle(float $size, float $r, float $g, float $b): void
    {
        $this->footerSize = $size;
        $this->footerColor = [self::clamp($r), self::clamp($g), self::clamp($b)];
    }

    public function moveY(float $delta): void
    {
        $this->y += $delta;
    }

    public function pageCount(): int
    {
        return count($this->pages);
    }

    public function newPage(): void
    {
        $this->pages[] = '';
        $this->y = self::PAGE_HEIGHT - self::MARGIN;
    }

    public function ensureSpace(float $needed): void
    {
        if ($this->y - $needed < self::BOTTOM_MARGIN) {
            $this->newPage();
        }
    }

    public function text(float $x, float $y, float $size, string $text, bool $bold = false, bool $italic = false): void
    {
        $font = match (true) {
            $bold && $italic => 'F4',
            $italic => 'F3',
            $bold => 'F2',
            default => 'F1',
        };
        $escaped = $this->escape($text);

        $color = sprintf('%.3F %.3F %.3F rg ', ...$this->textColor);

        $this->append($color.sprintf(
            'BT /%s %.2F Tf 1 0 0 1 %.2F %.2F Tm (%s) Tj ET',
            $font,
            $size,
            $x,
            $y,
            $escaped,
        ));
    }

    public function textRight(float $rightX, float $y, float $size, string $text, bool $bold = false, bool $italic = false): void
    {
        $this->text($rightX - $this->textWidth($text, $size, $bold, $italic), $y, $size, $text, $bold, $italic);
    }

    public function textCenter(float $centerX, float $y, float $size, string $text, bool $bold = false, bool $italic = false): void
    {
        $this->text($centerX - $this->textWidth($text, $size, $bold, $italic) / 2, $y, $size, $text, $bold, $italic);
    }

    /**
     * Width in points of the given text, using the built-in Helvetica metrics.
     *
     * Helvetica-Oblique shares the regular widths and Helvetica-BoldOblique
     * shares the bold widths, so italic alone does not change the table.
     */
    public function textWidth(string $text, float $size, bool $bold = false, bool $italic = false): float
    {
        $table = ($bold || $italic && $bold) ? self::HELVETICA_BOLD_WIDTHS : self::HELVETICA_WIDTHS;

        $width = 0;

        foreach (str_split($text) as $char) {
            // The table is stored as a list starting at ASCII 32 (space).
            $width += $table[ord($char) - 32] ?? 556;
        }

        return $width * $size / 1000.0;
    }

    public function write(
        string $text,
        float $size = 10.0,
        bool $bold = false,
        float $x = self::MARGIN,
        float $gap = 15.0,
        bool $italic = false,
    ): void {
        $this->ensureSpace($gap);
        $this->text($x, $this->y, $size, $text, $bold, $italic);
        $this->y -= $gap;
    }

    public function line(
        float $x1,
        float $y1,
        float $x2,
        float $y2,
        float $width = 0.5,
    ): void {
        $color = sprintf('%.3F %.3F %.3F RG ', ...$this->strokeColor);

        $this->append($color.sprintf(
            '%.2F w %.2F %.2F m %.2F %.2F l S',
            $width,
            $x1,
            $y1,
            $x2,
            $y2,
        ));
    }

    public function output(): string
    {
        $pageCount = count($this->pages);

        foreach ($this->pages as $index => $content) {
            $footer = sprintf(
                'Page %d of %d  |  Generated %s',
                $index + 1,
                $pageCount,
                now()->format('d M Y H:i'),
            );

            $content .= "\n".sprintf('%.3F %.3F %.3F rg ', ...$this->footerColor).sprintf(
                'BT /F1 %.2F Tf 1 0 0 1 %.2F 32 Tm (%s) Tj ET',
                $this->footerSize,
                self::MARGIN,
                $this->escape($footer),
            );

            $this->pages[$index] = $content;
        }

        $pageObjectStart = 3;
        $contentObjectStart = $pageObjectStart + $pageCount;
        $regularFontObject = $contentObjectStart + $pageCount;
        $boldFontObject = $regularFontObject + 1;
        $italicFontObject = $boldFontObject + 1;
        $boldItalicFontObject = $italicFontObject + 1;

        $objects = [];

        $objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';

        $kids = [];
        for ($i = 0; $i < $pageCount; $i++) {
            $kids[] = ($pageObjectStart + $i).' 0 R';
        }

        $objects[2] = sprintf(
            '<< /Type /Pages /Kids [%s] /Count %d >>',
            implode(' ', $kids),
            $pageCount,
        );

        foreach ($this->pages as $index => $content) {
            $pageId = $pageObjectStart + $index;
            $contentId = $contentObjectStart + $index;

            $objects[$pageId] = sprintf(
                '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %.0F %.0F] /Resources << /Font << /F1 %d 0 R /F2 %d 0 R /F3 %d 0 R /F4 %d 0 R >> >> /Contents %d 0 R >>',
                self::PAGE_WIDTH,
                self::PAGE_HEIGHT,
                $regularFontObject,
                $boldFontObject,
                $italicFontObject,
                $boldItalicFontObject,
                $contentId,
            );

            $objects[$contentId] = sprintf(
                "<< /Length %d >>\nstream\n%s\nendstream",
                strlen($content),
                $content,
            );
        }

        $objects[$regularFontObject] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
        $objects[$boldFontObject] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
        $objects[$italicFontObject] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>';
        $objects[$boldItalicFontObject] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-BoldOblique /Encoding /WinAnsiEncoding >>';

        ksort($objects);

        $pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
        $offsets = [];
        $maxObject = max(array_keys($objects));

        for ($id = 1; $id <= $maxObject; $id++) {
            $body = $objects[$id] ?? '<< >>';
            $offsets[$id] = strlen($pdf);
            $pdf .= "{$id} 0 obj\n{$body}\nendobj\n";
        }

        $xrefOffset = strlen($pdf);
        $pdf .= "xref\n0 ".($maxObject + 1)."\n";
        $pdf .= "0000000000 65535 f \n";

        for ($id = 1; $id <= $maxObject; $id++) {
            $pdf .= sprintf("%010d 00000 n \n", $offsets[$id]);
        }

        $pdf .= "trailer\n<< /Size ".($maxObject + 1)." /Root 1 0 R >>\n";
        $pdf .= "startxref\n{$xrefOffset}\n%%EOF\n";

        return $pdf;
    }

    private function append(string $command): void
    {
        $index = count($this->pages) - 1;
        $this->pages[$index] .= $command."\n";
    }

    private static function clamp(float $value): float
    {
        return max(0.0, min(1.0, $value));
    }

    /**
     * Convert UTF-8 text to WinAnsi-compatible bytes and escape the PDF
     * literal-string delimiters.
     */
    private function escape(string $text): string
    {
        $encoded = function_exists('iconv')
            ? @iconv('UTF-8', 'Windows-1252//TRANSLIT//IGNORE', $text)
            : $text;

        if ($encoded === false) {
            $encoded = preg_replace('/[^\x20-\x7E]/', '?', $text) ?? $text;
        }

        $encoded = str_replace(["\r", "\n", "\t"], ' ', $encoded);
        $encoded = preg_replace('/[\x00-\x1F]/', '', $encoded) ?? $encoded;

        return str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $encoded);
    }
}
