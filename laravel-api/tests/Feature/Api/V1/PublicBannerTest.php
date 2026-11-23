<?php

namespace Tests\Feature\Api\V1;

use App\Models\Banner;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PublicBannerTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_endpoint_returns_only_active_banners_in_display_order(): void
    {
        $second = Banner::factory()->create(['title_en' => 'Second', 'sort_order' => 20]);
        $first = Banner::factory()->create(['title_en' => 'First', 'sort_order' => 10]);
        $hidden = Banner::factory()->inactive()->create(['title_en' => 'Hidden', 'sort_order' => 0]);

        $response = $this->getJson('/api/v1/banners');

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonCount(2, 'data.banners')
            ->assertJsonPath('data.banners.0.id', $first->id)
            ->assertJsonPath('data.banners.1.id', $second->id);

        $ids = collect($response->json('data.banners'))->pluck('id');
        $this->assertFalse($ids->contains($hidden->id));

        $payload = $response->json('data.banners.0');

        $this->assertArrayNotHasKey('status', $payload);
        $this->assertArrayHasKey('image_url', $payload);
        $this->assertArrayHasKey('background_style', $payload);
        $this->assertArrayHasKey('cta_label_mm', $payload);
        $this->assertArrayHasKey('link_url', $payload);
    }

    public function test_public_endpoint_returns_an_empty_list_when_nothing_is_active(): void
    {
        Banner::factory()->inactive()->count(2)->create();

        $this->getJson('/api/v1/banners')
            ->assertOk()
            ->assertJsonCount(0, 'data.banners');
    }
}
