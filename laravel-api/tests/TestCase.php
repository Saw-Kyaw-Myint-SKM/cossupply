<?php

namespace Tests;

use Illuminate\Auth\AuthManager;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    /**
     * Sanctum's RequestGuard caches the resolved user on the guard
     * instance for the lifetime of the application instance. A feature
     * test serves every request from the same application (and therefore
     * the same guard instances), so the user resolved by the FIRST bearer
     * token would otherwise be reused for later requests carrying
     * different tokens.
     *
     * Production is not affected: each request lifecycle boots a fresh
     * authentication manager. Clearing the guard's user cache before
     * every test request keeps multi-request, multi-token tests
     * deterministic.
     */
    public function call($method, $uri, $parameters = [], $cookies = [], $files = [], $server = [], $content = null)
    {
        // Only bearer-token requests need the cache cleared. Flushing
        // unconditionally would also wipe users set through
        // `Sanctum::actingAs()`, which stores the user on the guard
        // itself rather than in a token.
        if (array_key_exists('HTTP_AUTHORIZATION', $server)) {
            $this->flushCachedAuthUsers();
        }

        return parent::call($method, $uri, $parameters, $cookies, $files, $server, $content);
    }

    /**
     * Reset the cached user on every registered auth guard instance.
     */
    private function flushCachedAuthUsers(): void
    {
        $guardsProperty = new \ReflectionProperty(AuthManager::class, 'guards');
        $guardsProperty->setAccessible(true);

        $guards = $guardsProperty->getValue(app(AuthManager::class)) ?: [];

        foreach ($guards as $guard) {
            if (is_object($guard)) {
                (new \ReflectionProperty($guard, 'user'))->setValue($guard, null);
            }
        }
    }
}
