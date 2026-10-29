<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\AdminLoginRequest;
use App\Models\Admin;
use App\Services\Audit\AuditLogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AdminAuthController extends Controller
{
    public function __construct(
        private readonly AuditLogService $auditLogs,
    ) {}

    /**
     * Admin login.
     */
    public function login(AdminLoginRequest $request): JsonResponse
    {
        $admin = Admin::where('email', $request->email)->first();

        if (! $admin || ! Hash::check($request->password, $admin->password)) {
            throw ValidationException::withMessages([
                'email' => ['Invalid credentials.'],
            ]);
        }

        if (! $admin->isActive()) {
            return $this->errorResponse('Your account has been deactivated.', 403);
        }

        // Update last login timestamp
        $admin->update(['last_login_at' => now()]);

        // Create token with admin ability
        $token = $admin->createToken('admin-token', ['admin'])->plainTextToken;

        $this->auditLogs->log(
            $admin,
            'admin.login',
            'admin',
            (string) $admin->id,
            [],
            ['last_login_at' => $admin->last_login_at?->toIso8601String()],
            $request->ip(),
        );

        return $this->successResponse([
            'admin' => [
                'id' => $admin->id,
                'name' => $admin->name,
                'email' => $admin->email,
                'phone' => $admin->phone,
                'role' => $admin->role,
                'status' => $admin->status,
                'last_login_at' => $admin->last_login_at?->toIso8601String(),
            ],
            'token' => $token,
        ], 'Login successful.');
    }

    /**
     * Admin logout.
     */
    public function logout(Request $request): JsonResponse
    {
        /** @var Admin $admin */
        $admin = $request->user();

        $this->auditLogs->log(
            $admin,
            'admin.logout',
            'admin',
            (string) $admin->id,
            [],
            [],
            $request->ip(),
        );

        // Revoke the current access token
        $request->user()->currentAccessToken()->delete();

        return $this->successResponse(null, 'Logged out successfully.');
    }

    /**
     * Get current authenticated admin.
     */
    public function user(Request $request): JsonResponse
    {
        $admin = $request->user();

        return $this->successResponse([
            'admin' => [
                'id' => $admin->id,
                'name' => $admin->name,
                'email' => $admin->email,
                'phone' => $admin->phone,
                'role' => $admin->role,
                'status' => $admin->status,
                'last_login_at' => $admin->last_login_at?->toIso8601String(),
            ],
        ]);
    }
}
