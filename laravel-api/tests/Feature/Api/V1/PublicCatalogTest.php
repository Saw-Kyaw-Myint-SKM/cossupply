<?php

namespace Tests\Feature\Api\V1;

use App\Models\Category;
use App\Models\Product;
use App\Models\Supplier;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PublicCatalogTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_product_list_returns_only_published_products_newest_first(): void
    {
        $published = Product::factory()->published()->create();
        Product::factory()->create();                                  // DRAFT
        Product::factory()->hidden()->create();                        // HIDDEN
        Product::factory()->outOfStock()->create();                    // product-level OUT_OF_STOCK
        $stockOut = Product::factory()->published()->withStock(['stock_status' => 'OUT_OF_STOCK'])->create();

        $response = $this->getJson('/api/v1/products')->assertOk();

        $ids = collect($response->json('data.products'))->pluck('id');

        $this->assertSame([$stockOut->id, $published->id], $ids->all());
        $response->assertJsonStructure([
            'success',
            'data' => [
                'products' => [[
                    'id', 'name_mm', 'name_en', 'slug', 'sku', 'status',
                    'photo_url', 'category', 'supplier', 'price', 'stock',
                ]],
                'meta' => ['current_page', 'per_page', 'total', 'last_page'],
            ],
        ]);
    }

    public function test_published_out_of_stock_stock_row_is_still_browsable(): void
    {
        $product = Product::factory()
            ->published()
            ->withStock(['stock_status' => 'OUT_OF_STOCK'])
            ->create();

        $this->getJson('/api/v1/products')
            ->assertOk()
            ->assertJsonCount(1, 'data.products')
            ->assertJsonPath('data.products.0.id', $product->id)
            ->assertJsonPath('data.products.0.stock.stock_status', 'OUT_OF_STOCK');

        $this->getJson("/api/v1/products/{$product->id}")
            ->assertOk()
            ->assertJsonPath('data.product.id', $product->id);
    }

    public function test_product_show_returns_published_and_404s_everywhere_else(): void
    {
        $published = Product::factory()->published()->create();
        Product::factory()->create();
        Product::factory()->hidden()->create();
        Product::factory()->outOfStock()->create();

        $this->getJson("/api/v1/products/{$published->id}")
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.product.slug', $published->slug);

        $draft = Product::factory()->create();
        $hidden = Product::factory()->hidden()->create();
        $outOfStock = Product::factory()->outOfStock()->create();

        foreach ([$draft->id, $hidden->id, $outOfStock->id, 999999, 'not-a-number'] as $id) {
            $this->getJson("/api/v1/products/{$id}")
                ->assertNotFound()
                ->assertJsonPath('success', false);
        }
    }

    public function test_product_list_filters_narrow_results(): void
    {
        $category = Category::factory()->create();
        $otherCategory = Category::factory()->create();
        $supplier = Supplier::factory()->create();
        $otherSupplier = Supplier::factory()->create();

        $match = Product::factory()
            ->for($supplier)
            ->for($category)
            ->published()
            ->withPrice()
            ->withStock(['stock_status' => 'PRE_ORDER'])
            ->create(['name_en' => 'Unique Desk Lamp', 'sku' => 'LAMP-001']);

        Product::factory()
            ->for($otherSupplier)
            ->for($otherCategory)
            ->published()
            ->withStock(['stock_status' => 'IN_STOCK'])
            ->create();

        $queries = [
            "category_id={$category->id}",
            "supplier_id={$supplier->id}",
            'search=Desk',
            'search=LAMP-001',
            'search=Unique',
            'stock_status=PRE_ORDER',
        ];

        foreach ($queries as $query) {
            $this->getJson("/api/v1/products?{$query}")
                ->assertOk()
                ->assertJsonCount(1, 'data.products')
                ->assertJsonPath('data.products.0.id', $match->id);
        }
    }

    public function test_product_list_rejects_invalid_filter_values(): void
    {
        $this->getJson('/api/v1/products?stock_status=SOMETIMES')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['stock_status']);

        $this->getJson('/api/v1/products?category_id=999999')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['category_id']);

        $this->getJson('/api/v1/products?supplier_id=999999')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['supplier_id']);

        $this->getJson('/api/v1/products?per_page=101')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['per_page']);

        $this->getJson('/api/v1/products?per_page=0')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['per_page']);

        $this->getJson('/api/v1/products?search='.str_repeat('a', 101))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['search']);
    }

    public function test_public_product_never_exposes_internal_fields(): void
    {
        $supplier = Supplier::factory()->create();
        $category = Category::factory()->create();

        $product = Product::factory()
            ->for($supplier)
            ->for($category)
            ->published()
            ->withPrice(['wholesale_price' => 4500, 'retail_price' => 5000])
            ->withStock(['stock_status' => 'IN_STOCK', 'supplier_note' => 'internal note'])
            ->create();

        foreach (['/api/v1/products', "/api/v1/products/{$product->id}"] as $path) {
            $json = $this->getJson($path)->assertOk()->json('data');

            $item = $path === '/api/v1/products' ? $json['products'][0] : $json['product'];

            $this->assertIsArray($item['price']);
            $this->assertArrayNotHasKey('wholesale_price', $item['price']);
            $this->assertArrayNotHasKey('id', $item['price']);
            $this->assertSame(5000, $item['price']['retail_price']);

            $this->assertIsArray($item['stock']);
            $this->assertArrayNotHasKey('supplier_note', $item['stock']);
            $this->assertSame('IN_STOCK', $item['stock']['stock_status']);

            foreach (['created_by_admin_id', 'created_at', 'updated_at'] as $field) {
                $this->assertArrayNotHasKey($field, $item);
            }

            foreach (['contact_person', 'phone', 'viber_phone', 'email', 'address', 'city', 'township', 'status', 'created_by_admin_id'] as $field) {
                $this->assertArrayNotHasKey($field, $item['supplier']);
            }

            foreach (['status', 'created_at', 'updated_at'] as $field) {
                $this->assertArrayNotHasKey($field, $item['category']);
            }
        }
    }

    public function test_public_supplier_list_never_exposes_contact_details(): void
    {
        $supplier = Supplier::factory()->verified()->create([
            'shop_name' => 'Yangon Trading',
            'phone' => '09123456789',
            'viber_phone' => '09999999999',
            'email' => 'private@example.com',
            'address' => 'No. 12, Bo Gyoke Road',
            'city' => 'Yangon',
            'township' => 'Lanmadaw',
            'contact_person' => 'Daw Aye',
        ]);

        Product::factory()->for($supplier)->published()->create();

        $json = $this->getJson('/api/v1/suppliers')->assertOk()->json('data.suppliers.0');

        $this->assertSame($supplier->id, $json['id']);
        $this->assertSame('Yangon Trading', $json['shop_name']);
        $this->assertTrue($json['verified']);

        foreach (['contact_person', 'phone', 'viber_phone', 'email', 'address', 'city', 'township', 'warranty_policy', 'return_policy', 'status', 'created_by_admin_id', 'created_at', 'updated_at'] as $field) {
            $this->assertArrayNotHasKey($field, $json);
        }
    }

    public function test_category_and_supplier_lists_return_only_active_records(): void
    {
        $activeCategory = Category::factory()->create(['sort_order' => 1]);
        Category::factory()->inactive()->create();
        Category::factory()->create(['parent_id' => $activeCategory->id, 'sort_order' => 2]);

        $activeSupplier = Supplier::factory()->create();
        Supplier::factory()->inactive()->create();
        Supplier::factory()->suspended()->create();

        $categories = $this->getJson('/api/v1/categories')
            ->assertOk()
            ->assertJsonPath('data.categories.0.id', $activeCategory->id)
            ->json('data.categories');

        $this->assertCount(2, $categories);

        $inactiveIds = Category::query()->where('status', 'INACTIVE')->pluck('id')->all();

        foreach ($inactiveIds as $id) {
            $this->assertNotContains($id, collect($categories)->pluck('id')->all());
        }

        $this->getJson('/api/v1/suppliers')
            ->assertOk()
            ->assertJsonCount(1, 'data.suppliers')
            ->assertJsonPath('data.suppliers.0.id', $activeSupplier->id);
    }

    public function test_category_filters_and_validation(): void
    {
        $parent = Category::factory()->create();
        $child = Category::factory()->childOf($parent)->create();
        Category::factory()->create();

        $this->getJson("/api/v1/categories?parent_id={$parent->id}")
            ->assertOk()
            ->assertJsonCount(1, 'data.categories')
            ->assertJsonPath('data.categories.0.id', $child->id);

        $this->getJson('/api/v1/categories?search='.urlencode($child->name_en))
            ->assertOk()
            ->assertJsonCount(1, 'data.categories')
            ->assertJsonPath('data.categories.0.id', $child->id);

        $this->getJson('/api/v1/categories?parent_id=999999')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['parent_id']);

        $this->getJson('/api/v1/categories?per_page=0')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['per_page']);
    }

    public function test_supplier_search_filter(): void
    {
        $match = Supplier::factory()->create(['shop_name' => 'Blue Elephant Hardware']);
        Supplier::factory()->create();

        $this->getJson('/api/v1/suppliers?search='.urlencode('Blue Elephant'))
            ->assertOk()
            ->assertJsonCount(1, 'data.suppliers')
            ->assertJsonPath('data.suppliers.0.id', $match->id);

        $this->getJson('/api/v1/suppliers?per_page=101')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['per_page']);
    }

    public function test_product_pagination_meta_and_page_size_bounds(): void
    {
        Product::factory()->count(3)->published()->create();

        $this->getJson('/api/v1/products?per_page=2')
            ->assertOk()
            ->assertJsonCount(2, 'data.products')
            ->assertJsonPath('data.meta.current_page', 1)
            ->assertJsonPath('data.meta.per_page', 2)
            ->assertJsonPath('data.meta.total', 3)
            ->assertJsonPath('data.meta.last_page', 2);

        $this->getJson('/api/v1/products?page=2&per_page=2')
            ->assertOk()
            ->assertJsonCount(1, 'data.products')
            ->assertJsonPath('data.meta.current_page', 2)
            ->assertJsonPath('data.meta.total', 3);
    }
}
