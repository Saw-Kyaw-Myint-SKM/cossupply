<?php

namespace App\Exceptions;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

/**
 * Raised when an action would violate a guarded business rule, such as
 * deleting a catalog record that is still referenced elsewhere.
 *
 * Rendered as a 409 Conflict with the standard error envelope.
 */
class ResourceConflictException extends RuntimeException
{
    /**
     * Render the exception as a 409 JSON response.
     */
    public function render(Request $request): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => $this->getMessage(),
        ], 409);
    }
}
