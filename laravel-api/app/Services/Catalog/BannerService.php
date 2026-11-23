<?php

namespace App\Services\Catalog;

use App\Models\Admin;
use App\Models\Banner;
use App\Services\Audit\AuditLogService;
use App\Services\Media\MediaService;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Admin management of the home-page hero banners.
 *
 * Every create/update/delete is audited with the prior and new values. A new
 * upload replaces the stored image and the previous file is removed only
 * after the transaction succeeds.
 */
class BannerService
{
    private const IMAGE_DIRECTORY = 'banners';

    /**
     * Fields the admin may change after creation. The image is handled
     * separately so a missing file means "keep the current one".
     *
     * @var list<string>
     */
    private const UPDATABLE_FIELDS = [
        'title_mm',
        'title_en',
        'subtitle_mm',
        'subtitle_en',
        'cta_label_mm',
        'cta_label_en',
        'link_url',
        'sort_order',
        'status',
        'background_style',
    ];

    /**
     * Optional text fields normalised to null when left blank.
     *
     * @var list<string>
     */
    private const NULLABLE_TEXT_FIELDS = [
        'subtitle_mm',
        'subtitle_en',
        'cta_label_mm',
        'cta_label_en',
        'link_url',
    ];

    public function __construct(
        private readonly AuditLogService $auditLogs,
        private readonly MediaService $media,
    ) {}

    /**
     * Paginate banners with optional filters.
     *
     * @param  array<string, mixed>  $filters
     */
    public function paginate(array $filters): LengthAwarePaginator
    {
        $sortBy = in_array($filters['sort_by'] ?? null, ['created_at'], true)
            ? $filters['sort_by']
            : null;
        $sortDirection = ($filters['sort_direction'] ?? null) === 'asc' ? 'asc' : 'desc';

        $query = Banner::query()
            ->when(filled($filters['status'] ?? null), fn (Builder $query): Builder => $query->where('status', $filters['status']))
            ->when(filled($filters['search'] ?? null), function (Builder $query) use ($filters): void {
                $search = $filters['search'];

                $query->where(function (Builder $query) use ($search): void {
                    $query->where('title_mm', 'like', "%{$search}%")
                        ->orWhere('title_en', 'like', "%{$search}%");
                });
            });

        if ($sortBy === 'created_at') {
            return $query->orderBy('created_at', $sortDirection)
                ->orderBy('id', $sortDirection)
                ->paginate($this->perPage($filters));
        }

        return $query->orderBy('sort_order')
            ->orderBy('id')
            ->paginate($this->perPage($filters));
    }

    /**
     * Create a banner and audit the change.
     *
     * @param  array<string, mixed>  $data
     */
    public function create(array $data, Admin $admin, ?UploadedFile $image = null, ?string $ip = null): Banner
    {
        $imagePath = $image !== null ? $this->media->storePublicImage($image, self::IMAGE_DIRECTORY) : null;

        try {
            return DB::transaction(function () use ($data, $admin, $imagePath, $ip): Banner {
                $banner = Banner::create([
                    'title_mm' => $data['title_mm'],
                    'title_en' => $data['title_en'],
                    'subtitle_mm' => $this->nullable($data['subtitle_mm'] ?? null),
                    'subtitle_en' => $this->nullable($data['subtitle_en'] ?? null),
                    'cta_label_mm' => $this->nullable($data['cta_label_mm'] ?? null),
                    'cta_label_en' => $this->nullable($data['cta_label_en'] ?? null),
                    'link_url' => $this->nullable($data['link_url'] ?? null),
                    'image' => $imagePath,
                    'sort_order' => $data['sort_order'] ?? 0,
                    'status' => $data['status'] ?? Banner::STATUS_ACTIVE,
                    'background_style' => $data['background_style'] ?? Banner::DEFAULT_BACKGROUND_STYLE,
                ]);

                $this->auditLogs->log(
                    $admin,
                    'banner.created',
                    'banner',
                    (string) $banner->id,
                    [],
                    $this->snapshot($banner),
                    $ip,
                );

                return $banner;
            });
        } catch (Throwable $exception) {
            $this->media->deletePublicFile($imagePath);

            throw $exception;
        }
    }

    /**
     * Update a banner, replacing its image when a new one is uploaded.
     *
     * @param  array<string, mixed>  $data
     */
    public function update(
        Banner $banner,
        array $data,
        Admin $admin,
        ?UploadedFile $image = null,
        ?string $ip = null,
    ): Banner {
        $oldData = $this->snapshot($banner);
        $oldImage = $banner->image;
        $newImage = $image !== null ? $this->media->storePublicImage($image, self::IMAGE_DIRECTORY) : null;

        try {
            DB::transaction(function () use ($banner, $data, $admin, $newImage, $oldData, $ip): void {
                $attributes = Arr::only($data, self::UPDATABLE_FIELDS);

                foreach (self::NULLABLE_TEXT_FIELDS as $field) {
                    if (array_key_exists($field, $attributes)) {
                        $attributes[$field] = $this->nullable($attributes[$field]);
                    }
                }

                if ($newImage !== null) {
                    $attributes['image'] = $newImage;
                }

                $banner->update($attributes);

                $newData = $this->snapshot($banner);

                if ($newData !== $oldData) {
                    $this->auditLogs->log(
                        $admin,
                        'banner.updated',
                        'banner',
                        (string) $banner->id,
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

        return $banner;
    }

    /**
     * Delete a banner and its public image.
     */
    public function delete(Banner $banner, Admin $admin, ?string $ip = null): void
    {
        $image = $banner->image;

        DB::transaction(function () use ($banner, $admin, $ip): void {
            $snapshot = $this->snapshot($banner);

            $banner->delete();

            $this->auditLogs->log(
                $admin,
                'banner.deleted',
                'banner',
                (string) $banner->id,
                $snapshot,
                [],
                $ip,
            );
        });

        $this->media->deletePublicFile($image);
    }

    /**
     * Audit-friendly banner representation.
     *
     * @return array<string, mixed>
     */
    private function snapshot(Banner $banner): array
    {
        return [
            'title_mm' => $banner->title_mm,
            'title_en' => $banner->title_en,
            'subtitle_mm' => $banner->subtitle_mm,
            'subtitle_en' => $banner->subtitle_en,
            'cta_label_mm' => $banner->cta_label_mm,
            'cta_label_en' => $banner->cta_label_en,
            'link_url' => $banner->link_url,
            'image' => $banner->image,
            'sort_order' => $banner->sort_order,
            'status' => $banner->status,
            'background_style' => $banner->background_style,
        ];
    }

    /**
     * Trim an optional value and collapse blanks to null.
     */
    private function nullable(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $trimmed = trim((string) $value);

        return $trimmed === '' ? null : $trimmed;
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
