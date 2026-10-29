<?php

use App\Exceptions\InvalidStatusTransitionException;
use App\Http\Middleware\CheckAdminAbility;
use App\Http\Middleware\CheckCustomerAbility;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        apiPrefix: 'api/v1',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->statefulApi();

        // Register aliases for custom middleware
        $middleware->alias([
            'admin' => CheckAdminAbility::class,
            'customer' => CheckCustomerAbility::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->render(function (InvalidStatusTransitionException $exception, Request $request) {
            if ($request->is('api/*')) {
                return response()->json([
                    'success' => false,
                    'message' => $exception->getMessage(),
                ], 409);
            }

            return null;
        });

        // Task 12: keep the API error envelope for rate-limited requests and
        // expose only the retry hint, never internals.
        $exceptions->render(function (ThrottleRequestsException $exception, Request $request) {
            if ($request->is('api/*')) {
                return response()->json([
                    'success' => false,
                    'message' => 'Too many attempts. Please wait and try again.',
                ], 429, ['Retry-After' => $exception->getHeaders()['Retry-After'] ?? '60']);
            }

            return null;
        });
    })->create();
