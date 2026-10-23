<?php

namespace App\Services\Quotation;

/**
 * Minimal, dependency-free PDF 1.4 writer for the quotation export.
 *
 * It intentionally supports only what the quotation needs: A4 portrait
 * pages, the two built-in Helvetica weights, filled text and lines. Using
 * a built-in font keeps the export self-contained and avoids requiring a
 * PDF package or a font file on the server.
 */
class SimplePdfDocument
{
    private const PAGE_WIDTH = 595.0;

    private const PAGE_HEIGHT = 842.0;

    private const MARGIN = 48.0;

    private const BOTTOM_MARGIN = 56.0;

    /**
     * @var list<string>
     */
    private array $pages = [];

    private float $y = self::PAGE_HEIGHT - self::MARGIN;

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

    public function text(float $x, float $y, float $size, string $text, bool $bold = false): void
    {
        $font = $bold ? 'F2' : 'F1';
        $escaped = $this->escape($text);

        $this->append(sprintf(
            "BT /%s %.2F Tf 1 0 0 1 %.2F %.2F Tm (%s) Tj ET",
            $font,
            $size,
            $x,
            $y,
            $escaped,
        ));
    }

    public function textRight(float $rightX, float $y, float $size, string $text, bool $bold = false): void
    {
        $width = strlen($text) * $size * 0.52;
        $this->text($rightX - $width, $y, $size, $text, $bold);
    }

    public function write(
        string $text,
        float $size = 10.0,
        bool $bold = false,
        float $x = self::MARGIN,
        float $gap = 15.0,
    ): void {
        $this->ensureSpace($gap);
        $this->text($x, $this->y, $size, $text, $bold);
        $this->y -= $gap;
    }

    public function line(
        float $x1,
        float $y1,
        float $x2,
        float $y2,
        float $width = 0.5,
    ): void {
        $this->append(sprintf(
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

            $content .= "\n".sprintf(
                "BT /F1 8 Tf 1 0 0 1 %.2F 32 Tm (%s) Tj ET",
                self::MARGIN,
                $this->escape($footer),
            );

            $this->pages[$index] = $content;
        }

        $pageObjectStart = 3;
        $contentObjectStart = $pageObjectStart + $pageCount;
        $regularFontObject = $contentObjectStart + $pageCount;
        $boldFontObject = $regularFontObject + 1;

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
                '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %.0F %.0F] /Resources << /Font << /F1 %d 0 R /F2 %d 0 R >> >> /Contents %d 0 R >>',
                self::PAGE_WIDTH,
                self::PAGE_HEIGHT,
                $regularFontObject,
                $boldFontObject,
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
