<?php

namespace App\Http\Middleware;

use App\Models\Admin;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureSuperAdmin
{
    /**
     * Handle an incoming request.
     *
     * Restricts a route group to accounts with the super_admin role. Regular
     * admins receive the same error envelope as the admin ability check.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $admin = $request->user();

        if (! $admin instanceof Admin || ! $admin->isSuperAdmin()) {
            return response()->json([
                'success' => false,
                'message' => 'Forbidden. Super admin access required.',
            ], 403);
        }

        return $next($request);
    }
}
