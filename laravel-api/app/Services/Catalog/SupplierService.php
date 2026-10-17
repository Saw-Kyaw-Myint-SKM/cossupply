<?php

namespace App\Services\Catalog;

use App\Enums\SupplierStatus;
use App\Models\Admin;
use App\Models\Supplier;
use App\Services\Audit\AuditLogService;
use App\Services\Media\MediaService;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Admin management of suppliers.
 *
 * Suppliers are never deleted: they are deactivated by changing their
 * status. Deactivating a supplier blocks new publish transitions but does
 * not cascade to already published products.
 */
class SupplierService
{
    private const LOGO_DIRECTORY = 'suppliers/logos';

    public function __construct(
        private readonly AuditLogService $auditLogs,
        private readonly MediaService $media,
    ) {}

    /**
     * Paginate suppliers with optional filters.
     *
     * @param  array<string, mixed>  $filters
     */
    public function paginate(array $filters): LengthAwarePaginator
    {
        return Supplier::query()
            ->withCount('products')
            ->when(filled($filters['status'] ?? null), fn (Builder $query): Builder => $query->where('status', $filters['status']))
            ->when(filled($filters['search'] ?? null), function (Builder $query) use ($filters): void {
                $search = $filters['search'];

                $query->where(function (Builder $query) use ($search): void {
                    $query->where('shop_name', 'like', "%{$search}%")
                        ->orWhere('company_name', 'like', "%{$search}%")
                        ->orWhere('phone', 'like', "%{$search}%");
                });
            })
            ->orderBy('shop_name')
            ->orderBy('id')
            ->paginate($this->perPage($filters));
    }

    /**
     * Create a supplier and audit the change.
     *
     * New suppliers start ACTIVE and unverified per LogicFlow §2.
     *
     * @param  array<string, mixed>  $data
     */
    public function create(array $data, Admin $admin, ?UploadedFile $logo = null, ?string $ip = null): Supplier
    {
        $logoPath = $logo !== null ? $this->media->storePublicImage($logo, self::LOGO_DIRECTORY) : null;

        try {
            $supplier = DB::transaction(function () use ($data, $admin, $logoPath, $ip): Supplier {
                $supplier = Supplier::create([
                    'shop_name' => $data['shop_name'],
                    'company_name' => $data['company_name'] ?? null,
                    'contact_person' => $data['contact_person'],
                    'phone' => $data['phone'],
                    'viber_phone' => $data['viber_phone'] ?? null,
                    'email' => $data['email'] ?? null,
                    'logo' => $logoPath,
                    'address' => $data['address'],
                    'city' => $data['city'],
                    'township' => $data['township'] ?? null,
                    'business_description' => $data['business_description'] ?? null,
                    'delivery_area' => $data['delivery_area'] ?? null,
                    'delivery_time' => $data['delivery_time'] ?? null,
                    'warranty_policy' => $data['warranty_policy'] ?? null,
                    'return_policy' => $data['return_policy'] ?? null,
                    'status' => $data['status'] ?? SupplierStatus::ACTIVE->value,
                    'verified' => $data['verified'] ?? false,
                    'created_by_admin_id' => $admin->id,
                ]);

                $this->auditLogs->log(
                    $admin,
                    'supplier.created',
                    'supplier',
                    (string) $supplier->id,
                    [],
                    $this->snapshot($supplier),
                    $ip,
                );

                return $supplier;
            });
        } catch (Throwable $exception) {
            $this->media->deletePublicFile($logoPath);

            throw $exception;
        }

        return $supplier;
    }

    /**
     * Update a supplier, replacing its logo when a new one is uploaded.
     *
     * Status and verified changes are captured in the audit entry.
     *
     * @param  array<string, mixed>  $data
     */
    public function update(
        Supplier $supplier,
        array $data,
        Admin $admin,
        ?UploadedFile $logo = null,
        ?string $ip = null,
    ): Supplier {
        $oldData = $this->snapshot($supplier);
        $oldLogo = $supplier->logo;
        $newLogo = $logo !== null ? $this->media->storePublicImage($logo, self::LOGO_DIRECTORY) : null;

        try {
            DB::transaction(function () use ($supplier, $data, $admin, $newLogo, $oldData, $ip): void {
                $attributes = [];

                foreach ([
                    'shop_name', 'company_name', 'contact_person', 'phone', 'viber_phone', 'email',
                    'address', 'city', 'township', 'business_description', 'delivery_area',
                    'delivery_time', 'warranty_policy', 'return_policy', 'status', 'verified',
                ] as $field) {
                    if (array_key_exists($field, $data)) {
                        $attributes[$field] = $data[$field];
                    }
                }

                if ($newLogo !== null) {
                    $attributes['logo'] = $newLogo;
                }

                $supplier->update($attributes);

                $newData = $this->snapshot($supplier);

                if ($newData !== $oldData) {
                    $this->auditLogs->log(
                        $admin,
                        'supplier.updated',
                        'supplier',
                        (string) $supplier->id,
                        $oldData,
                        $newData,
                        $ip,
                    );
                }
            });
        } catch (Throwable $exception) {
            $this->media->deletePublicFile($newLogo);

            throw $exception;
        }

        if ($newLogo !== null) {
            $this->media->deletePublicFile($oldLogo);
        }

        return $supplier;
    }

    /**
     * Audit-friendly supplier representation.
     *
     * @return array<string, mixed>
     */
    private function snapshot(Supplier $supplier): array
    {
        return [
            'shop_name' => $supplier->shop_name,
            'company_name' => $supplier->company_name,
            'contact_person' => $supplier->contact_person,
            'phone' => $supplier->phone,
            'viber_phone' => $supplier->viber_phone,
            'email' => $supplier->email,
            'logo' => $supplier->logo,
            'address' => $supplier->address,
            'city' => $supplier->city,
            'township' => $supplier->township,
            'business_description' => $supplier->business_description,
            'delivery_area' => $supplier->delivery_area,
            'delivery_time' => $supplier->delivery_time,
            'warranty_policy' => $supplier->warranty_policy,
            'return_policy' => $supplier->return_policy,
            'status' => $supplier->status->value,
            'verified' => $supplier->verified,
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
