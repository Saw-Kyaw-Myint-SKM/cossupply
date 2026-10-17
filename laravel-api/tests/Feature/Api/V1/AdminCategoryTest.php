<?php

namespace Tests\Feature\Api\V1;

use App\Models\Admin;
use App\Models\AuditLog;
use App\Models\Category;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminCategoryTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');
    }

    public function test_admin_can_create_category_with_generated_slug_and_image(): void
    {
        $this->actingAsAdmin();

        $response = $this->post('/api/v1/admin/categories', [
            'name_mm' => 'အီလက်ထရောနစ်',
            'name_en' => 'Electronics',
            'image' => UploadedFile::fake()->image('category.jpg'),
        ], ['Accept' => 'application/json']);

        $response->assertCreated()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.category.slug', 'electronics')
            ->assertJsonPath('data.category.status', 'ACTIVE');

        $path = $response->json('data.category.image');

        $this->assertIsString($path);
        $this->assertStringStartsWith('categories/', $path);
        Storage::disk('public')->assertExists($path);
        $this->assertSame(url(Storage::disk('public')->url($path)), $response->json('data.category.image_url'));

        $this->assertDatabaseHas('categories', ['slug' => 'electronics', 'image' => $path]);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'category.created',
            'entity_type' => 'category',
        ]);
    }

    public function test_category_slug_is_required_when_it_cannot_be_generated(): void
    {
        $this->actingAsAdmin();

        $response = $this->postJson('/api/v1/admin/categories', [
            'name_mm' => 'ပစ္စည်း',
            // Burmese names transliterate (e.g. "pssi"); punctuation cannot slugify at all.
            'name_en' => '!!!',
        ]);

        $response->assertUnprocessable()->assertJsonValidationErrors(['slug']);
    }

    public function test_category_slug_collisions_are_rejected(): void
    {
        $this->actingAsAdmin();

        Category::factory()->create(['slug' => 'electronics']);

        // Derived from name_en when omitted.
        $this->postJson('/api/v1/admin/categories', [
            'name_mm' => 'အီလက်ထရောနစ်',
            'name_en' => 'Electronics',
        ])->assertUnprocessable()->assertJsonValidationErrors(['slug']);

        // Explicit slug.
        $this->postJson('/api/v1/admin/categories', [
            'name_mm' => 'အီလက်ထရောနစ်',
            'name_en' => 'Home Electronics',
            'slug' => 'electronics',
        ])->assertUnprocessable()->assertJsonValidationErrors(['slug']);
    }

    public function test_admin_can_update_category_and_replace_image(): void
    {
        $this->actingAsAdmin();

        $create = $this->post('/api/v1/admin/categories', [
            'name_mm' => 'အီလက်ထရောနစ်',
            'name_en' => 'Electronics',
            'image' => UploadedFile::fake()->image('old.jpg'),
        ], ['Accept' => 'application/json'])->assertCreated();

        $categoryId = $create->json('data.category.id');
        $oldPath = $create->json('data.category.image');

        $update = $this->post("/api/v1/admin/categories/{$categoryId}", [
            '_method' => 'PATCH',
            'name_en' => 'Electronics Updated',
            'image' => UploadedFile::fake()->image('new.png'),
        ], ['Accept' => 'application/json']);

        $update->assertOk()
            ->assertJsonPath('data.category.name_en', 'Electronics Updated')
            ->assertJsonPath('data.category.slug', 'electronics');

        $newPath = $update->json('data.category.image');

        $this->assertNotSame($oldPath, $newPath);
        Storage::disk('public')->assertMissing($oldPath);
        Storage::disk('public')->assertExists($newPath);

        $log = AuditLog::query()->where('action', 'category.updated')->sole();

        $this->assertSame($oldPath, $log->old_data['image']);
        $this->assertSame($newPath, $log->new_data['image']);
    }

    public function test_category_cannot_be_its_own_parent(): void
    {
        $this->actingAsAdmin();

        $category = Category::factory()->create();

        $this->patchJson("/api/v1/admin/categories/{$category->id}", [
            'parent_id' => $category->id,
        ])->assertUnprocessable()->assertJsonValidationErrors(['parent_id']);
    }

    public function test_category_status_can_be_toggled_and_invalid_values_are_rejected(): void
    {
        $this->actingAsAdmin();

        $category = Category::factory()->create();

        $this->patchJson("/api/v1/admin/categories/{$category->id}", ['status' => 'INACTIVE'])
            ->assertOk()
            ->assertJsonPath('data.category.status', 'INACTIVE');

        $this->assertDatabaseHas('categories', ['id' => $category->id, 'status' => 'INACTIVE']);

        $this->patchJson("/api/v1/admin/categories/{$category->id}", ['status' => 'PAUSED'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['status']);
    }

    public function test_category_with_children_cannot_be_deleted(): void
    {
        $this->actingAsAdmin();

        $parent = Category::factory()->create();
        Category::factory()->childOf($parent)->create();

        $this->deleteJson("/api/v1/admin/categories/{$parent->id}")
            ->assertStatus(409)
            ->assertJsonPath('success', false);

        $this->assertDatabaseHas('categories', ['id' => $parent->id]);
    }

    public function test_category_with_products_cannot_be_deleted(): void
    {
        $this->actingAsAdmin();

        $category = Category::factory()->create();
        Product::factory()->create(['category_id' => $category->id]);

        $this->deleteJson("/api/v1/admin/categories/{$category->id}")
            ->assertStatus(409)
            ->assertJsonPath('success', false);

        $this->assertDatabaseHas('categories', ['id' => $category->id]);
    }

    public function test_admin_can_delete_unreferenced_category_with_file_cleanup(): void
    {
        $this->actingAsAdmin();

        $create = $this->post('/api/v1/admin/categories', [
            'name_mm' => 'အီလက်ထရောနစ်',
            'name_en' => 'Electronics',
            'image' => UploadedFile::fake()->image('category.jpg'),
        ], ['Accept' => 'application/json'])->assertCreated();

        $categoryId = $create->json('data.category.id');
        $path = $create->json('data.category.image');

        $this->deleteJson("/api/v1/admin/categories/{$categoryId}")
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->assertDatabaseMissing('categories', ['id' => $categoryId]);
        Storage::disk('public')->assertMissing($path);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'category.deleted',
            'entity_type' => 'category',
            'entity_id' => (string) $categoryId,
        ]);
    }

    public function test_category_list_supports_filters_and_pagination(): void
    {
        $this->actingAsAdmin();

        Category::factory()->count(3)->create();
        Category::factory()->inactive()->create(['name_en' => 'Zeta Furniture', 'slug' => 'zeta-furniture']);

        $this->getJson('/api/v1/admin/categories?status=INACTIVE&search=Zeta&per_page=1')
            ->assertOk()
            ->assertJsonCount(1, 'data.categories')
            ->assertJsonPath('data.meta.total', 1)
            ->assertJsonPath('data.meta.per_page', 1)
            ->assertJsonStructure(['data' => ['categories', 'meta' => ['current_page', 'per_page', 'total', 'last_page']]]);

        $this->getJson('/api/v1/admin/categories?per_page=101')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['per_page']);
    }

    private function actingAsAdmin(): Admin
    {
        $admin = Admin::factory()->create();
        Sanctum::actingAs($admin, ['admin']);

        return $admin;
    }
}
