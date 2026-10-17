<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\SupplierStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\StoreSupplierRequest;
use App\Http\Requests\Api\V1\UpdateSupplierRequest;
use App\Http\Resources\SupplierResource;
use App\Http\Traits\PaginationMeta;
use App\Models\Supplier;
use App\Services\Catalog\SupplierService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminSupplierController extends Controller
{
    use PaginationMeta;

    public function __construct(
        private readonly SupplierService $suppliers,
    ) {}

    /**
     * List suppliers with optional filters and pagination.
     */
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'status' => ['nullable', Rule::in(SupplierStatus::values())],
            'search' => ['nullable', 'string', 'max:100'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $suppliers = $this->suppliers->paginate($filters);

        return $this->successResponse([
            'suppliers' => SupplierResource::collection($suppliers->items()),
            'meta' => $this->paginationMeta($suppliers),
        ]);
    }

    /**
     * Create a supplier. New suppliers start ACTIVE and unverified.
     */
    public function store(StoreSupplierRequest $request): JsonResponse
    {
        $supplier = $this->suppliers->create(
            $request->validated(),
            $request->user(),
            $request->file('logo'),
            $request->ip(),
        );

        return $this->successResponse(
            ['supplier' => new SupplierResource($supplier)],
            'Supplier created.',
            201,
        );
    }

    /**
     * Show a single supplier.
     */
    public function show(Supplier $supplier): JsonResponse
    {
        return $this->successResponse(['supplier' => new SupplierResource($supplier)]);
    }

    /**
     * Update a supplier, including status and verified flags.
     *
     * Suppliers are never deleted; deactivate them through the status field.
     */
    public function update(UpdateSupplierRequest $request, Supplier $supplier): JsonResponse
    {
        $supplier = $this->suppliers->update(
            $supplier,
            $request->validated(),
            $request->user(),
            $request->file('logo'),
            $request->ip(),
        );

        return $this->successResponse(
            ['supplier' => new SupplierResource($supplier)],
            'Supplier updated.',
        );
    }
}
