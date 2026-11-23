<?php

namespace App\Services\Pdf;

/**
 * Builds the brand block shown at the top of printable documents.
 *
 * The logo is embedded as a base64 data URI so mPDF does not depend on a
 * public URL, the document root or the current working directory when it
 * resolves the image. Replacing resources/images/cosupply-logo.png changes
 * the header of every newly rendered quotation and cash receipt.
 */
class PdfBrand
{
    /**
     * Path, relative to the resources directory.
     */
    private const LOGO_PATH = 'images/cosupply-logo.png';

    /**
     * Printed logo height in pixels (1px = 1/96in inside mPDF).
     */
    private const DEFAULT_HEIGHT = 48;

    /**
     * Encoded logo shared by every document rendered in this process.
     */
    private static ?string $dataUri = null;

    /**
     * Build the header image, falling back to the plain company name when the
     * bundled asset is unavailable.
     */
    public function header(string $companyName, int $height = self::DEFAULT_HEIGHT): string
    {
        $path = resource_path(self::LOGO_PATH);
        $size = is_file($path) ? @getimagesize($path) : false;
        $dataUri = $size === false ? null : $this->dataUri($path);

        if ($size === false || $size[0] < 1 || $size[1] < 1 || $dataUri === null) {
            return '<div class="brand">'.$this->e($companyName).'</div>';
        }

        $width = (int) round($height * $size[0] / $size[1]);

        return '<div class="brand-logo-wrap">'
            .'<img src="'.$dataUri.'"'
            .' width="'.$width.'" height="'.$height.'"'
            .' alt="'.$this->e($companyName).'" class="brand-logo">'
            .'</div>';
    }

    /**
     * Encode the logo once per process; mPDF accepts PNG data URIs directly.
     */
    private function dataUri(string $path): ?string
    {
        if (self::$dataUri === null) {
            $contents = @file_get_contents($path);

            self::$dataUri = is_string($contents) && $contents !== ''
                ? 'data:image/png;base64,'.base64_encode($contents)
                : '';
        }

        return self::$dataUri !== '' ? self::$dataUri : null;
    }

    private function e(string $value): string
    {
        return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }
}
