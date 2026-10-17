<?php

namespace Tests\Feature\Api\V1;

use App\Models\Category;
use App\Models\Customer;
use App\Models\Product;
use App\Models\Supplier;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminCatalogAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_cannot_access_any_admin_catalog_route(): void
    {
        foreach ($this->adminCatalogRoutes() as [$method, $uri, $payload]) {
            $this->json($method, $uri, $payload, ['Accept' => 'application/json'])
                ->assertUnauthorized();
        }
    }

    public function test_customer_token_cannot_access_any_admin_catalog_route(): void
    {
        $customer = Customer::factory()->create();
        $token = $customer->createToken('customer-token', ['customer'])->plainTextToken;

        foreach ($this->adminCatalogRoutes() as [$method, $uri, $payload]) {
            $this->withToken($token)
                ->json($method, $uri, $payload, ['Accept' => 'application/json'])
                ->assertForbidden();
        }
    }

    /**
     * Every admin catalog and private file route, with an existing model
     * bound where the URI contains a route parameter.
     *
     * @return list<array{0: string, 1: string, 2: array<string, mixed>}>
     */
    private function adminCatalogRoutes(): array
    {
        $category = Category::factory()->create();
        $supplier = Supplier::factory()->create();
        $product = Product::factory()->create();

        return [
            ['GET', '/api/v1/admin/categories', []],
            ['POST', '/api/v1/admin/categories', []],
            ['GET', "/api/v1/admin/categories/{$category->id}", []],
            ['PATCH', "/api/v1/admin/categories/{$category->id}", []],
            ['DELETE', "/api/v1/admin/categories/{$category->id}", []],
            ['GET', '/api/v1/admin/suppliers', []],
            ['POST', '/api/v1/admin/suppliers', []],
            ['GET', "/api/v1/admin/suppliers/{$supplier->id}", []],
            ['PATCH', "/api/v1/admin/suppliers/{$supplier->id}", []],
            ['GET', '/api/v1/admin/products', []],
            ['POST', '/api/v1/admin/products', []],
            ['GET', "/api/v1/admin/products/{$product->id}", []],
            ['PATCH', "/api/v1/admin/products/{$product->id}", []],
            ['DELETE', "/api/v1/admin/products/{$product->id}", []],
            ['PATCH', "/api/v1/admin/products/{$product->id}/status", ['status' => 'DRAFT']],
            ['GET', '/api/v1/admin/files/receipts/receipt-001.txt', []],
        ];
    }
}
