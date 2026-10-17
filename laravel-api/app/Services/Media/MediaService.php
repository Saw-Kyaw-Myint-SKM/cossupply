<?php

namespace App\Services\Media;

use GdImage;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use InvalidArgumentException;
use RuntimeException;

/**
 * Stores and removes public catalog images on the "public" disk.
 *
 * When the native GD extension is available, images are downscaled to a
 * display-safe maximum dimension and re-encoded; otherwise the original
 * bytes are stored unchanged. No external image package is required.
 */
class MediaService
{
    /**
     * Longest edge allowed for a stored image, in pixels.
     */
    public const MAX_DIMENSION = 2000;

    private const JPEG_QUALITY = 82;

    private const WEBP_QUALITY = 82;

    private const PNG_COMPRESSION = 8;

    /**
     * Allowed public image extensions.
     *
     * @var list<string>
     */
    public const ALLOWED_EXTENSIONS = ['jpeg', 'jpg', 'png', 'webp'];

    /**
     * Store an uploaded image inside the given public directory and return
     * the stored path relative to the public disk root.
     *
     * @throws InvalidArgumentException
     * @throws RuntimeException
     */
    public function storePublicImage(UploadedFile $file, string $directory): string
    {
        $directory = trim($directory, '/');

        if ($directory === '') {
            throw new InvalidArgumentException('A storage directory is required.');
        }

        $extension = $this->extensionFor($file);
        $path = $directory.'/'.Str::random(40).'.'.$extension;

        Storage::disk('public')->put($path, $this->optimizedContents($file));

        return $path;
    }

    /**
     * Delete a stored public file when a path is present.
     */
    public function deletePublicFile(?string $path): void
    {
        if ($path === null || trim($path) === '') {
            return;
        }

        Storage::disk('public')->delete($path);
    }

    /**
     * Build the absolute public URL for a stored relative path.
     */
    public function publicUrl(?string $path): ?string
    {
        if ($path === null || trim($path) === '') {
            return null;
        }

        return url(Storage::disk('public')->url($path));
    }

    /**
     * Resolve the safe stored extension for an uploaded image.
     */
    private function extensionFor(UploadedFile $file): string
    {
        $extension = strtolower($file->extension() ?: $file->getClientOriginalExtension());

        if ($extension === 'jpeg') {
            $extension = 'jpg';
        }

        return in_array($extension, self::ALLOWED_EXTENSIONS, true) ? $extension : 'jpg';
    }

    /**
     * Return optimized image bytes, falling back to the original bytes when
     * GD is unavailable or the file cannot be decoded.
     *
     * @throws RuntimeException
     */
    private function optimizedContents(UploadedFile $file): string
    {
        $raw = file_get_contents($file->getRealPath());

        if ($raw === false) {
            throw new RuntimeException('Unable to read the uploaded file.');
        }

        if (! extension_loaded('gd')) {
            return $raw;
        }

        $image = @imagecreatefromstring($raw);

        if ($image === false) {
            return $raw;
        }

        try {
            $image = $this->downscale($image);
            $encoded = $this->encode($image, (string) $file->getMimeType());
        } finally {
            imagedestroy($image);
        }

        return $encoded ?? $raw;
    }

    /**
     * Downscale an image so its longest edge fits the maximum dimension.
     */
    private function downscale(GdImage $image): GdImage
    {
        $width = imagesx($image);
        $height = imagesy($image);
        $longest = max($width, $height);

        if ($longest <= self::MAX_DIMENSION) {
            return $image;
        }

        $scale = self::MAX_DIMENSION / $longest;

        $resized = imagescale(
            $image,
            max(1, (int) round($width * $scale)),
            max(1, (int) round($height * $scale)),
            IMG_BICUBIC,
        );

        if ($resized === false) {
            return $image;
        }

        imagedestroy($image);

        return $resized;
    }

    /**
     * Encode a GD image as its original format, or null on failure.
     */
    private function encode(GdImage $image, string $mimeType): ?string
    {
        ob_start();

        $encoded = match ($mimeType) {
            'image/jpeg' => imagejpeg($image, null, self::JPEG_QUALITY),
            'image/png' => $this->encodePng($image),
            'image/webp' => function_exists('imagewebp') ? imagewebp($image, null, self::WEBP_QUALITY) : false,
            default => false,
        };

        $contents = ob_get_clean();

        return $encoded === true && is_string($contents) && $contents !== '' ? $contents : null;
    }

    /**
     * Encode a PNG image while preserving its alpha channel.
     */
    private function encodePng(GdImage $image): bool
    {
        imagealphablending($image, false);
        imagesavealpha($image, true);

        return imagepng($image, null, self::PNG_COMPRESSION);
    }
}
