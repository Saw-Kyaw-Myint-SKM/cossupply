<?php

namespace App\Http\Middleware;

use App\Models\Admin;
use App\Models\Customer;
use Closure;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;
use Symfony\Component\HttpFoundation\Response;

/**
 * Re-check the account status on every authenticated request.
 *
 * Login already rejects inactive/suspended accounts, but a token issued while
 * the account was active would otherwise keep working after deactivation.
 * The presented token is revoked as well, so a reactivated account cannot
 * silently resume an old session and must log in again.
 */
class EnsureActiveAccount
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user instanceof Customer && ! $user instanceof Admin) {
            return $this->forbidden('Forbidden. Unsupported account type.');
        }

        if ($user->isActive()) {
            return $next($request);
        }

        $token = $user->currentAccessToken();

        if ($token instanceof PersonalAccessToken) {
            $token->delete();
        }

        return $this->forbidden(
            $user instanceof Admin
                ? 'Your account has been deactivated.'
                : 'Your account has been suspended.',
        );
    }

    /**
     * Reuse the standard API error envelope for a blocked account.
     */
    private function forbidden(string $message): Response
    {
        return response()->json([
            'success' => false,
            'message' => $message,
        ], 403);
    }
}
