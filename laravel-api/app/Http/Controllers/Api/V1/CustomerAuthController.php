<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\CustomerLoginRequest;
use App\Http\Requests\Api\V1\CustomerRegistrationRequest;
use App\Models\Customer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class CustomerAuthController extends Controller
{
    /**
     * Customer registration.
     */
    public function register(CustomerRegistrationRequest $request): JsonResponse
    {
        $validated = $request->validated();

        // Determine customer type based on company_name
        $customerType = isset($validated['company_name']) && $validated['company_name']
            ? 'business'
            : 'individual';

        $customer = Customer::create([
            'name' => $validated['name'],
            'phone' => $validated['phone'],
            'email' => Str::lower(trim($validated['email'])),
            'company_name' => $validated['company_name'] ?? null,
            'password' => Hash::make($validated['password']),
            'customer_type' => $customerType,
            'status' => 'active',
        ]);

        // Create token with customer ability
        $token = $customer->createToken('customer-token', ['customer'])->plainTextToken;

        return $this->successResponse([
            'user' => [
                'id' => $customer->id,
                'name' => $customer->name,
                'phone' => $customer->phone,
                'email' => $customer->email,
                'company_name' => $customer->company_name,
                'customer_type' => $customer->customer_type,
                'status' => $customer->status,
            ],
            'token' => $token,
        ], 'Registration successful.', 201);
    }

    /**
     * Customer login.
     */
    public function login(CustomerLoginRequest $request): JsonResponse
    {
        $email = Str::lower(trim((string) $request->input('email')));

        $customer = Customer::query()
            ->whereRaw('LOWER(email) = ?', [$email])
            ->first();

        if (! $customer || ! Hash::check($request->password, $customer->password)) {
            throw ValidationException::withMessages([
                'email' => ['Invalid credentials.'],
            ]);
        }

        if (! $customer->isActive()) {
            return $this->errorResponse('Your account has been suspended.', 403);
        }

        // Create token with customer ability
        $token = $customer->createToken('customer-token', ['customer'])->plainTextToken;

        return $this->successResponse([
            'user' => [
                'id' => $customer->id,
                'name' => $customer->name,
                'phone' => $customer->phone,
                'email' => $customer->email,
                'company_name' => $customer->company_name,
                'customer_type' => $customer->customer_type,
                'status' => $customer->status,
            ],
            'token' => $token,
        ], 'Login successful.');
    }

    /**
     * Customer logout.
     */
    public function logout(Request $request): JsonResponse
    {
        // Revoke the current access token
        $request->user()->currentAccessToken()->delete();

        return $this->successResponse(null, 'Logged out successfully.');
    }

    /**
     * Get current authenticated customer.
     */
    public function user(Request $request): JsonResponse
    {
        $customer = $request->user();

        return $this->successResponse([
            'user' => [
                'id' => $customer->id,
                'name' => $customer->name,
                'phone' => $customer->phone,
                'email' => $customer->email,
                'company_name' => $customer->company_name,
                'customer_type' => $customer->customer_type,
                'status' => $customer->status,
            ],
        ]);
    }
}
