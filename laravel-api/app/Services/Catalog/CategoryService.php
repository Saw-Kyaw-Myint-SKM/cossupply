<?php

namespace App\Services\Catalog;

use App\Exceptions\ResourceConflictException;
use App\Models\Admin;
use App\Models\Category;
use App\Services\Audit\AuditLogService;
use App\Services\Media\MediaService;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\QueryException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Throwable;

/**
 * Admin management of product categories and subcategories.
 *
 * Every create/update/delete is audited with the prior and new values.
 * Deletion is guarded: a category with children or products cannot be
 * removed.
 */
class CategoryService
{
    private const IMAGE_DIRECTORY = 'categories';

    private const UPDATABLE_FIELDS = ['parent_id', 'name_mm', 'name_en', 'slug', 'description', 'sort_order', 'status'];

    public function __construct(
        private readonly AuditLogService $auditLogs,
        private readonly MediaService $media,
    ) {}

    /**
     * Paginate categories with optional filters.
     *
     * @param  array<string, mixed>  $filters
     */
    public function paginate(array $filters): LengthAwarePaginator
    {
        return Category::query()
            ->when(filled($filters['parent_id'] ?? null), fn (Builder $query): Builder => $query->where('parent_id', $filters['parent_id']))
            ->when(filled($filters['status'] ?? null), fn (Builder $query): Builder => $query->where('status', $filters['status']))
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
            ->paginate($this->perPage($filters));
    }

    /**
     * Create a category and audit the change.
     *
     * @param  array<string, mixed>  $data
     */
    public function create(array $data, Admin $admin, ?UploadedFile $image = null, ?string $ip = null): Category
    {
        $imagePath = $image !== null ? $this->media->storePublicImage($image, self::IMAGE_DIRECTORY) : null;

        try {
            $category = DB::transaction(function () use ($data, $admin, $imagePath, $ip): Category {
                $category = Category::create([
                    'parent_id' => $data['parent_id'] ?? null,
                    'name_mm' => $data['name_mm'],
                    'name_en' => $data['name_en'],
                    'slug' => $data['slug'] ?? Str::slug($data['name_en']),
                    'description' => $data['description'] ?? null,
                    'image' => $imagePath,
                    'sort_order' => $data['sort_order'] ?? 0,
                    'status' => $data['status'] ?? Category::STATUS_ACTIVE,
                ]);

                $this->auditLogs->log(
                    $admin,
                    'category.created',
                    'category',
                    (string) $category->id,
                    [],
                    $this->snapshot($category),
                    $ip,
                );

                return $category;
            });
        } catch (Throwable $exception) {
            $this->media->deletePublicFile($imagePath);

            throw $exception;
        }

        return $category;
    }

    /**
     * Update a category, replacing its image when a new one is uploaded.
     *
     * @param  array<string, mixed>  $data
     */
    public function update(
        Category $category,
        array $data,
        Admin $admin,
        ?UploadedFile $image = null,
        ?string $ip = null,
    ): Category {
        $oldData = $this->snapshot($category);
        $oldImage = $category->image;
        $newImage = $image !== null ? $this->media->storePublicImage($image, self::IMAGE_DIRECTORY) : null;

        try {
            DB::transaction(function () use ($category, $data, $admin, $newImage, $oldData, $ip): void {
                $attributes = Arr::only($data, self::UPDATABLE_FIELDS);

                if ($newImage !== null) {
                    $attributes['image'] = $newImage;
                }

                $category->update($attributes);

                $newData = $this->snapshot($category);

                if ($newData !== $oldData) {
                    $this->auditLogs->log(
                        $admin,
                        'category.updated',
                        'category',
                        (string) $category->id,
                        $oldData,
                        $newData,
                        $ip,
                    );
                }
            });
        } catch (Throwable $exception) {
            $this->media->deletePublicFile($newImage);

            throw $exception;
        }

        if ($newImage !== null) {
            $this->media->deletePublicFile($oldImage);
        }

        return $category;
    }

    /**
     * Delete an unreferenced category and its public image.
     *
     * @throws ResourceConflictException
     */
    public function delete(Category $category, Admin $admin, ?string $ip = null): void
    {
        $image = $category->image;

        DB::transaction(function () use ($category, $admin, $ip): void {
            if ($category->children()->exists()) {
                throw new ResourceConflictException('Category cannot be deleted because it has child categories.');
            }

            if ($category->products()->exists()) {
                throw new ResourceConflictException('Category cannot be deleted because it has products.');
            }

            $snapshot = $this->snapshot($category);

            try {
                $category->delete();
            } catch (QueryException $exception) {
                throw new ResourceConflictException(
                    'Category cannot be deleted because it is still referenced.',
                    previous: $exception,
                );
            }

            $this->auditLogs->log(
                $admin,
                'category.deleted',
                'category',
                (string) $category->id,
                $snapshot,
                [],
                $ip,
            );
        });

        $this->media->deletePublicFile($image);
    }

    /**
     * Audit-friendly category representation.
     *
     * @return array<string, mixed>
     */
    private function snapshot(Category $category): array
    {
        return [
            'parent_id' => $category->parent_id,
            'name_mm' => $category->name_mm,
            'name_en' => $category->name_en,
            'slug' => $category->slug,
            'description' => $category->description,
            'image' => $category->image,
            'sort_order' => $category->sort_order,
            'status' => $category->status,
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
