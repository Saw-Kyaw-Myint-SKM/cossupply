<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\ProductStatus;
use App\Enums\StockStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\PublicProductResource;
use App\Http\Traits\PaginationMeta;
use App\Models\Product;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Guest-facing catalog read API.
 *
 * Every endpoint is public: no token is required. Only PUBLISHED products
 * are exposed; a published product whose stock row reads OUT_OF_STOCK stays
 * browsable here and is filtered out of cart eligibility instead.
 */
class PublicProductController extends Controller
{
    use PaginationMeta;

    /**
     * List published products with optional guest filters.
     */
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'category_id' => ['nullable', 'integer', 'exists:categories,id'],
            'supplier_id' => ['nullable', 'integer', 'exists:suppliers,id'],
            'stock_status' => ['nullable', Rule::in(StockStatus::values())],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $products = Product::query()
            ->where('status', ProductStatus::PUBLISHED->value)
            ->with(['category', 'supplier', 'prices', 'stock'])
            ->when(filled($filters['category_id'] ?? null), fn (Builder $query): Builder => $query->where('category_id', $filters['category_id']))
            ->when(filled($filters['supplier_id'] ?? null), fn (Builder $query): Builder => $query->where('supplier_id', $filters['supplier_id']))
            ->when(filled($filters['stock_status'] ?? null), fn (Builder $query): Builder => $query->whereHas(
                'stock',
                fn (Builder $stock): Builder => $stock->where('stock_status', $filters['stock_status']),
            ))
            ->when(filled($filters['search'] ?? null), function (Builder $query) use ($filters): void {
                $search = $filters['search'];

                $query->where(function (Builder $query) use ($search): void {
                    $query->where('name_mm', 'like', "%{$search}%")
                        ->orWhere('name_en', 'like', "%{$search}%")
                        ->orWhere('sku', 'like', "%{$search}%")
                        ->orWhere('brand', 'like', "%{$search}%")
                        ->orWhere('model', 'like', "%{$search}%");
                });
            })
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate($filters['per_page'] ?? 15);

        return $this->successResponse([
            'products' => PublicProductResource::collection($products->items()),
            'meta' => $this->paginationMeta($products),
        ]);
    }

    /**
     * Show a single published product, or 404 for any non-published one.
     *
     * The lookup is done in the controller rather than by implicit route
     * binding so that unpublished, unknown and malformed ids all return the
     * same public 404 body instead of leaking which ids exist.
     */
    public function show(string $productId): JsonResponse
    {
        $product = ctype_digit($productId)
            ? Product::query()
                ->whereKey((int) $productId)
                ->where('status', ProductStatus::PUBLISHED->value)
                ->with(['category', 'supplier', 'prices', 'stock'])
                ->first()
            : null;

        if ($product === null) {
            return $this->notFoundResponse('Product not found.');
        }

        return $this->successResponse(['product' => new PublicProductResource($product)]);
    }
}
