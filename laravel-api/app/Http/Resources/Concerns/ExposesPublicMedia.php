<?php

namespace App\Http\Resources\Concerns;

use Illuminate\Support\Facades\Storage;

/**
 * Builds absolute public media URLs from a stored relative path without
 * exposing any private file location.
 */
trait ExposesPublicMedia
{
    protected function publicMediaUrl(?string $path): ?string
    {
        if ($path === null || trim($path) === '') {
            return null;
        }

        return url(Storage::disk('public')->url($path));
    }
}
