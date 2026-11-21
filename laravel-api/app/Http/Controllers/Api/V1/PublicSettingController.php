<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Setting\SettingService;
use Illuminate\Http\JsonResponse;

/**
 * Guest-facing master settings.
 *
 * Only settings flagged `is_public` are exposed, returned as a typed
 * key => value map so the storefront can read display preferences such as
 * `storefront_supplier_display` without an admin token.
 */
class PublicSettingController extends Controller
{
    public function __construct(
        private readonly SettingService $settings,
    ) {}

    /**
     * List the public settings as key => typed value pairs.
     */
    public function index(): JsonResponse
    {
        return $this->successResponse([
            'settings' => $this->settings->publicValues(),
        ]);
    }
}
