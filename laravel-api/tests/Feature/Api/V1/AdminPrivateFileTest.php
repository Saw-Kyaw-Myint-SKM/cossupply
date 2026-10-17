<?php

namespace Tests\Feature\Api\V1;

use App\Models\Admin;
use App\Models\Customer;
use App\Services\Media\PrivateFileService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminPrivateFileTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');
    }

    public function test_admin_can_stream_an_existing_private_file(): void
    {
        $this->actingAsAdmin();

        Storage::disk('local')->put('receipts/2026/receipt-001.txt', 'private-receipt-content');

        $response = $this->get('/api/v1/admin/files/receipts/2026/receipt-001.txt', [
            'Accept' => 'application/json',
        ]);

        $response->assertOk();
        $this->assertSame('private-receipt-content', $response->streamedContent());
    }

    public function test_missing_private_file_returns_json_not_found(): void
    {
        $this->actingAsAdmin();

        $this->getJson('/api/v1/admin/files/receipts/missing.txt')
            ->assertNotFound()
            ->assertJsonPath('success', false)
            ->assertJsonPath('message', 'File not found.');
    }

    public function test_guest_and_customer_cannot_stream_private_files(): void
    {
        Storage::disk('local')->put('receipts/receipt-001.txt', 'private');

        $this->getJson('/api/v1/admin/files/receipts/receipt-001.txt')->assertUnauthorized();

        $customer = Customer::factory()->create();
        $token = $customer->createToken('customer-token', ['customer'])->plainTextToken;

        $this->withToken($token)
            ->getJson('/api/v1/admin/files/receipts/receipt-001.txt')
            ->assertForbidden();
    }

    public function test_traversal_and_dot_segment_paths_are_rejected(): void
    {
        $this->actingAsAdmin();

        Storage::disk('local')->put('receipts/receipt-001.txt', 'private');

        $unsafeUrls = [
            '/api/v1/admin/files/receipts/../receipts/receipt-001.txt',
            '/api/v1/admin/files/receipts/./receipt-001.txt',
            '/api/v1/admin/files/receipts//receipt-001.txt',
            '/api/v1/admin/files/%2e%2e%2fsecret.txt',
            '/api/v1/admin/files/%2e%2e%2freceipts%2freceipt-001.txt',
            '/api/v1/admin/files/receipts%5C..%5Creceipts%5Creceipt-001.txt',
        ];

        foreach ($unsafeUrls as $url) {
            $this->getJson($url)
                ->assertNotFound()
                ->assertJsonPath('success', false);
        }
    }

    public function test_private_file_service_rejects_unsafe_paths(): void
    {
        $service = app(PrivateFileService::class);

        $this->assertTrue($service->isSafePath('receipts/2026/receipt-001.txt'));

        $unsafePaths = [
            null,
            '',
            '/etc/passwd',
            'C:\\Windows\\win.ini',
            '../secret.txt',
            'receipts/../secret.txt',
            './receipts/receipt-001.txt',
            'receipts//receipt-001.txt',
            "receipts/receipt\0.txt",
        ];

        foreach ($unsafePaths as $path) {
            $this->assertFalse($service->isSafePath($path), 'Path ['.($path ?? 'null').'] should be unsafe.');
        }
    }

    private function actingAsAdmin(): Admin
    {
        $admin = Admin::factory()->create();
        Sanctum::actingAs($admin, ['admin']);

        return $admin;
    }
}
