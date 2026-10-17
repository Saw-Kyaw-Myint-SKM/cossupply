<?php

namespace App\Services\Catalog;

use App\Enums\ProductStatus;
use App\Enums\StockStatus;
use App\Enums\SupplierStatus;
use App\Exceptions\ResourceConflictException;
use App\Models\Admin;
use App\Models\Category;
use App\Models\Product;
use App\Models\ProductPrice;
use App\Models\ProductStock;
use App\Services\Audit\AuditLogService;
use App\Services\Media\MediaService;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\QueryException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Admin management of products together with their price and stock rows.
 *
 * Publishing is guarded: a product can only become PUBLISHED when its
 * supplier and category are active, it has a photo and its retail price is
 * greater than zero. Every catalog mutation is audited.
 */
class ProductService
{
    private const PHOTO_DIRECTORY = 'products';

    /**
     * Product columns accepted from the request data.
     *
     * @var list<string>
     */
    private const PRODUCT_FIELDS = [
        'supplier_id', 'category_id', 'name_mm', 'name_en', 'sku', 'brand', 'model',
        'description', 'specification', 'size', 'color', 'unit', 'package_size',
    ];

    /**
     * Flat price fields embedded in product create/update requests.
     *
     * @var list<string>
     */
    private const PRICE_FIELDS = [
        'retail_price', 'wholesale_price', 'discount_price', 'minimum_order_quantity', 'price_valid_until',
    ];

    /**
     * Flat stock fields embedded in product create/update requests.
     *
     * @var list<string>
     */
    private const STOCK_FIELDS = ['stock_quantity', 'stock_status', 'supplier_note'];

    public function __construct(
        private readonly AuditLogService $auditLogs,
        private readonly MediaService $media,
    ) {}

    /**
     * Paginate products with optional filters.
     *
     * @param  array<string, mixed>  $filters
     */
    public function paginate(array $filters): LengthAwarePaginator
    {
        return Product::query()
            ->with(['category', 'supplier', 'prices', 'stock'])
            ->when(filled($filters['status'] ?? null), fn (Builder $query): Builder => $query->where('status', $filters['status']))
            ->when(filled($filters['category_id'] ?? null), fn (Builder $query): Builder => $query->where('category_id', $filters['category_id']))
            ->when(filled($filters['supplier_id'] ?? null), fn (Builder $query): Builder => $query->where('supplier_id', $filters['supplier_id']))
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
            ->paginate($this->perPage($filters));
    }

    /**
     * Create a product with its price and stock rows.
     *
     * A request may create the product directly as PUBLISHED; the publish
     * rules then apply immediately.
     *
     * @param  array<string, mixed>  $data
     */
    public function create(array $data, Admin $admin, ?UploadedFile $photo = null, ?string $ip = null): Product
    {
        $photoPath = $photo !== null ? $this->media->storePublicImage($photo, self::PHOTO_DIRECTORY) : null;

        try {
            $product = DB::transaction(function () use ($data, $admin, $photoPath, $ip): Product {
                $product = Product::create([
                    ...Arr::only($data, self::PRODUCT_FIELDS),
                    'slug' => $data['slug'] ?? Str::slug((string) ($data['name_en'] ?? '')),
                    'photo' => $photoPath,
                    'status' => $data['status'] ?? ProductStatus::DRAFT->value,
                    'created_by_admin_id' => $admin->id,
                ]);

                $price = $this->writePrice($product, $data, $admin);
                $stock = $this->writeStock($product, $data, $admin);

                if ($product->status === ProductStatus::PUBLISHED) {
                    $this->assertPublishable($product);
                }

                $this->auditLogs->log(
                    $admin,
                    'product.created',
                    'product',
                    (string) $product->id,
                    [],
                    $this->snapshot($product),
                    $ip,
                );

                if ($price !== null) {
                    $this->auditLogs->log(
                        $admin,
                        'product.price_updated',
                        'product',
                        (string) $product->id,
                        [],
                        $this->priceSnapshot($price),
                        $ip,
                    );
                }

                if ($stock !== null) {
                    $this->auditLogs->log(
                        $admin,
                        'product.stock_updated',
                        'product',
                        (string) $product->id,
                        [],
                        $this->stockSnapshot($stock),
                        $ip,
                    );
                }

                return $product;
            });
        } catch (Throwable $exception) {
            $this->media->deletePublicFile($photoPath);

            throw $exception;
        }

        return $this->loadDetail($product);
    }

