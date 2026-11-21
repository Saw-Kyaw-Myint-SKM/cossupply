<?php

namespace Tests\Feature\Api\V1;

use App\Models\Admin;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Services\Catalog\SkuGenerator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminProductSkuGenerationTest extends TestCase
{
    use RefreshDatabase;

    public function test_product_scope_returns_a_name_based_sku(): void
    {
        $this->actingAsAdmin();

        $sku = $this->generateSku([
            'scope' => 'product',
            'name_en' => 'Office Chair',
            'brand' => 'Acme',
            'model' => 'M-1',
        ])->assertOk()
            ->assertJsonPath('success', true)
            ->json('data.sku');

        $this->assertMatchesRegularExpression('/^OFFICE-CHAIR-[A-HJ-NP-Z2-9]{4}$/', (string) $sku);
        $this->assertLessThanOrEqual(100, strlen((string) $sku));
    }

    public function test_product_scope_skips_skus_already_in_the_catalog(): void
    {
        $this->actingAsAdmin();
        Product::factory()->create(['sku' => 'OFFICE-CHAIR-AAAA']);

        $this->app->instance(SkuGenerator::class, $this->generator(['AAAA', 'CCCC']));

        $this->generateSku([
            'scope' => 'product',
            'name_en' => 'Office Chair',
        ])->assertOk()->assertJsonPath('data.sku', 'OFFICE-CHAIR-CCCC');
    }

    public function test_variant_scope_builds_from_the_product_sku_and_the_variant_name(): void
    {
        $this->actingAsAdmin();
        $product = Product::factory()->create(['sku' => 'CHAIR-001']);

        $this->generateSku([
            'scope' => 'variant',
            'product_id' => $product->id,
            'variant_name' => 'Red / M',
            'variant_index' => 1,
        ])->assertOk()->assertJsonPath('data.sku', 'CHAIR-001-RED-M');
    }

    public function test_variant_scope_skips_the_rows_still_in_the_form(): void
    {
        $this->actingAsAdmin();

        $this->generateSku([
            'scope' => 'variant',
            'name_en' => 'Office Chair',
            'base' => 'OFFICE-CHAIR',
            'variant_name' => 'Blue',
            'variant_index' => 2,
            'existing_skus' => ['OFFICE-CHAIR-BLUE'],
        ])->assertOk()->assertJsonPath('data.sku', 'OFFICE-CHAIR-BLUE-2');
    }

    public function test_variant_scope_skips_stored_variant_skus_and_can_keep_the_current_row(): void
    {
        $this->actingAsAdmin();
        $product = Product::factory()->create(['sku' => 'CHAIR-001']);
        $variant = ProductVariant::factory()->create([
            'product_id' => $product->id,
            'sku' => 'CHAIR-001-RED',
        ]);

        $this->generateSku([
            'scope' => 'variant',
            'product_id' => $product->id,
            'variant_name' => 'Red',
        ])->assertOk()->assertJsonPath('data.sku', 'CHAIR-001-RED-2');

        $this->generateSku([
            'scope' => 'variant',
            'product_id' => $product->id,
            'variant_name' => 'Red',
            'exclude_variant_id' => $variant->id,
        ])->assertOk()->assertJsonPath('data.sku', 'CHAIR-001-RED');
    }

    public function test_generating_a_sku_validates_the_payload(): void
    {
        $this->actingAsAdmin();

        $this->generateSku([])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['scope']);

        $this->generateSku(['scope' => 'everything'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['scope']);

        $this->generateSku(['scope' => 'variant', 'product_id' => 99999])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['product_id']);

        $this->generateSku(['scope' => 'variant', 'variant_index' => 0])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['variant_index']);

        $this->generateSku(['scope' => 'product', 'existing_skus' => [str_repeat('a', 101)]])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['existing_skus.0']);

        $this->generateSku(['scope' => 'product', 'name_en' => str_repeat('a', 256)])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name_en']);
    }

    public function test_generating_a_sku_requires_an_admin_token(): void
    {
        $this->postJson('/api/v1/admin/products/generate-sku', ['scope' => 'product'])
            ->assertUnauthorized();
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function generateSku(array $payload): TestResponse
    {
        return $this->postJson('/api/v1/admin/products/generate-sku', $payload);
    }

    /**
     * @param  list<string>  $codes
     */
    private function generator(array $codes): SkuGenerator
    {
        return new class($codes) extends SkuGenerator {
            /** @var list<string> */
            private array $codes;

            /** @param list<string> $codes */
            public function __construct(array $codes)
            {
                $this->codes = $codes;
            }

            protected function randomCode(): string
            {
                $code = array_shift($this->codes);

                return $code ?? 'AAAA';
            }
        };
    }

    private function actingAsAdmin(): Admin
    {
        $admin = Admin::factory()->create();
        Sanctum::actingAs($admin, ['admin']);

        return $admin;
    }
}
