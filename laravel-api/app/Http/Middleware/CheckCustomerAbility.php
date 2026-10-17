<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckCustomerAbility
{
    /**
     * Handle an incoming request.
     *
     * Checks if the authenticated user has customer ability.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->user()?->currentAccessToken();

        if (! $token || ! $token->can('customer')) {
            return response()->json([
                'success' => false,
                'message' => 'Forbidden. Customer access required.',
            ], 403);
        }

        return $next($request);
    }
}
