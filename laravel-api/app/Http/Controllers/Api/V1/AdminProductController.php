<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\ProductStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\StoreProductRequest;
use App\Http\Requests\Api\V1\UpdateProductRequest;
use App\Http\Requests\Api\V1\UpdateProductStatusRequest;
use App\Http\Resources\ProductResource;
use App\Http\Traits\PaginationMeta;
use App\Models\Product;
use App\Services\Catalog\ProductService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminProductController extends Controller
{
    use PaginationMeta;

    public function __construct(
        private readonly ProductService $products,
    ) {}

    /**
     * List products with optional filters and pagination.
     */
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'status' => ['nullable', Rule::in(ProductStatus::values())],
            'category_id' => ['nullable', 'integer', 'exists:categories,id'],
            'supplier_id' => ['nullable', 'integer', 'exists:suppliers,id'],
            'search' => ['nullable', 'string', 'max:100'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $products = $this->products->paginate($filters);

        return $this->successResponse([
            'products' => ProductResource::collection($products->items()),
            'meta' => $this->paginationMeta($products),
        ]);
    }

    /**
     * Create a product with its embedded price and stock fields.
     */
    public function store(StoreProductRequest $request): JsonResponse
    {
        $product = $this->products->create(
            $request->validated(),
            $request->user(),
            $request->file('photo'),
            $request->ip(),
        );

        return $this->successResponse(
            ['product' => new ProductResource($product)],
            'Product created.',
            201,
        );
    }

    /**
     * Show a single product with its price and stock.
     */
    public function show(Product $product): JsonResponse
    {
        $product->load(['category', 'supplier', 'prices', 'stock']);

        return $this->successResponse(['product' => new ProductResource($product)]);
    }

    /**
     * Update a product, replacing its photo when a new file is uploaded.
     */
    public function update(UpdateProductRequest $request, Product $product): JsonResponse
    {
        $product = $this->products->update(
            $product,
            $request->validated(),
            $request->user(),
            $request->file('photo'),
            $request->ip(),
        );

        return $this->successResponse(
            ['product' => new ProductResource($product)],
            'Product updated.',
        );
    }

    /**
     * Change the product status (DRAFT, PUBLISHED, HIDDEN, OUT_OF_STOCK).
     */
    public function updateStatus(UpdateProductStatusRequest $request, Product $product): JsonResponse
    {
        $product = $this->products->updateStatus(
            $product,
            $request->validated('status'),
            $request->user(),
            $request->ip(),
        );

        return $this->successResponse(
            ['product' => new ProductResource($product)],
            'Product status updated.',
        );
    }

    /**
     * Delete an unreferenced product with its price, stock and photo.
     */
    public function destroy(Request $request, Product $product): JsonResponse
    {
        $this->products->delete($product, $request->user(), $request->ip());

        return $this->successResponse(null, 'Product deleted.');
    }
}
