<?php

namespace Tests\Feature\Api\V1;

use App\Models\Admin;
use App\Models\AuditLog;
use App\Models\Banner;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminBannerTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');
    }

    public function test_admin_can_create_banner_with_image(): void
    {
        $this->actingAsAdmin();

        $response = $this->post('/api/v1/admin/banners', [
            'title_mm' => 'ရုံးတစ်ခုလုံးအတွက် ပစ္စည်းဖြည့်ပါ',
            'title_en' => 'Stock the whole office',
            'subtitle_mm' => 'စာရွက်၊ မှင်နှင့် ပရိဘောဂ',
            'subtitle_en' => 'Paper, ink, furniture & more',
            'cta_label_mm' => 'ကြည့်ရန်',
            'cta_label_en' => 'Browse',
            'link_url' => '/products',
            'background_style' => 'ocean',
            'image' => UploadedFile::fake()->image('banner.jpg'),
        ], ['Accept' => 'application/json']);

        $response->assertCreated()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.banner.title_en', 'Stock the whole office')
            ->assertJsonPath('data.banner.status', 'ACTIVE')
            ->assertJsonPath('data.banner.sort_order', 0)
            ->assertJsonPath('data.banner.background_style', 'ocean')
            ->assertJsonPath('data.banner.link_url', '/products');

        $path = $response->json('data.banner.image');

        $this->assertIsString($path);
        $this->assertStringStartsWith('banners/', $path);
        Storage::disk('public')->assertExists($path);
        $this->assertSame(url(Storage::disk('public')->url($path)), $response->json('data.banner.image_url'));

        $this->assertDatabaseHas('banners', [
            'title_en' => 'Stock the whole office',
            'image' => $path,
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'banner.created',
            'entity_type' => 'banner',
        ]);
    }

    public function test_banner_creation_requires_titles(): void
    {
        $this->actingAsAdmin();

        $this->postJson('/api/v1/admin/banners', [
            'title_mm' => 'ခေါင်းစဉ်',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['title_en']);
    }

    public function test_banner_can_be_created_without_an_image(): void
    {
        $this->actingAsAdmin();

        $this->postJson('/api/v1/admin/banners', [
            'title_mm' => 'ခေါင်းစဉ်',
            'title_en' => 'Text only',
        ])->assertCreated()
            ->assertJsonPath('data.banner.image', null)
            ->assertJsonPath('data.banner.background_style', 'ink');
    }

    public function test_banner_rejects_unsafe_button_links(): void
    {
        $this->actingAsAdmin();

        $this->post('/api/v1/admin/banners', [
            'title_mm' => 'ခေါင်းစဉ်',
            'title_en' => 'Title',
            'link_url' => 'javascript:alert(1)',
            'image' => UploadedFile::fake()->image('banner.jpg'),
        ], ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['link_url']);
    }

    public function test_admin_can_update_banner_and_replace_image(): void
    {
        $this->actingAsAdmin();

        $create = $this->post('/api/v1/admin/banners', [
            'title_mm' => 'ခေါင်းစဉ်',
            'title_en' => 'Old title',
            'image' => UploadedFile::fake()->image('old.jpg'),
        ], ['Accept' => 'application/json'])->assertCreated();

        $bannerId = $create->json('data.banner.id');
        $oldPath = $create->json('data.banner.image');

        $update = $this->post("/api/v1/admin/banners/{$bannerId}", [
            '_method' => 'PUT',
            'title_en' => 'New title',
            'image' => UploadedFile::fake()->image('new.png'),
        ], ['Accept' => 'application/json']);

        $update->assertOk()
            ->assertJsonPath('data.banner.title_en', 'New title')
            ->assertJsonPath('data.banner.title_mm', 'ခေါင်းစဉ်');

        $newPath = $update->json('data.banner.image');

        $this->assertNotSame($oldPath, $newPath);
        Storage::disk('public')->assertMissing($oldPath);
        Storage::disk('public')->assertExists($newPath);

        $log = AuditLog::query()->where('action', 'banner.updated')->sole();

        $this->assertSame($oldPath, $log->old_data['image']);
        $this->assertSame($newPath, $log->new_data['image']);
    }

    public function test_update_without_a_new_image_keeps_the_current_one(): void
    {
        $this->actingAsAdmin();

        $banner = Banner::factory()->create(['image' => 'banners/existing.jpg']);
        Storage::disk('public')->put('banners/existing.jpg', 'binary');

        $this->patchJson("/api/v1/admin/banners/{$banner->id}", [
            'subtitle_en' => 'Updated subtitle',
        ])->assertOk()
            ->assertJsonPath('data.banner.subtitle_en', 'Updated subtitle')
            ->assertJsonPath('data.banner.image', 'banners/existing.jpg');

        Storage::disk('public')->assertExists('banners/existing.jpg');
    }

    public function test_optional_fields_can_be_cleared_and_status_toggled(): void
    {
        $this->actingAsAdmin();

        $banner = Banner::factory()->create([
            'subtitle_en' => 'Keep or clear',
            'cta_label_en' => 'Browse',
            'link_url' => '/products',
        ]);

        $this->patchJson("/api/v1/admin/banners/{$banner->id}", [
            'subtitle_en' => '',
            'cta_label_en' => '',
            'link_url' => '',
            'status' => 'INACTIVE',
            'background_style' => 'ember',
        ])->assertOk()
            ->assertJsonPath('data.banner.subtitle_en', null)
            ->assertJsonPath('data.banner.cta_label_en', null)
            ->assertJsonPath('data.banner.link_url', null)
            ->assertJsonPath('data.banner.status', 'INACTIVE')
            ->assertJsonPath('data.banner.background_style', 'ember');

        $this->patchJson("/api/v1/admin/banners/{$banner->id}", ['status' => 'PAUSED'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['status']);

        $this->patchJson("/api/v1/admin/banners/{$banner->id}", ['background_style' => 'neon'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['background_style']);
    }

    public function test_admin_can_delete_banner_with_file_cleanup(): void
    {
        $this->actingAsAdmin();

        $create = $this->post('/api/v1/admin/banners', [
            'title_mm' => 'ခေါင်းစဉ်',
            'title_en' => 'Title',
            'image' => UploadedFile::fake()->image('banner.jpg'),
        ], ['Accept' => 'application/json'])->assertCreated();

        $bannerId = $create->json('data.banner.id');
        $path = $create->json('data.banner.image');

        $this->deleteJson("/api/v1/admin/banners/{$bannerId}")
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->assertDatabaseMissing('banners', ['id' => $bannerId]);
        Storage::disk('public')->assertMissing($path);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'banner.deleted',
            'entity_type' => 'banner',
            'entity_id' => (string) $bannerId,
        ]);
    }

    public function test_banner_list_supports_filters_and_pagination(): void
    {
        $this->actingAsAdmin();

        Banner::factory()->count(3)->create();
        Banner::factory()->inactive()->create(['title_en' => 'Zeta Warehouse', 'sort_order' => 99]);

        $this->getJson('/api/v1/admin/banners?status=INACTIVE&search=Zeta&per_page=1')
            ->assertOk()
            ->assertJsonCount(1, 'data.banners')
            ->assertJsonPath('data.meta.total', 1)
            ->assertJsonPath('data.meta.per_page', 1)
            ->assertJsonStructure(['data' => ['banners', 'meta' => ['current_page', 'per_page', 'total', 'last_page']]]);

        $this->getJson('/api/v1/admin/banners?per_page=101')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['per_page']);
    }

    public function test_banner_list_is_ordered_by_sort_order_then_id(): void
    {
        $this->actingAsAdmin();

        $second = Banner::factory()->create(['sort_order' => 20]);
        $first = Banner::factory()->create(['sort_order' => 10]);
        $tie = Banner::factory()->create(['sort_order' => 20]);

        $ids = collect($this->getJson('/api/v1/admin/banners')->json('data.banners'))->pluck('id');

        $this->assertSame([$first->id, $second->id, $tie->id], $ids->all());
    }

    public function test_banner_list_can_be_sorted_by_created_at(): void
    {
        $this->actingAsAdmin();

        $base = now();

        $oldest = Banner::factory()->create(['created_at' => $base->copy()->subDays(2)]);
        $middle = Banner::factory()->create(['created_at' => $base->copy()->subDay()]);
        $newest = Banner::factory()->create(['created_at' => $base->copy()]);

        $descending = collect(
            $this->getJson('/api/v1/admin/banners?sort_by=created_at&sort_direction=desc')->json('data.banners'),
        )->pluck('id');

        $this->assertSame([$newest->id, $middle->id, $oldest->id], $descending->all());
    }

    public function test_banner_endpoints_require_an_admin_token(): void
    {
        $this->getJson('/api/v1/admin/banners')->assertUnauthorized();
        $this->postJson('/api/v1/admin/banners', [])->assertUnauthorized();
    }

    private function actingAsAdmin(): Admin
    {
        $admin = Admin::factory()->create();
        Sanctum::actingAs($admin, ['admin']);

        return $admin;
    }
}
