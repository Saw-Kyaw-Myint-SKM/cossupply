<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\SupplierStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\PublicSupplierResource;
use App\Http\Traits\PaginationMeta;
use App\Models\Supplier;
use App\Services\Setting\SettingService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Guest-facing supplier directory. Only ACTIVE suppliers are listed and no
 * contact detail is exposed, per RolesPermissions §3.
 *
 * The `storefront_supplier_display` setting can hide the directory entirely,
 * so the catalog filter cannot be used to enumerate supplier names.
 */
class PublicSupplierController extends Controller
{
    use PaginationMeta;

    public function __construct(
        private readonly SettingService $settings,
    ) {}

    /**
     * List active suppliers with an optional name search.
     */
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $suppliers = Supplier::query()
            ->where('status', SupplierStatus::ACTIVE->value)
            ->when(
                $this->settings->supplierDisplay() === SettingService::SUPPLIER_DISPLAY_HIDDEN,
                fn (Builder $query): Builder => $query->whereRaw('1 = 0'),
            )
            ->when(filled($filters['search'] ?? null), function (Builder $query) use ($filters): void {
                $search = $filters['search'];

                $query->where(function (Builder $query) use ($search): void {
                    $query->where('shop_name', 'like', "%{$search}%")
                        ->orWhere('company_name', 'like', "%{$search}%");
                });
            })
            ->orderBy('shop_name')
            ->orderBy('id')
            ->paginate($filters['per_page'] ?? 15);

        return $this->successResponse([
            'suppliers' => PublicSupplierResource::collection($suppliers->items()),
            'meta' => $this->paginationMeta($suppliers),
        ]);
    }
}
