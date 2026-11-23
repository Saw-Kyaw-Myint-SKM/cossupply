<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\PublicBannerResource;
use App\Models\Banner;
use Illuminate\Http\JsonResponse;

/**
 * Guest-facing home-page banners. Only ACTIVE banners are exposed, ordered by
 * the admin-defined sort order.
 */
class PublicBannerController extends Controller
{
    /**
     * List active banners in display order.
     */
    public function index(): JsonResponse
    {
        $banners = Banner::query()
            ->active()
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        return $this->successResponse([
            'banners' => PublicBannerResource::collection($banners),
        ]);
    }
}
