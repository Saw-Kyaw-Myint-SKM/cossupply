<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\BulkUpdateSettingRequest;
use App\Http\Requests\Api\V1\UpdateSettingRequest;
use App\Http\Resources\SettingResource;
use App\Models\Setting;
use App\Services\Setting\SettingService;
use Illuminate\Http\JsonResponse;

class AdminSettingController extends Controller
{
    public function __construct(
        private readonly SettingService $settings,
    ) {}

    /**
     * List all master settings.
     */
    public function index(): JsonResponse
    {
        return $this->successResponse([
            'settings' => SettingResource::collection($this->settings->all()),
        ]);
    }

    /**
     * Update a single master setting.
     */
    public function update(UpdateSettingRequest $request, Setting $setting): JsonResponse
    {
        $updated = $this->settings->update(
            $setting->key,
            $request->validated('value'),
            $request->user(),
            $request->ip(),
        );

        return $this->successResponse(
            ['setting' => new SettingResource($updated)],
            'Setting updated.',
        );
    }

    /**
     * Update multiple master settings atomically.
     */
    public function bulkUpdate(BulkUpdateSettingRequest $request): JsonResponse
    {
        $updated = $this->settings->bulkUpdate(
            $request->validated('settings'),
            $request->user(),
            $request->ip(),
        );

        return $this->successResponse(
            ['settings' => SettingResource::collection($updated)],
            'Settings updated.',
        );
    }
}
