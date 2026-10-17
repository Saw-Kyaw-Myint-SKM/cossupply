<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

class HealthController extends Controller
{
    /**
     * Check API health status.
     */
    public function check(): JsonResponse
    {
        return $this->successResponse([
            'status' => 'healthy',
            'timestamp' => now()->setTimezone('Asia/Yangon')->toIso8601String(),
            'timezone' => 'Asia/Yangon',
        ]);
    }
}