    /**
     * Update a product, replacing its photo when a new one is uploaded.
     *
     * @param  array<string, mixed>  $data
     */
    public function update(Product $product, array $data, Admin $admin, ?UploadedFile $photo = null, ?string $ip = null): Product
    {
        $oldData = $this->snapshot($product);
        $oldPhoto = $product->photo;
        $oldPrice = $product->prices()->orderBy('id')->first();
        $oldStock = $product->stock()->first();
        $oldPriceData = $oldPrice !== null ? $this->priceSnapshot($oldPrice) : null;
        $oldStockData = $oldStock !== null ? $this->stockSnapshot($oldStock) : null;

        $newPhoto = $photo !== null ? $this->media->storePublicImage($photo, self::PHOTO_DIRECTORY) : null;

        try {
            DB::transaction(function () use ($product, $data, $admin, $newPhoto, $oldData, $oldPriceData, $oldStockData, $ip): void {
                $attributes = Arr::only($data, self::PRODUCT_FIELDS);

                if (array_key_exists('slug', $data)) {
                    $attributes['slug'] = $data['slug'];
                }

                if ($newPhoto !== null) {
                    $attributes['photo'] = $newPhoto;
                }

                $product->update($attributes);

                $price = $this->writePrice($product, $data, $admin);
                $stock = $this->writeStock($product, $data, $admin);

                $newData = $this->snapshot($product);

                if ($newData !== $oldData) {
                    $this->auditLogs->log(
                        $admin,
                        'product.updated',
                        'product',
                        (string) $product->id,
                        $oldData,
                        $newData,
                        $ip,
                    );
                }

                if ($price !== null && $this->priceSnapshot($price) !== $oldPriceData) {
                    $this->auditLogs->log(
                        $admin,
                        'product.price_updated',
                        'product',
                        (string) $product->id,
                        $oldPriceData ?? [],
                        $this->priceSnapshot($price),
                        $ip,
                    );
                }

                if ($stock !== null && $this->stockSnapshot($stock) !== $oldStockData) {
                    $this->auditLogs->log(
                        $admin,
                        'product.stock_updated',
                        'product',
                        (string) $product->id,
                        $oldStockData ?? [],
                        $this->stockSnapshot($stock),
                        $ip,
                    );
                }
            });
        } catch (Throwable $exception) {
            $this->media->deletePublicFile($newPhoto);

            throw $exception;
        }

        if ($newPhoto !== null) {
            $this->media->deletePublicFile($oldPhoto);
        }

        return $this->loadDetail($product);
    }

    /**
     * Change a product status, applying the publish rules on transition.
     *
     * @throws ValidationException
     */
    public function updateStatus(Product $product, string $status, Admin $admin, ?string $ip = null): Product
    {
        $newStatus = ProductStatus::from($status);
        $oldStatus = $product->status;

        DB::transaction(function () use ($product, $newStatus, $oldStatus, $admin, $ip): void {
            if ($oldStatus === $newStatus) {
                return;
            }

            if ($newStatus === ProductStatus::PUBLISHED) {
                $this->assertPublishable($product);
            }

            $product->update(['status' => $newStatus->value]);

            $this->auditLogs->log(
                $admin,
                'product.status_updated',
                'product',
                (string) $product->id,
                ['status' => $oldStatus->value],
                ['status' => $newStatus->value],
                $ip,
            );
        });

        return $this->loadDetail($product);
    }

    /**
     * Delete an unreferenced product with its price, stock and photo.
     *
     * @throws ResourceConflictException
     */
    public function delete(Product $product, Admin $admin, ?string $ip = null): void
    {
        $photo = $product->photo;
        $snapshot = $this->snapshot($product);

        DB::transaction(function () use ($product, $snapshot, $admin, $ip): void {
            $this->assertNotReferenced($product);

            ProductPrice::query()->where('product_id', $product->id)->delete();
            ProductStock::query()->where('product_id', $product->id)->delete();

            try {
                $product->delete();
            } catch (QueryException $exception) {
                throw new ResourceConflictException(
                    'Product cannot be deleted because it is still referenced by quotation or order records.',
                    previous: $exception,
                );
            }

            $this->auditLogs->log(
                $admin,
                'product.deleted',
                'product',
                (string) $product->id,
                $snapshot,
                [],
                $ip,
            );
        });

        $this->media->deletePublicFile($photo);
    }

    /**
     * Assert that a product satisfies every publish precondition.
     *
     * @throws ValidationException
     */
    private function assertPublishable(Product $product): void
    {
        $errors = [];

        $supplier = $product->supplier()->first();

        if ($supplier === null || $supplier->status !== SupplierStatus::ACTIVE) {
            $errors['supplier_id'][] = 'The product supplier must exist and be active before publishing.';
        }

        $category = $product->category()->first();

        if ($category === null || $category->status !== Category::STATUS_ACTIVE) {
            $errors['category_id'][] = 'The product category must exist and be active before publishing.';
        }

        if ($product->photo === null || trim($product->photo) === '') {
            $errors['photo'][] = 'A photo is required before publishing a product.';
        }

        $price = $product->prices()->orderBy('id')->first();

        if ($price === null || $price->retail_price <= 0) {
            $errors['retail_price'][] = 'A retail price greater than zero is required before publishing a product.';
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }
    }

