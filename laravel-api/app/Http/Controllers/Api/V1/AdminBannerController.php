<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\StoreBannerRequest;
use App\Http\Requests\Api\V1\UpdateBannerRequest;
use App\Http\Resources\BannerResource;
use App\Http\Traits\PaginationMeta;
use App\Models\Banner;
use App\Services\Catalog\BannerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminBannerController extends Controller
{
    use PaginationMeta;

    public function __construct(
        private readonly BannerService $banners,
    ) {}

    /**
     * List banners with optional filters and pagination.
     */
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'status' => ['nullable', Rule::in(Banner::STATUSES)],
            'search' => ['nullable', 'string', 'max:100'],
            'sort_by' => ['nullable', Rule::in(['created_at'])],
            'sort_direction' => ['nullable', Rule::in(['asc', 'desc'])],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $banners = $this->banners->paginate($filters);

        return $this->successResponse([
            'banners' => BannerResource::collection($banners->items()),
            'meta' => $this->paginationMeta($banners),
        ]);
    }

    /**
     * Create a banner.
     */
    public function store(StoreBannerRequest $request): JsonResponse
    {
        $banner = $this->banners->create(
            $request->validated(),
            $request->user(),
            $request->file('image'),
            $request->ip(),
        );

        return $this->successResponse(
            ['banner' => new BannerResource($banner)],
            'Banner created.',
            201,
        );
    }

    /**
     * Show a single banner.
     */
    public function show(Banner $banner): JsonResponse
    {
        return $this->successResponse(['banner' => new BannerResource($banner)]);
    }

    /**
     * Update a banner, replacing its image when a new file is uploaded.
     */
    public function update(UpdateBannerRequest $request, Banner $banner): JsonResponse
    {
        $banner = $this->banners->update(
            $banner,
            $request->validated(),
            $request->user(),
            $request->file('image'),
            $request->ip(),
        );

        return $this->successResponse(
            ['banner' => new BannerResource($banner)],
            'Banner updated.',
        );
    }

    /**
     * Delete a banner and its stored image.
     */
    public function destroy(Request $request, Banner $banner): JsonResponse
    {
        $this->banners->delete($banner, $request->user(), $request->ip());

        return $this->successResponse(null, 'Banner deleted.');
    }
}
