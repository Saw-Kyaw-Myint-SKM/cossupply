<?php

namespace App\Services\Media;

use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Streams private (non-public) files from the "local" disk.
 *
 * The local disk root is storage/app/private. Private file paths are never
 * exposed as public URLs; the admin-only stream route authorizes every
 * download and rejects paths that could escape the disk root.
 */
class PrivateFileService
{
    /**
     * Whether the given path is a safe relative path inside the local disk.
     */
    public function isSafePath(?string $path): bool
    {
        if ($path === null || $path === '' || str_contains($path, "\0")) {
            return false;
        }

        $normalized = str_replace('\\', '/', $path);

        if (str_starts_with($normalized, '/') || preg_match('#^[A-Za-z]:#', $normalized) === 1) {
            return false;
        }

        foreach (explode('/', $normalized) as $segment) {
            if ($segment === '' || $segment === '.' || $segment === '..') {
                return false;
            }
        }

        return true;
    }

    /**
     * Whether a safe path resolves to an existing private file.
     */
    public function exists(string $path): bool
    {
        return $this->isSafePath($path) && Storage::disk('local')->exists($path);
    }

    /**
     * Build a streamed response for an existing private file.
     */
    public function response(string $path): StreamedResponse
    {
        return Storage::disk('local')->response($path);
    }
}
