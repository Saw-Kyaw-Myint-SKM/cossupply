<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Media\PrivateFileService;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AdminPrivateFileController extends Controller
{
    public function __construct(
        private readonly PrivateFileService $files,
    ) {}

    /**
     * Stream a private file to the authenticated admin.
     *
     * The path is validated against traversal and absolute paths; missing
     * or unsafe paths return a 404 without revealing private locations.
     */
    public function show(string $path): StreamedResponse|JsonResponse
    {
        if (! $this->files->exists($path)) {
            return $this->notFoundResponse('File not found.');
        }

        return $this->files->response($path);
    }
}
