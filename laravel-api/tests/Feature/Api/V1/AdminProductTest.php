<?php

namespace Tests\Feature\Api\V1;

use App\Models\Admin;
use App\Models\AuditLog;
use App\Models\Category;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
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
