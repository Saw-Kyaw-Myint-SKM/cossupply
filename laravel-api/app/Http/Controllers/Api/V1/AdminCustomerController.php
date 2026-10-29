<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\CustomerResource;
use App\Http\Traits\PaginationMeta;
use App\Models\Customer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Read-only Admin customer directory (RolesPermissions §1–2).
 *
 * The Admin can identify a customer and see how many quotation requests and
 * orders belong to them. Registration and profile edits stay customer-owned;
 * there is intentionally no Admin write route for customer accounts.
 */
class AdminCustomerController extends Controller
{
    use PaginationMeta;

    /**
     * Paginated customer list with search, status and account-type filters.
     */
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'status' => ['nullable', Rule::in(['active', 'inactive', 'suspended'])],
            'customer_type' => ['nullable', Rule::in(['individual', 'business'])],
            'search' => ['nullable', 'string', 'max:100'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);

        $query = Customer::query()
            ->withCount(['quotationRequests', 'orders'])
            ->orderByDesc('id');

        if (isset($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (isset($filters['customer_type'])) {
            $query->where('customer_type', $filters['customer_type']);
        }

        if (isset($filters['search'])) {
            $search = trim($filters['search']);

            $query->where(function ($query) use ($search): void {
                $query->where('name', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('company_name', 'like', "%{$search}%");
            });
        }

        $customers = $query->paginate($filters['per_page'] ?? 20);

        return $this->successResponse([
            'customers' => CustomerResource::collection($customers->items()),
            'meta' => $this->paginationMeta($customers),
            'statuses' => ['active', 'inactive', 'suspended'],
            'customer_types' => ['individual', 'business'],
        ]);
    }
}