    /**
     * Assert that the product is not referenced by quotation or order rows.
     *
     * @throws ResourceConflictException
     */
    private function assertNotReferenced(Product $product): void
    {
        $referenced = $product->quotationItems()->exists()
            || $product->quotationVersionItems()->exists()
            || $product->orderItems()->exists();

        if ($referenced) {
            throw new ResourceConflictException(
                'Product cannot be deleted because it is referenced by quotation or order records.',
            );
        }
    }

    /**
     * Create or update the product price row when price fields are present.
     *
     * @param  array<string, mixed>  $data
     *
     * @throws ValidationException
     */
    private function writePrice(Product $product, array $data, Admin $admin): ?ProductPrice
    {
        if (array_intersect(self::PRICE_FIELDS, array_keys($data)) === []) {
            return null;
        }

        $price = $product->prices()->orderBy('id')->first();

        if ($price === null) {
            if (! array_key_exists('retail_price', $data)) {
                throw ValidationException::withMessages([
                    'retail_price' => ['A retail price is required when price data is first created.'],
                ]);
            }

            $price = new ProductPrice(['product_id' => $product->id]);
        }

        foreach (self::PRICE_FIELDS as $field) {
            if (array_key_exists($field, $data)) {
                $price->{$field} = $data[$field];
            }
        }

        $price->last_updated_at = now();
        $price->updated_by_admin_id = $admin->id;
        $price->save();

        return $price;
    }

    /**
     * Create or update the product stock row when stock fields are present.
     *
     * @param  array<string, mixed>  $data
     */
    private function writeStock(Product $product, array $data, Admin $admin): ?ProductStock
    {
        if (array_intersect(self::STOCK_FIELDS, array_keys($data)) === []) {
            return null;
        }

        $stock = $product->stock()->first();

        if ($stock === null) {
            $stock = new ProductStock([
                'product_id' => $product->id,
                'stock_status' => $data['stock_status'] ?? StockStatus::SUPPLIER_CONFIRMATION_REQUIRED->value,
            ]);
        }

        foreach (['stock_quantity', 'stock_status', 'supplier_note'] as $field) {
            if (array_key_exists($field, $data)) {
                $stock->{$field} = $data[$field];
            }
        }

        $stock->supplier_id = $product->supplier_id;
        $stock->last_confirmed_at = now();
        $stock->confirmed_by_admin_id = $admin->id;
        $stock->save();

        return $stock;
    }

    /**
     * Eager-load the relations returned by the product API resource.
     */
    private function loadDetail(Product $product): Product
    {
        return $product->load(['category', 'supplier', 'prices', 'stock']);
    }

    /**
     * Audit-friendly product representation.
     *
     * @return array<string, mixed>
     */
    private function snapshot(Product $product): array
    {
        return [
            'supplier_id' => $product->supplier_id,
            'category_id' => $product->category_id,
            'name_mm' => $product->name_mm,
            'name_en' => $product->name_en,
            'slug' => $product->slug,
            'sku' => $product->sku,
            'brand' => $product->brand,
            'model' => $product->model,
            'description' => $product->description,
            'specification' => $product->specification,
            'size' => $product->size,
            'color' => $product->color,
            'unit' => $product->unit,
            'package_size' => $product->package_size,
            'photo' => $product->photo,
            'status' => $product->status->value,
        ];
    }

    /**
     * Audit-friendly price representation.
     *
     * @return array<string, mixed>
     */
    private function priceSnapshot(ProductPrice $price): array
    {
        return [
            'retail_price' => $price->retail_price,
            'wholesale_price' => $price->wholesale_price,
            'discount_price' => $price->discount_price,
            'minimum_order_quantity' => $price->minimum_order_quantity,
            'price_valid_until' => $price->price_valid_until?->toDateString(),
        ];
    }

    /**
     * Audit-friendly stock representation.
     *
     * @return array<string, mixed>
     */
    private function stockSnapshot(ProductStock $stock): array
    {
        return [
            'stock_quantity' => $stock->stock_quantity,
            'stock_status' => $stock->stock_status->value,
            'supplier_note' => $stock->supplier_note,
        ];
    }

    /**
     * Clamp the requested page size to the allowed range.
     *
     * @param  array<string, mixed>  $filters
     */
    private function perPage(array $filters): int
    {
        return max(1, min(100, (int) ($filters['per_page'] ?? 15)));
    }
}
