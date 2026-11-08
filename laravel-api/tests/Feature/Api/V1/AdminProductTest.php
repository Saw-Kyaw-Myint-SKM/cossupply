<?php

namespace Tests\Feature\Api\V1;

use App\Models\Admin;
use App\Models\AuditLog;
use App\Models\Category;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\QuotationItem;
use App\Models\QuotationRequest;
use App\Models\Supplier;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminProductTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');
    }

    public function test_admin_can_create_product_with_photo_price_and_stock(): void
    {
        $this->actingAsAdmin();

        $response = $this->postProduct()->assertCreated();

        $response->assertJsonPath('success', true)
            ->assertJsonPath('data.product.slug', 'plastic-chair')
            ->assertJsonPath('data.product.status', 'DRAFT')
            ->assertJsonPath('data.product.price.retail_price', 5000)
            ->assertJsonPath('data.product.price.minimum_order_quantity', 1)
            ->assertJsonPath('data.product.stock.stock_status', 'IN_STOCK')
            ->assertJsonPath('data.product.stock.stock_quantity', 20);

        $path = $response->json('data.product.photo');

        $this->assertIsString($path);
        $this->assertStringStartsWith('products/', $path);
        Storage::disk('public')->assertExists($path);
        $this->assertSame(url(Storage::disk('public')->url($path)), $response->json('data.product.photo_url'));

        $this->assertDatabaseHas('products', ['slug' => 'plastic-chair', 'photo' => $path]);
        $this->assertDatabaseHas('product_prices', ['retail_price' => 5000, 'minimum_order_quantity' => 1]);
        $this->assertDatabaseHas('product_stocks', ['stock_status' => 'IN_STOCK', 'stock_quantity' => 20]);

        foreach (['product.created', 'product.price_updated', 'product.stock_updated'] as $action) {
            $this->assertDatabaseHas('audit_logs', ['action' => $action, 'entity_type' => 'product']);
        }
    }

    public function test_product_create_validates_required_fields_and_price_rules(): void
    {
        $this->actingAsAdmin();

        $this->postJson('/api/v1/admin/products', $this->validPayload())
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['photo']);

        $this->postProduct(['supplier_id' => 99999])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['supplier_id']);

        $this->postProduct(['category_id' => 99999])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['category_id']);

        $this->postProduct(['retail_price' => 0])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['retail_price']);

        $this->postProduct(['wholesale_price' => -5])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['wholesale_price']);

        $this->postProduct(['discount_price' => 6000])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['discount_price']);

        $this->postProduct(['minimum_order_quantity' => 0])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['minimum_order_quantity']);

        $this->postProduct(['stock_status' => 'SOMETIMES'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['stock_status']);
    }

    public function test_product_create_rejects_invalid_media_types_and_sizes(): void
    {
        $this->actingAsAdmin();

        $this->postProduct(photo: UploadedFile::fake()->create('notes.pdf', 100, 'application/pdf'))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['photo']);

        $this->postProduct(photo: UploadedFile::fake()->image('huge.jpg')->size(2049))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['photo']);
    }

    public function test_product_slug_is_generated_and_collisions_are_rejected(): void
    {
        $this->actingAsAdmin();

        $this->postProduct(['name_en' => null])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['slug']);

        $this->postProduct()->assertCreated()
            ->assertJsonPath('data.product.slug', 'plastic-chair');

        $this->postProduct()
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['slug']);

        $this->postProduct(['slug' => 'plastic-chair', 'name_en' => 'Another Chair'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['slug']);
    }

    public function test_publishing_at_create_time_enforces_publish_rules(): void
    {
        $this->actingAsAdmin();

        $this->postProduct(['status' => 'PUBLISHED'])
            ->assertCreated()
            ->assertJsonPath('data.product.status', 'PUBLISHED');

        $inactiveSupplier = Supplier::factory()->inactive()->create();

        $this->postProduct([
            'status' => 'PUBLISHED',
            'supplier_id' => $inactiveSupplier->id,
            'name_en' => 'Inactive Supplier Chair',
        ])->assertUnprocessable()->assertJsonValidationErrors(['supplier_id']);

        // The failed create must not leave an orphaned photo behind.
        $this->assertCount(1, Storage::disk('public')->files('products'));
    }

    public function test_admin_can_update_product_and_replace_photo(): void
    {
        $this->actingAsAdmin();

        $create = $this->postProduct()->assertCreated();

        $productId = $create->json('data.product.id');
        $oldPath = $create->json('data.product.photo');

        $update = $this->post("/api/v1/admin/products/{$productId}", [
            '_method' => 'PATCH',
            'name_en' => 'Plastic Chair Deluxe',
            'retail_price' => 6500,
            'stock_status' => 'LOW_STOCK',
            'photo' => UploadedFile::fake()->image('replacement.png'),
        ], ['Accept' => 'application/json']);

        $update->assertOk()
            ->assertJsonPath('data.product.name_en', 'Plastic Chair Deluxe')
            ->assertJsonPath('data.product.slug', 'plastic-chair')
            ->assertJsonPath('data.product.price.retail_price', 6500)
            ->assertJsonPath('data.product.stock.stock_status', 'LOW_STOCK');

        $newPath = $update->json('data.product.photo');

        $this->assertNotSame($oldPath, $newPath);
        Storage::disk('public')->assertMissing($oldPath);
        Storage::disk('public')->assertExists($newPath);

        $this->assertDatabaseHas('audit_logs', ['action' => 'product.updated', 'entity_type' => 'product']);

        $priceLog = AuditLog::query()
            ->where('action', 'product.price_updated')
            ->latest('id')
            ->first();

        $this->assertNotNull($priceLog);
        $this->assertSame(6500, $priceLog->new_data['retail_price']);

        $this->assertDatabaseHas('product_prices', ['retail_price' => 6500]);
        $this->assertDatabaseHas('product_stocks', ['stock_status' => 'LOW_STOCK']);
    }

    public function test_publish_transition_validates_supplier_category_photo_and_price(): void
    {
        $this->actingAsAdmin();

        $supplier = Supplier::factory()->create();
        $category = Category::factory()->create();

        $noPrice = Product::factory()->for($supplier)->for($category)->create();
        $this->patchProductStatus($noPrice, 'PUBLISHED')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['retail_price']);

        $inactiveSupplier = Supplier::factory()->inactive()->create();
        $inactiveSupplierProduct = Product::factory()->for($inactiveSupplier)->for($category)->withPrice()->create();
        $this->patchProductStatus($inactiveSupplierProduct, 'PUBLISHED')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['supplier_id']);

        $suspendedSupplier = Supplier::factory()->suspended()->create();
        $suspendedSupplierProduct = Product::factory()->for($suspendedSupplier)->for($category)->withPrice()->create();
        $this->patchProductStatus($suspendedSupplierProduct, 'PUBLISHED')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['supplier_id']);

        $inactiveCategory = Category::factory()->inactive()->create();
        $inactiveCategoryProduct = Product::factory()->for($supplier)->for($inactiveCategory)->withPrice()->create();
        $this->patchProductStatus($inactiveCategoryProduct, 'PUBLISHED')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['category_id']);

        $noPhoto = Product::factory()->for($supplier)->for($category)->withPrice()->create(['photo' => '']);
        $this->patchProductStatus($noPhoto, 'PUBLISHED')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['photo']);

        $ready = Product::factory()->for($supplier)->for($category)->withPrice(['retail_price' => 5000])->create(['photo' => 'products/ready.jpg']);

        $this->patchProductStatus($ready, 'PUBLISHED')
            ->assertOk()
            ->assertJsonPath('data.product.status', 'PUBLISHED');

        $log = AuditLog::query()->where('action', 'product.status_updated')->sole();
        $this->assertSame(['status' => 'DRAFT'], $log->old_data);
        $this->assertSame(['status' => 'PUBLISHED'], $log->new_data);
    }

    public function test_supplier_deactivation_does_not_cascade_but_blocks_new_publish(): void
    {
        $this->actingAsAdmin();

        $supplier = Supplier::factory()->create();
        $category = Category::factory()->create();
        $product = Product::factory()
            ->for($supplier)
            ->for($category)
            ->withPrice(['retail_price' => 5000])
            ->published()
            ->create();

        $this->patchJson("/api/v1/admin/suppliers/{$supplier->id}", ['status' => 'INACTIVE'])
            ->assertOk();

        // Existing published products are not cascaded.
        $this->assertDatabaseHas('products', ['id' => $product->id, 'status' => 'PUBLISHED']);

        // Hiding is still allowed, but a new publish transition is blocked.
        $this->patchProductStatus($product, 'HIDDEN')->assertOk();

        $this->patchProductStatus($product, 'PUBLISHED')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['supplier_id']);
    }

    public function test_status_endpoint_accepts_known_statuses_and_rejects_unknown_ones(): void
    {
        $this->actingAsAdmin();

        $product = Product::factory()
            ->for(Supplier::factory())
            ->for(Category::factory())
            ->withPrice()
            ->create(['photo' => 'products/status.jpg']);

        $this->patchProductStatus($product, 'PUBLISHED')
            ->assertOk()
            ->assertJsonPath('data.product.status', 'PUBLISHED');

        $this->patchProductStatus($product, 'OUT_OF_STOCK')
            ->assertOk()
            ->assertJsonPath('data.product.status', 'OUT_OF_STOCK');

        $this->patchProductStatus($product, 'HIDDEN')
            ->assertOk()
            ->assertJsonPath('data.product.status', 'HIDDEN');

        $this->patchProductStatus($product, 'SOLD')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['status']);
    }

    public function test_product_referenced_by_quotation_or_order_items_cannot_be_deleted(): void
    {
        $this->actingAsAdmin();

        $quotedProduct = Product::factory()->create();
        $quotationRequest = QuotationRequest::factory()->create();

        QuotationItem::create([
            'quotation_request_id' => $quotationRequest->id,
            'product_id' => $quotedProduct->id,
            'supplier_id' => $quotedProduct->supplier_id,
            'product_name_snapshot' => $quotedProduct->name_mm,
            'quantity' => 1,
            'display_price' => 1000,
        ]);

        $this->deleteJson("/api/v1/admin/products/{$quotedProduct->id}")
            ->assertStatus(409)
            ->assertJsonPath('success', false);

        $this->assertDatabaseHas('products', ['id' => $quotedProduct->id]);

        $orderedProduct = Product::factory()->create();
        $order = Order::factory()->create();

        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $orderedProduct->id,
            'supplier_id' => $orderedProduct->supplier_id,
            'product_name_snapshot' => $orderedProduct->name_mm,
            'quantity' => 1,
            'unit_price' => 1000,
            'discount' => 0,
            'line_total' => 1000,
        ]);

        $this->deleteJson("/api/v1/admin/products/{$orderedProduct->id}")
            ->assertStatus(409)
            ->assertJsonPath('success', false);

        $this->assertDatabaseHas('products', ['id' => $orderedProduct->id]);
    }

    public function test_deleting_product_removes_price_stock_photo_and_audits(): void
    {
        $this->actingAsAdmin();

        $create = $this->postProduct()->assertCreated();

        $productId = $create->json('data.product.id');
        $path = $create->json('data.product.photo');

        $this->deleteJson("/api/v1/admin/products/{$productId}")
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->assertDatabaseMissing('products', ['id' => $productId]);
        $this->assertDatabaseCount('product_prices', 0);
        $this->assertDatabaseCount('product_stocks', 0);
        Storage::disk('public')->assertMissing($path);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'product.deleted',
            'entity_type' => 'product',
            'entity_id' => (string) $productId,
        ]);
    }

    public function test_product_list_supports_filters_pagination_and_newest_first_order(): void
    {
        $this->actingAsAdmin();

        $supplier = Supplier::factory()->create();
        $category = Category::factory()->create();

        $match = Product::factory()
            ->for($supplier)
            ->for($category)
            ->published()
            ->create(['name_en' => 'Unique Desk Lamp', 'sku' => 'LAMP-001']);

        Product::factory()->create();

        $this->getJson("/api/v1/admin/products?supplier_id={$supplier->id}&category_id={$category->id}&status=PUBLISHED&search=Desk")
            ->assertOk()
            ->assertJsonCount(1, 'data.products')
            ->assertJsonPath('data.products.0.id', $match->id)
            ->assertJsonStructure(['data' => ['products' => [['id', 'slug', 'status', 'photo_url', 'price', 'stock']], 'meta' => ['current_page', 'per_page', 'total', 'last_page']]]);

        $this->getJson('/api/v1/admin/products?per_page=101')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['per_page']);

        $newest = Product::factory()->create();

        $ids = collect($this->getJson('/api/v1/admin/products')->json('data.products'))->pluck('id');

        $this->assertSame($newest->id, $ids->first());
    }

    public function test_product_list_can_be_sorted_by_created_at(): void
    {
        $this->actingAsAdmin();

        $base = now();

        $oldest = Product::factory()->create([
            'name_en' => 'Oldest Product',
            'created_at' => $base->copy()->subDays(2),
        ]);
        $middle = Product::factory()->create([
            'name_en' => 'Middle Product',
            'created_at' => $base->copy()->subDay(),
        ]);
        $newest = Product::factory()->create([
            'name_en' => 'Newest Product',
            'created_at' => $base->copy(),
        ]);

        $ascending = collect(
            $this->getJson('/api/v1/admin/products?sort_by=created_at&sort_direction=asc')->json('data.products'),
        )->pluck('id');

        $this->assertSame([$oldest->id, $middle->id, $newest->id], $ascending->all());

        $descending = collect(
            $this->getJson('/api/v1/admin/products?sort_by=created_at&sort_direction=desc')->json('data.products'),
        )->pluck('id');

        $this->assertSame([$newest->id, $middle->id, $oldest->id], $descending->all());
    }

    public function test_product_list_rejects_invalid_sort_options(): void
    {
        $this->actingAsAdmin();

        $this->getJson('/api/v1/admin/products?sort_by=name')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('sort_by');

        $this->getJson('/api/v1/admin/products?sort_direction=sideways')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('sort_direction');
    }

    public function test_admin_can_create_product_with_optional_variants(): void
    {
        $this->actingAsAdmin();

        $response = $this->postProduct([
            'variants' => [
                [
                    'attributes' => ['Color' => 'Red', 'Size' => 'M'],
                    'sku' => 'TS-RED-M',
                    'retail_price' => 6000,
                    'stock_quantity' => 5,
                    'stock_status' => 'IN_STOCK',
                    'photo' => UploadedFile::fake()->image('red.jpg'),
                ],
                [
                    'attributes' => ['Color' => 'Blue', 'Size' => 'M'],
                    'sku' => 'TS-BLUE-M',
                    'retail_price' => 6500,
                    'stock_status' => 'LOW_STOCK',
                ],
            ],
        ])->assertCreated();

        $response->assertJsonCount(2, 'data.product.variants')
            ->assertJsonPath('data.product.variants_count', 2)
            ->assertJsonPath('data.product.variants.0.variant_attributes.Color', 'Red')
            ->assertJsonPath('data.product.variants.0.variant_attributes.Size', 'M')
            ->assertJsonPath('data.product.variants.0.retail_price', 6000)
            ->assertJsonPath('data.product.variants.0.stock_status', 'IN_STOCK')
            ->assertJsonPath('data.product.variants.1.sku', 'TS-BLUE-M');

        $productId = $response->json('data.product.id');
        $firstVariant = ProductVariant::query()->where('product_id', $productId)->orderBy('sort_order')->firstOrFail();
        $photoPath = $firstVariant->photo;

        $this->assertSame('plastic-chair-color-red-size-m', $firstVariant->slug);
        $this->assertIsString($photoPath);
        Storage::disk('public')->assertExists($photoPath);
        $this->assertSame(
            url(Storage::disk('public')->url($photoPath)),
            $response->json('data.product.variants.0.photo_url'),
        );

        // A variant without a photo falls back to the product photo URL.
        $this->assertNull($response->json('data.product.variants.1.photo'));
        $this->assertSame(
            $response->json('data.product.photo_url'),
            $response->json('data.product.variants.1.photo_url'),
        );

        $this->assertDatabaseHas('product_variants', [
            'product_id' => $productId,
            'sku' => 'TS-BLUE-M',
            'stock_status' => 'LOW_STOCK',
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'product.variant_created',
            'entity_type' => 'product_variant',
        ]);

        // The edit page loads variants from the detail endpoint.
        $this->getJson("/api/v1/admin/products/{$productId}")
            ->assertOk()
            ->assertJsonCount(2, 'data.product.variants')
            ->assertJsonPath('data.product.variants.0.photo_url', $response->json('data.product.variants.0.photo_url'));
    }

    public function test_product_can_have_no_variants(): void
    {
        $this->actingAsAdmin();

        $this->postProduct(['variants' => null])
            ->assertCreated()
            ->assertJsonPath('data.product.variants', null)
            ->assertJsonPath('data.product.variants_count', 0);

        $this->assertDatabaseCount('product_variants', 0);
    }

    public function test_variant_can_be_created_with_a_flat_name(): void
    {
        $this->actingAsAdmin();

        $response = $this->postProduct([
            'variants' => [
                ['name' => 'Red / M', 'retail_price' => 5000],
                ['name' => 'Blue / L', 'retail_price' => 5500],
            ],
        ])->assertCreated();

        $response->assertJsonCount(2, 'data.product.variants')
            ->assertJsonPath('data.product.variants.0.name', 'Red / M')
            ->assertJsonPath('data.product.variants.1.name', 'Blue / L');

        $productId = $response->json('data.product.id');

        $this->assertDatabaseHas('product_variants', [
            'product_id' => $productId,
            'name' => 'Red / M',
        ]);
        $this->assertSame(
            'plastic-chair-red-m',
            ProductVariant::query()->where('name', 'Red / M')->value('slug'),
        );
    }

    public function test_variant_names_must_be_unique_within_the_product(): void
    {
        $this->actingAsAdmin();

        $this->postProduct([
            'variants' => [
                ['name' => 'Same variant', 'retail_price' => 5000],
                ['name' => 'Same variant', 'retail_price' => 5000],
            ],
        ])->assertUnprocessable()->assertJsonValidationErrors(['variants.1.name']);
    }

    public function test_variant_payload_rejects_duplicate_combinations_discounts_and_skus(): void
    {
        $this->actingAsAdmin();

        $this->postProduct([
            'variants' => [
                ['attributes' => ['Color' => 'Red'], 'retail_price' => 5000],
                ['attributes' => ['Color' => 'Red'], 'retail_price' => 6000],
            ],
        ])->assertUnprocessable()->assertJsonValidationErrors(['variants.1.attributes']);

        $this->postProduct([
            'variants' => [
                ['attributes' => ['Color' => 'Red'], 'retail_price' => 5000, 'discount_price' => 6000],
            ],
        ])->assertUnprocessable()->assertJsonValidationErrors(['variants.0.discount_price']);

        $this->postProduct([
            'variants' => [
                ['attributes' => ['Color' => 'Red'], 'sku' => 'DUP-1', 'retail_price' => 5000],
                ['attributes' => ['Color' => 'Blue'], 'sku' => 'DUP-1', 'retail_price' => 5000],
            ],
        ])->assertUnprocessable()->assertJsonValidationErrors(['variants.1.sku']);
    }

    public function test_admin_can_update_and_remove_variants(): void
    {
        $this->actingAsAdmin();

        $create = $this->postProduct([
            'variants' => [
                ['attributes' => ['Color' => 'Red'], 'sku' => 'RED-1', 'retail_price' => 5000],
                ['attributes' => ['Color' => 'Blue'], 'sku' => 'BLUE-1', 'retail_price' => 5500],
            ],
        ])->assertCreated();

        $productId = $create->json('data.product.id');
        $redId = $create->json('data.product.variants.0.id');
        $blueId = $create->json('data.product.variants.1.id');

        // Update Red, keep Blue, and add Green.
        $this->post("/api/v1/admin/products/{$productId}", [
            '_method' => 'PATCH',
            'variants_sync' => '1',
            'variants' => [
                [
                    'id' => $redId,
                    'attributes' => ['Color' => 'Red'],
                    'sku' => 'RED-2',
                    'retail_price' => 7000,
                ],
                ['id' => $blueId, 'attributes' => ['Color' => 'Blue'], 'retail_price' => 5500],
                ['attributes' => ['Color' => 'Green'], 'sku' => 'GREEN-1', 'retail_price' => 6000],
            ],
        ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonCount(3, 'data.product.variants');

        $this->assertDatabaseHas('product_variants', ['id' => $redId, 'sku' => 'RED-2', 'retail_price' => 7000]);
        $this->assertDatabaseHas('product_variants', ['product_id' => $productId, 'sku' => 'GREEN-1']);

        // Removing Blue from the payload deletes it.
        $this->post("/api/v1/admin/products/{$productId}", [
            '_method' => 'PATCH',
            'variants_sync' => '1',
            'variants' => [
                [
                    'id' => $redId,
                    'attributes' => ['Color' => 'Red'],
                    'retail_price' => 7000,
                ],
            ],
        ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonCount(1, 'data.product.variants');

        $this->assertDatabaseMissing('product_variants', ['id' => $blueId]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'product.variant_deleted']);
    }

    public function test_variants_can_swap_attribute_combinations(): void
    {
        $this->actingAsAdmin();

        $create = $this->postProduct([
            'variants' => [
                ['attributes' => ['Color' => 'Red'], 'sku' => 'RED-1', 'retail_price' => 5000],
                ['attributes' => ['Color' => 'Blue'], 'sku' => 'BLUE-1', 'retail_price' => 5500],
            ],
        ])->assertCreated();

        $productId = $create->json('data.product.id');
        $redId = $create->json('data.product.variants.0.id');
        $blueId = $create->json('data.product.variants.1.id');

        $this->post("/api/v1/admin/products/{$productId}", [
            '_method' => 'PATCH',
            'variants_sync' => '1',
            'variants' => [
                ['id' => $redId, 'attributes' => ['Color' => 'Blue'], 'sku' => 'BLUE-1', 'retail_price' => 5500],
                ['id' => $blueId, 'attributes' => ['Color' => 'Red'], 'sku' => 'RED-1', 'retail_price' => 5000],
            ],
        ], ['Accept' => 'application/json'])->assertOk();

        $this->assertSame(['Color' => 'Blue'], ProductVariant::findOrFail($redId)->variant_attributes);
        $this->assertSame(['Color' => 'Red'], ProductVariant::findOrFail($blueId)->variant_attributes);
        $this->assertSame('BLUE-1', ProductVariant::findOrFail($redId)->sku);
        $this->assertSame('RED-1', ProductVariant::findOrFail($blueId)->sku);
    }

    public function test_deleted_variant_sku_can_be_reused_in_the_same_update(): void
    {
        $this->actingAsAdmin();

        $create = $this->postProduct([
            'variants' => [
                ['attributes' => ['Color' => 'Red'], 'sku' => 'RED-1', 'retail_price' => 5000],
            ],
        ])->assertCreated();

        $productId = $create->json('data.product.id');

        $this->post("/api/v1/admin/products/{$productId}", [
            '_method' => 'PATCH',
            'variants_sync' => '1',
            'variants' => [
                ['attributes' => ['Color' => 'Blue'], 'sku' => 'RED-1', 'retail_price' => 5000],
            ],
        ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonCount(1, 'data.product.variants')
            ->assertJsonPath('data.product.variants.0.sku', 'RED-1');

        $variants = ProductVariant::query()->where('product_id', $productId)->get();

        $this->assertCount(1, $variants);
        $this->assertSame(['Color' => 'Blue'], $variants->first()->variant_attributes);
    }

    public function test_variant_photo_can_be_replaced_and_cleared_variants_are_deleted(): void
    {
        $this->actingAsAdmin();

        $create = $this->postProduct([
            'variants' => [
                [
                    'attributes' => ['Color' => 'Red'],
                    'retail_price' => 5000,
                    'photo' => UploadedFile::fake()->image('red-old.jpg'),
                ],
            ],
        ])->assertCreated();

        $productId = $create->json('data.product.id');
        $variantId = $create->json('data.product.variants.0.id');
        $oldPhoto = $create->json('data.product.variants.0.photo');

        $update = $this->post("/api/v1/admin/products/{$productId}", [
            '_method' => 'PATCH',
            'variants_sync' => '1',
            'variants' => [
                [
                    'id' => $variantId,
                    'attributes' => ['Color' => 'Red'],
                    'retail_price' => 5000,
                    'photo' => UploadedFile::fake()->image('red-new.jpg'),
                ],
            ],
        ], ['Accept' => 'application/json'])->assertOk();

        $newPhoto = $update->json('data.product.variants.0.photo');

        $this->assertNotSame($oldPhoto, $newPhoto);
        Storage::disk('public')->assertMissing($oldPhoto);
        Storage::disk('public')->assertExists($newPhoto);

        // An empty synced list removes every variant.
        $this->post("/api/v1/admin/products/{$productId}", [
            '_method' => 'PATCH',
            'variants_sync' => '1',
        ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('data.product.variants', null)
            ->assertJsonPath('data.product.variants_count', 0);

        $this->assertDatabaseMissing('product_variants', ['id' => $variantId]);
        Storage::disk('public')->assertMissing($newPhoto);
    }

    public function test_variant_id_must_belong_to_the_product_being_updated(): void
    {
        $this->actingAsAdmin();

        $first = $this->postProduct([
            'variants' => [
                ['attributes' => ['Color' => 'Red'], 'retail_price' => 5000],
            ],
        ])->assertCreated();

        $second = $this->postProduct([
            'name_en' => 'Second Chair',
            'variants' => [
                ['attributes' => ['Color' => 'Blue'], 'retail_price' => 5000],
            ],
        ])->assertCreated();

        $foreignVariantId = $second->json('data.product.variants.0.id');

        $this->post("/api/v1/admin/products/{$first->json('data.product.id')}", [
            '_method' => 'PATCH',
            'variants_sync' => '1',
            'variants' => [
                ['id' => $foreignVariantId, 'attributes' => ['Color' => 'Green'], 'retail_price' => 5000],
            ],
        ], ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['variants.0.id']);
    }

    public function test_publishing_with_variants_requires_variant_prices(): void
    {
        $this->actingAsAdmin();

        $this->postProduct([
            'status' => 'PUBLISHED',
            'variants' => [
                ['attributes' => ['Color' => 'Red'], 'retail_price' => null],
            ],
        ])->assertUnprocessable()->assertJsonValidationErrors(['variants.0.retail_price']);

        $this->postProduct([
            'status' => 'PUBLISHED',
            'variants' => [
                ['attributes' => ['Color' => 'Red'], 'retail_price' => 5000],
            ],
        ])->assertCreated()->assertJsonPath('data.product.status', 'PUBLISHED');
    }

    public function test_deleting_product_removes_its_variants_and_photos(): void
    {
        $this->actingAsAdmin();

        $create = $this->postProduct([
            'variants' => [
                [
                    'attributes' => ['Color' => 'Red'],
                    'retail_price' => 5000,
                    'photo' => UploadedFile::fake()->image('red.jpg'),
                ],
            ],
        ])->assertCreated();

        $productId = $create->json('data.product.id');
        $variantPhoto = $create->json('data.product.variants.0.photo');

        $this->deleteJson("/api/v1/admin/products/{$productId}")->assertOk();

        $this->assertDatabaseMissing('product_variants', ['product_id' => $productId]);
        Storage::disk('public')->assertMissing($variantPhoto);
    }

    public function test_product_list_includes_variant_count(): void
    {
        $this->actingAsAdmin();

        $product = Product::factory()->create();
        ProductVariant::factory()->count(2)->create(['product_id' => $product->id]);

        $this->getJson('/api/v1/admin/products')
            ->assertOk()
            ->assertJsonPath('data.products.0.variants_count', 2);
    }

    private function actingAsAdmin(): Admin
    {
        $admin = Admin::factory()->create();
        Sanctum::actingAs($admin, ['admin']);

        return $admin;
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function validPayload(array $overrides = []): array
    {
        return array_merge([
            'supplier_id' => Supplier::factory()->create()->id,
            'category_id' => Category::factory()->create()->id,
            'name_mm' => 'ပလတ်စတစ်ကုတ်အင်္ကျီ',
            'name_en' => 'Plastic Chair',
            'unit' => 'pcs',
            'retail_price' => 5000,
            'minimum_order_quantity' => 1,
            'stock_quantity' => 20,
            'stock_status' => 'IN_STOCK',
            'supplier_note' => 'Confirmed by supplier',
        ], $overrides);
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function postProduct(array $overrides = [], ?UploadedFile $photo = null): TestResponse
    {
        return $this->post('/api/v1/admin/products', $this->validPayload($overrides) + [
            'photo' => $photo ?? UploadedFile::fake()->image('product.jpg'),
        ], ['Accept' => 'application/json']);
    }

    private function patchProductStatus(Product $product, string $status): TestResponse
    {
        return $this->patchJson("/api/v1/admin/products/{$product->id}/status", [
            'status' => $status,
        ]);
    }
}
