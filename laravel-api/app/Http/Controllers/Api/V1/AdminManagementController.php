<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\StoreAdminUserRequest;
use App\Http\Requests\Api\V1\UpdateAdminUserRequest;
use App\Http\Resources\AdminUserResource;
use App\Http\Traits\PaginationMeta;
use App\Models\Admin;
use App\Services\Admin\AdminManagementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Super-admin CRUD for admin accounts.
 *
 * Every route is behind the `super_admin` middleware: a regular admin gets a
 * 403 before any handler runs.
 */
class AdminManagementController extends Controller
{
    use PaginationMeta;

    public function __construct(
        private readonly AdminManagementService $adminUsers,
    ) {}

    /**
     * List admin accounts with optional filters and pagination.
     */
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'role' => ['nullable', Rule::in(Admin::ROLES)],
            'status' => ['nullable', Rule::in(Admin::STATUSES)],
            'sort_by' => ['nullable', Rule::in(['created_at'])],
            'sort_direction' => ['nullable', Rule::in(['asc', 'desc'])],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $adminUsers = $this->adminUsers->paginate($filters);

        return $this->successResponse([
            'admin_users' => AdminUserResource::collection($adminUsers->items()),
            'meta' => $this->paginationMeta($adminUsers),
        ]);
    }

    /**
     * Create an admin account.
     */
    public function store(StoreAdminUserRequest $request): JsonResponse
    {
        $adminUser = $this->adminUsers->create(
            $request->validated(),
            $request->user(),
            $request->ip(),
        );

        return $this->successResponse(
            ['admin_user' => new AdminUserResource($adminUser)],
            'Admin user created.',
            201,
        );
    }

    /**
     * Show a single admin account.
     */
    public function show(Admin $adminUser): JsonResponse
    {
        return $this->successResponse(['admin_user' => new AdminUserResource($adminUser)]);
    }

    /**
     * Update an admin account. The password is changed separately.
     */
    public function update(UpdateAdminUserRequest $request, Admin $adminUser): JsonResponse
    {
        $adminUser = $this->adminUsers->update(
            $adminUser,
            $request->validated(),
            $request->user(),
            $request->ip(),
        );

        return $this->successResponse(
            ['admin_user' => new AdminUserResource($adminUser)],
            'Admin user updated.',
        );
    }

    /**
     * Replace an admin account's password.
     */
    public function updatePassword(Request $request, Admin $adminUser): JsonResponse
    {
        $validated = $request->validate([
            'password' => ['required', 'string', 'min:8', 'max:1000'],
        ]);

        $adminUser = $this->adminUsers->resetPassword(
            $adminUser,
            $validated['password'],
            $request->user(),
            $request->ip(),
        );

        return $this->successResponse(
            ['admin_user' => new AdminUserResource($adminUser)],
            'Admin password reset.',
        );
    }

    /**
     * Delete an admin account that is not referenced elsewhere.
     */
    public function destroy(Request $request, Admin $adminUser): JsonResponse
    {
        $this->adminUsers->delete($adminUser, $request->user(), $request->ip());

        return $this->successResponse(null, 'Admin user deleted.');
    }
}
