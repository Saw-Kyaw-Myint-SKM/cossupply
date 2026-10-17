<?php

namespace App\Http\Traits;

use Illuminate\Http\JsonResponse;

trait ApiResponse
{
    /**
     * Send a success JSON response.
     *
     * @param mixed  $data    The response data
     * @param string $message Optional success message
     * @param int    $status  HTTP status code (default 200)
     *
     * @return JsonResponse
     */
    protected function successResponse(mixed $data, string $message = '', int $status = 200): JsonResponse
    {
        $response = [
            'success' => true,
            'data' => $data,
        ];

        if ($message) {
            $response['message'] = $message;
        }

        return response()->json($response, $status);
    }

    /**
     * Send an error JSON response.
     *
     * @param string $message Error message
     * @param int    $status  HTTP status code (default 400)
     * @param array  $errors  Optional validation errors
     *
     * @return JsonResponse
     */
    protected function errorResponse(string $message, int $status = 400, ?array $errors = null): JsonResponse
    {
        $response = [
            'success' => false,
            'message' => $message,
        ];

        if ($errors !== null) {
            $response['errors'] = $errors;
        }

        return response()->json($response, $status);
    }

    /**
     * Send a validation error JSON response.
     *
     * @param array  $errors  Validation errors array
     * @param string $message Error message (default: 'Validation failed')
     *
     * @return JsonResponse
     */
    protected function validationErrorResponse(array $errors, string $message = 'Validation failed'): JsonResponse
    {
        return $this->errorResponse($message, 422, $errors);
    }

    /**
     * Send an unauthorized JSON response.
     *
     * @param string $message Error message (default: 'Unauthorized')
     *
     * @return JsonResponse
     */
    protected function unauthorizedResponse(string $message = 'Unauthorized'): JsonResponse
    {
        return $this->errorResponse($message, 401);
    }

    /**
     * Send a forbidden JSON response.
     *
     * @param string $message Error message (default: 'Forbidden')
     *
     * @return JsonResponse
     */
    protected function forbiddenResponse(string $message = 'Forbidden'): JsonResponse
    {
        return $this->errorResponse($message, 403);
    }

    /**
     * Send a not found JSON response.
     *
     * @param string $message Error message (default: 'Resource not found')
     *
     * @return JsonResponse
     */
    protected function notFoundResponse(string $message = 'Resource not found'): JsonResponse
    {
        return $this->errorResponse($message, 404);
    }
}
