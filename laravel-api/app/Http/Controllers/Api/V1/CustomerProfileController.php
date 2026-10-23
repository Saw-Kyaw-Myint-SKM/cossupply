<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\UpdateCustomerProfileRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Authenticated customer self-service profile API.
 *
 * `phone`, `status` and `customer_type` are server-managed: phone is the
 * login identifier and is silently ignored in update payloads.
 */
class CustomerProfileController extends Controller
{
    /**
     * Show the profile of the authenticated customer. The password hash is
     * never exposed.
     */
    public function show(Request $request): JsonResponse
    {
        return $this->successResponse(['customer' => $this->profile($request->user())]);
    }

    /**
     * Update name, company name and email of the authenticated customer.
     */
    public function update(UpdateCustomerProfileRequest $request): JsonResponse
    {
        $customer = $request->user();

        $customer->update($request->validated());

        return $this->successResponse(
            ['customer' => $this->profile($customer)],
            'Profile updated successfully.',
        );
    }

    /**
     * The profile shape shared by GET and PUT.
     *
     * @return array<string, mixed>
     */
    private function profile(mixed $customer): array
    {
        return [
            'id' => $customer->id,
            'name' => $customer->name,
            'company_name' => $customer->company_name,
            'email' => $customer->email,
            'phone' => $customer->phone,
            'customer_type' => $customer->customer_type,
            'status' => $customer->status,
            'created_at' => $customer->created_at?->toIso8601String(),
        ];
    }
}
