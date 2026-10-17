<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\PublicCategoryResource;
use App\Http\Traits\PaginationMeta;
use App\Models\Category;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Guest-facing category navigation list. Only ACTIVE categories are shown,
 * so deactivated branches disappear from the public catalog immediately.
 */
class PublicCategoryController extends Controller
{
    use PaginationMeta;

    /**
     * List active categories with optional parent and search filters.
     */
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'parent_id' => ['nullable', 'integer', 'exists:categories,id'],
            'search' => ['nullable', 'string', 'max:100'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $categories = Category::query()
            ->where('status', Category::STATUS_ACTIVE)
            ->when(filled($filters['parent_id'] ?? null), fn (Builder $query): Builder => $query->where('parent_id', $filters['parent_id']))
            ->when(filled($filters['search'] ?? null), function (Builder $query) use ($filters): void {
                $search = $filters['search'];

                $query->where(function (Builder $query) use ($search): void {
                    $query->where('name_mm', 'like', "%{$search}%")
                        ->orWhere('name_en', 'like', "%{$search}%");
                });
            })
            ->orderBy('sort_order')
            ->orderBy('name_en')
            ->orderBy('id')
            ->paginate($filters['per_page'] ?? 15);

        return $this->successResponse([
            'categories' => PublicCategoryResource::collection($categories->items()),
            'meta' => $this->paginationMeta($categories),
        ]);
    }
}
