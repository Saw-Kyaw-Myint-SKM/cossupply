<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\StoreCategoryRequest;
use App\Http\Requests\Api\V1\UpdateCategoryRequest;
use App\Http\Resources\CategoryResource;
use App\Http\Traits\PaginationMeta;
use App\Models\Category;
use App\Services\Catalog\CategoryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminCategoryController extends Controller
{
    use PaginationMeta;

    public function __construct(
        private readonly CategoryService $categories,
    ) {}

    /**
     * List categories with optional filters and pagination.
     */
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'parent_id' => ['nullable', 'integer', 'exists:categories,id'],
            'status' => ['nullable', Rule::in(Category::STATUSES)],
            'search' => ['nullable', 'string', 'max:100'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $categories = $this->categories->paginate($filters);

        return $this->successResponse([
            'categories' => CategoryResource::collection($categories->items()),
            'meta' => $this->paginationMeta($categories),
        ]);
    }

    /**
     * Create a category.
     */
    public function store(StoreCategoryRequest $request): JsonResponse
    {
        $category = $this->categories->create(
            $request->validated(),
            $request->user(),
            $request->file('image'),
            $request->ip(),
        );

        return $this->successResponse(
            ['category' => new CategoryResource($category)],
            'Category created.',
            201,
        );
    }

    /**
     * Show a single category.
     */
    public function show(Category $category): JsonResponse
    {
        return $this->successResponse(['category' => new CategoryResource($category)]);
    }

    /**
     * Update a category, replacing its image when a new file is uploaded.
     */
    public function update(UpdateCategoryRequest $request, Category $category): JsonResponse
    {
        $category = $this->categories->update(
            $category,
            $request->validated(),
            $request->user(),
            $request->file('image'),
            $request->ip(),
        );

        return $this->successResponse(
            ['category' => new CategoryResource($category)],
            'Category updated.',
        );
    }

    /**
     * Delete an unreferenced category.
     */
    public function destroy(Request $request, Category $category): JsonResponse
    {
        $this->categories->delete($category, $request->user(), $request->ip());

        return $this->successResponse(null, 'Category deleted.');
    }
}
