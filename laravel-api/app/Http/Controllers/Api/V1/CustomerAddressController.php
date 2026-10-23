<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\StoreCustomerAddressRequest;
use App\Http\Requests\Api\V1\UpdateCustomerAddressRequest;
use App\Http\Resources\CustomerAddressResource;
use App\Http\Traits\PaginationMeta;
use App\Models\Customer;
use App\Models\CustomerAddress;
use App\Services\Customer\CustomerAddressService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Customer address book API.
 *
 * Every row is scoped to the authenticated customer. Another customer's
 * address id answers 404 (never 403) so existence is not leaked.
 */
class CustomerAddressController extends Controller
{
    use PaginationMeta;

    public function __construct(
        private readonly CustomerAddressService $addresses,
    ) {}

    /**
     * List the authenticated customer's addresses: default first, then
     * newest.
     */
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        /** @var Customer $customer */
        $customer = $request->user();

        $addresses = $this->addresses->paginate($customer, $filters['per_page'] ?? 15);

        return $this->successResponse([
            'addresses' => CustomerAddressResource::collection($addresses->items()),
            'meta' => $this->paginationMeta($addresses),
        ]);
    }

    /**
     * Show one owned address, or 404.
     */
    public function show(Request $request, string $address): JsonResponse
    {
        $owned = $this->addresses->findOwnedById($request->user(), ctype_digit($address) ? (int) $address : 0);

        if ($owned === null) {
            return $this->notFoundResponse('Address not found.');
        }

        return $this->successResponse(['address' => new CustomerAddressResource($owned)]);
    }

    /**
     * Create an address. The first address for a customer becomes the
     * default automatically.
     */
    public function store(StoreCustomerAddressRequest $request): JsonResponse
    {
        /** @var Customer $customer */
        $customer = $request->user();

        $address = $this->addresses->create($customer, $request->validated());

        return $this->successResponse(
            ['address' => new CustomerAddressResource($address)],
            'Address created successfully.',
            201,
        );
    }

    /**
     * Replace an owned address. When it becomes the default, the previous
     * default is demoted. A foreign address id answers 404.
     */
    public function update(UpdateCustomerAddressRequest $request, string $address): JsonResponse
    {
        $owned = $this->addresses->findOwnedById($request->user(), ctype_digit($address) ? (int) $address : 0);

        if ($owned === null) {
            return $this->notFoundResponse('Address not found.');
        }

        $owned = $this->addresses->update($request->user(), $owned, $request->validated());

        return $this->successResponse(
            ['address' => new CustomerAddressResource($owned)],
            'Address updated successfully.',
        );
    }

    /**
     * Delete an owned address. When the deleted address was the default,
     * the newest remaining address is promoted. A foreign address id
     * answers 404.
     */
    public function destroy(Request $request, string $address): JsonResponse
    {
        $owned = $this->addresses->findOwnedById($request->user(), ctype_digit($address) ? (int) $address : 0);

        if ($owned === null) {
            return $this->notFoundResponse('Address not found.');
        }

        $this->addresses->delete($request->user(), $owned);

        return $this->successResponse(null, 'Address deleted successfully.');
    }
}
