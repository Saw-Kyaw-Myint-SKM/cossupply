<?php

namespace Tests\Feature\Api\V1;

use App\Models\Admin;
use App\Models\AuditLog;
use App\Models\Category;
use App\Models\Customer;
use App\Models\Product;
use App\Models\Quotation;
use App\Models\QuotationItem;
use App\Models\QuotationRequest;
use App\Models\Setting;
use App\Models\Supplier;
use App\Services\Quotation\QuotationPdfTemplate;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminQuotationWorkflowTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');

        Setting::factory()->create([
            'key' => 'quotation_service_fee_percentage',
            'value' => '5',
            'value_type' => 'integer',
            'group_name' => 'quotation',
            'label' => 'Service Fee',
        ]);
        Setting::factory()->create([
            'key' => 'quotation_validity_days',
            'value' => '10',
            'value_type' => 'integer',
            'group_name' => 'quotation',
            'label' => 'Validity',
        ]);
        Setting::factory()->create([
            'key' => 'company_name',
            'value' => 'CoSupply Test',
            'value_type' => 'string',
            'group_name' => 'company',
            'label' => 'Company',
        ]);
    }

    public function test_guest_and_customer_cannot_access_admin_quotation_routes(): void
    {
        $admin = Admin::factory()->create();
        $customer = Customer::factory()->create();
        $request = QuotationRequest::factory()->create();
        $quotation = Quotation::factory()->for($request)->create();

        $this->getJson('/api/v1/admin/quotation-requests')->assertUnauthorized();

        $token = $customer->createToken('customer-token', ['customer'])->plainTextToken;

        $this->withToken($token)
            ->getJson('/api/v1/admin/quotation-requests')
            ->assertForbidden();
        $this->withToken($token)
            ->getJson("/api/v1/admin/quotations/{$quotation->id}")
            ->assertForbidden();
        $this->withToken($token)
            ->postJson("/api/v1/admin/quotations/{$quotation->id}/send")
            ->assertForbidden();

        $adminToken = $admin->createToken('admin-token', ['admin'])->plainTextToken;

        $this->withToken($adminToken)
            ->getJson('/api/v1/admin/quotation-requests')
            ->assertOk();
    }

    public function test_admin_queue_filters_and_assignment_and_detail_grouping(): void
    {
        $admin = $this->actingAsAdmin();
        $other = Admin::factory()->create();
        $request = $this->quotationRequest(withEmail: 'buyer@example.com');

        $this->getJson('/api/v1/admin/quotation-requests?status=NEW&unassigned=1')
            ->assertOk()
            ->assertJsonPath('data.quotation_requests.0.id', $request->id)
            ->assertJsonPath('data.quotation_requests.0.item_count', 1)
            ->assertJsonPath('data.service_fee_default_percentage', 5);

        $this->patchJson("/api/v1/admin/quotation-requests/{$request->id}/assignment", [
            'assigned_admin_id' => $other->id,
        ])->assertOk()->assertJsonPath('data.quotation_request.assigned_admin.id', $other->id);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'quotation_request.assigned',
            'entity_id' => (string) $request->id,
            'admin_id' => $admin->id,
        ]);

        $this->getJson("/api/v1/admin/quotation-requests/{$request->id}")
            ->assertOk()
            ->assertJsonPath('data.quotation_request.suppliers.0.supplier.shop_name', $request->items()->first()->supplier->shop_name)
            ->assertJsonPath('data.quotation_request.suppliers.0.items.0.quantity', 2)
            ->assertJsonStructure([
                'data' => [
                    'quotation_request' => [
                        'items' => [['photo_url', 'sku']],
                        'suppliers' => [['items' => [['photo_url']]]],
                    ],
                ],
            ])
            ->assertJsonFragment(['id' => $admin->id, 'name' => $admin->name]);
    }

    public function test_admin_can_log_supplier_communication_with_private_attachment(): void
    {
        $this->actingAsAdmin();
        $request = $this->quotationRequest();
        $supplierId = $request->items()->first()->supplier_id;

        $response = $this->postJson("/api/v1/admin/quotation-requests/{$request->id}/communications", [
            'supplier_id' => $supplierId,
            'contact_method' => 'VIBER',
            'message_text' => 'Please confirm stock and price.',
            'supplier_response' => 'Stock available, delivery in 3 days.',
            'attachment' => UploadedFile::fake()->create('quote.pdf', 100, 'application/pdf'),
        ])->assertCreated();

        $path = $response->json('data.communication.attachment_path');

        $this->assertIsString($path);
        Storage::disk('local')->assertExists($path);
        $response->assertJsonPath('data.communication.contact_method', 'VIBER');

        $this->assertDatabaseHas('supplier_communications', [
            'quotation_request_id' => $request->id,
            'supplier_id' => $supplierId,
            'contact_method' => 'VIBER',
        ]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'supplier_communication.created']);
    }

    public function test_version_calculates_totals_server_side_and_does_not_change_request_items(): void
    {
        $admin = $this->actingAsAdmin();
        $request = $this->quotationRequest();
        $item = $request->items()->first();

        $response = $this->postJson("/api/v1/admin/quotation-requests/{$request->id}/quotations", [
            'items' => [[
                'product_id' => $item->product_id,
                'quantity' => 2,
                'unit_price' => 10000,
                'discount' => 1000,
                'delivery_date' => now()->addDays(3)->toDateString(),
                'warranty_note' => '6 months',
                'supplier_note' => 'Confirmed by phone.',
            ]],
            'discount' => 500,
            'delivery_fee' => 2000,
            'admin_note' => 'Valid for the listed items only.',
        ])->assertCreated();

        $response->assertJsonPath('data.quotation.version', 1)
            ->assertJsonPath('data.quotation.status', 'DRAFT')
            ->assertJsonPath('data.quotation.is_current', false)
            ->assertJsonPath('data.quotation.subtotal', 19000)
            ->assertJsonPath('data.quotation.service_fee_percentage', 5)
            ->assertJsonPath('data.quotation.service_fee', 950)
            ->assertJsonPath('data.quotation.total_amount', 21450)
            ->assertJsonPath('data.quotation.payment_method', 'CASH_ON_DELIVERY')
            ->assertJsonPath('data.quotation.valid_until', now()->addDays(10)->toDateString())
            ->assertJsonPath('data.quotation.items.0.line_total', 19000);

        $quotationId = $response->json('data.quotation.id');

        $this->assertDatabaseHas('quotations', [
            'id' => $quotationId,
            'created_by_admin_id' => $admin->id,
            'subtotal' => 19000,
            'service_fee' => 950,
            'total_amount' => 21450,
        ]);

        $this->assertDatabaseHas('quotation_items', [
            'id' => $item->id,
            'quantity' => 2,
            'display_price' => 10000,
        ]);
        $this->assertDatabaseHas('quotation_requests', [
            'id' => $request->id,
            'status' => 'PREPARING_QUOTATION',
        ]);
    }

    public function test_service_fee_can_be_overridden_per_version_and_sent_values_are_snapshotted(): void
    {
        $this->actingAsAdmin();
        $request = $this->quotationRequest();
        $item = $request->items()->first();

        $create = $this->postJson("/api/v1/admin/quotation-requests/{$request->id}/quotations", [
            'items' => [[
                'product_id' => $item->product_id,
                'quantity' => 1,
                'unit_price' => 10000,
            ]],
            'service_fee_percentage' => 12,
        ])->assertCreated();

        $create->assertJsonPath('data.quotation.service_fee_percentage', 12)
            ->assertJsonPath('data.quotation.service_fee', 1200);

        $quotationId = $create->json('data.quotation.id');

        Setting::query()->where('key', 'quotation_service_fee_percentage')->update(['value' => '30']);

        $this->getJson("/api/v1/admin/quotations/{$quotationId}")
            ->assertOk()
            ->assertJsonPath('data.quotation.service_fee_percentage', 12)
            ->assertJsonPath('data.quotation.service_fee', 1200)
            ->assertJsonStructure([
                'data' => ['quotation' => ['items' => [['photo_url', 'sku_snapshot']]]],
            ]);
    }

    public function test_draft_can_be_edited_but_sent_version_is_immutable(): void
    {
        $this->actingAsAdmin();
        $request = $this->quotationRequest();
        $item = $request->items()->first();

        $create = $this->postJson("/api/v1/admin/quotation-requests/{$request->id}/quotations", [
            'items' => [[
                'product_id' => $item->product_id,
                'quantity' => 1,
                'unit_price' => 10000,
            ]],
        ])->assertCreated();

        $quotationId = $create->json('data.quotation.id');

        $this->putJson("/api/v1/admin/quotations/{$quotationId}", [
            'items' => [[
                'product_id' => $item->product_id,
                'quantity' => 3,
                'unit_price' => 8000,
                'discount' => 2000,
            ]],
            'discount' => 0,
            'delivery_fee' => 1000,
        ])->assertOk()
            ->assertJsonPath('data.quotation.subtotal', 22000)
            ->assertJsonPath('data.quotation.total_amount', 24100);

        $this->postJson("/api/v1/admin/quotations/{$quotationId}/send")
            ->assertOk()
            ->assertJsonPath('data.quotation.status', 'SENT');

        $this->putJson("/api/v1/admin/quotations/{$quotationId}", [
            'items' => [[
                'product_id' => $item->product_id,
                'quantity' => 1,
                'unit_price' => 1000,
            ]],
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['quotation']);
    }

    public function test_sending_new_version_supersedes_old_current_and_keeps_both_pdfs(): void
    {
        $this->actingAsAdmin();
        $request = $this->quotationRequest();
        $item = $request->items()->first();

        $payload = fn (int $price): array => [
            'items' => [[
                'product_id' => $item->product_id,
                'quantity' => 1,
                'unit_price' => $price,
            ]],
        ];

        $first = $this->postJson("/api/v1/admin/quotation-requests/{$request->id}/quotations", $payload(10000))
            ->assertCreated();
        $firstId = $first->json('data.quotation.id');
        $firstSend = $this->postJson("/api/v1/admin/quotations/{$firstId}/send")->assertOk();
        $firstPdf = $firstSend->json('data.quotation.pdfs.0.file_name');

        $second = $this->postJson("/api/v1/admin/quotation-requests/{$request->id}/quotations", $payload(12000))
            ->assertCreated();
        $secondId = $second->json('data.quotation.id');
        $this->postJson("/api/v1/admin/quotations/{$secondId}/send")->assertOk();

        $this->assertDatabaseHas('quotations', [
            'id' => $firstId,
            'status' => 'SUPERSEDED',
            'is_current' => false,
        ]);
        $this->assertDatabaseHas('quotations', [
            'id' => $secondId,
            'status' => 'SENT',
            'is_current' => true,
        ]);
        $this->assertDatabaseHas('quotation_requests', [
            'id' => $request->id,
            'status' => 'QUOTATION_SENT',
        ]);

        $firstPdfRow = Quotation::query()->findOrFail($firstId)->pdfs()->first();
        $secondPdfRow = Quotation::query()->findOrFail($secondId)->pdfs()->first();

        $this->assertNotNull($firstPdfRow);
        $this->assertNotNull($secondPdfRow);
        $this->assertNotSame($firstPdfRow->file_path, $secondPdfRow->file_path);
        Storage::disk('local')->assertExists($firstPdfRow->file_path);
        Storage::disk('local')->assertExists($secondPdfRow->file_path);
        $this->assertStringContainsString('v1', $firstPdf);

        $download = $this->get("/api/v1/admin/quotations/{$firstId}/pdf/download")
            ->assertOk();

        $this->assertStringStartsWith('%PDF-1.4', $download->streamedContent());
        $this->assertDatabaseHas('email_logs', [
            'related_type' => Quotation::class,
            'related_id' => $secondId,
            'email_type' => 'QUOTATION_SENT',
            'status' => 'SENT',
        ]);
    }

    public function test_email_failure_does_not_roll_back_sent_quotation_and_resend_is_possible(): void
    {
        $this->actingAsAdmin();
        $request = $this->quotationRequest(withEmail: null);
        $item = $request->items()->first();

        $create = $this->postJson("/api/v1/admin/quotation-requests/{$request->id}/quotations", [
            'items' => [[
                'product_id' => $item->product_id,
                'quantity' => 1,
                'unit_price' => 10000,
            ]],
        ])->assertCreated();

        $quotationId = $create->json('data.quotation.id');

        $this->postJson("/api/v1/admin/quotations/{$quotationId}/send")
            ->assertOk()
            ->assertJsonPath('data.quotation.status', 'SENT')
            ->assertJsonPath('data.email.status', 'FAILED');

        $this->assertDatabaseHas('quotations', ['id' => $quotationId, 'status' => 'SENT']);
        $this->assertDatabaseHas('email_logs', [
            'related_id' => $quotationId,
            'status' => 'FAILED',
        ]);

        $request->update(['email' => 'buyer@example.com']);

        $this->postJson("/api/v1/admin/quotations/{$quotationId}/resend")
            ->assertOk()
            ->assertJsonPath('data.email.status', 'SENT')
            ->assertJsonPath('data.email.recipient_email', 'buyer@example.com');

        $this->assertDatabaseHas('audit_logs', ['action' => 'quotation.email_resent']);
    }

    public function test_invalid_status_transition_returns_conflict(): void
    {
        $this->actingAsAdmin();
        $request = $this->quotationRequest();
        $request->update(['status' => 'ACCEPTED']);

        $this->patchJson("/api/v1/admin/quotation-requests/{$request->id}/status", [
            'status' => 'CANCELLED',
        ])->assertStatus(409);
    }

    public function test_version_cannot_be_created_for_closed_request(): void
    {
        $this->actingAsAdmin();
        $request = $this->quotationRequest()->fresh();
        $request->update(['status' => 'ACCEPTED']);
        $item = $request->items()->first();

        $this->postJson("/api/v1/admin/quotation-requests/{$request->id}/quotations", [
            'items' => [[
                'product_id' => $item->product_id,
                'quantity' => 1,
                'unit_price' => 10000,
            ]],
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['quotation_request']);
    }

    public function test_zero_unit_price_is_accepted_and_does_not_break_totals(): void
    {
        $this->actingAsAdmin();
        $request = $this->quotationRequest();
        $item = $request->items()->first();

        $this->postJson("/api/v1/admin/quotation-requests/{$request->id}/quotations", [
            'items' => [[
                'product_id' => $item->product_id,
                'quantity' => 2,
                'unit_price' => 0,
            ]],
            'delivery_fee' => 1500,
        ])->assertCreated()
            ->assertJsonPath('data.quotation.subtotal', 0)
            ->assertJsonPath('data.quotation.service_fee', 0)
            ->assertJsonPath('data.quotation.total_amount', 1500)
            ->assertJsonPath('data.quotation.items.0.line_total', 0);
    }

    public function test_negative_unit_price_is_rejected(): void
    {
        $this->actingAsAdmin();
        $request = $this->quotationRequest();
        $item = $request->items()->first();

        $this->postJson("/api/v1/admin/quotation-requests/{$request->id}/quotations", [
            'items' => [[
                'product_id' => $item->product_id,
                'quantity' => 1,
                'unit_price' => -1,
            ]],
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['items.0.unit_price']);
    }

    public function test_create_audit_records_validity_and_payment_terms(): void
    {
        $admin = $this->actingAsAdmin();
        $request = $this->quotationRequest();
        $item = $request->items()->first();
        $validUntil = now()->addDays(4)->toDateString();

        $this->postJson("/api/v1/admin/quotation-requests/{$request->id}/quotations", [
            'items' => [[
                'product_id' => $item->product_id,
                'quantity' => 1,
                'unit_price' => 10000,
            ]],
            'valid_until' => $validUntil,
            'payment_terms' => 'Full payment on delivery.',
        ])->assertCreated();

        $log = AuditLog::query()
            ->where('action', 'quotation.created')
            ->latest('id')
            ->firstOrFail();

        $this->assertSame($admin->id, $log->admin_id);
        $this->assertSame($validUntil, $log->new_data['valid_until']);
        $this->assertSame('Full payment on delivery.', $log->new_data['payment_terms']);
        $this->assertSame('CASH_ON_DELIVERY', $log->new_data['payment_method']);
        $this->assertSame(5, $log->new_data['service_fee_percentage']);
        $this->assertSame(500, $log->new_data['service_fee']);
    }

    public function test_update_audits_validity_payment_terms_and_service_fee_override(): void
    {
        $admin = $this->actingAsAdmin();
        $request = $this->quotationRequest();
        $item = $request->items()->first();
        $originalValidUntil = now()->addDays(5)->toDateString();
        $newValidUntil = now()->addDays(9)->toDateString();

        $create = $this->postJson("/api/v1/admin/quotation-requests/{$request->id}/quotations", [
            'items' => [[
                'product_id' => $item->product_id,
                'quantity' => 1,
                'unit_price' => 10000,
            ]],
            'service_fee_percentage' => 12,
            'valid_until' => $originalValidUntil,
            'payment_terms' => 'Payment within 7 days.',
        ])->assertCreated();

        $quotationId = $create->json('data.quotation.id');

        $this->putJson("/api/v1/admin/quotations/{$quotationId}", [
            'items' => [[
                'product_id' => $item->product_id,
                'quantity' => 1,
                'unit_price' => 10000,
            ]],
            'service_fee_percentage' => 20,
            'valid_until' => $newValidUntil,
            'payment_terms' => 'Full payment on delivery.',
        ])->assertOk();

        $updated = AuditLog::query()
            ->where('action', 'quotation.updated')
            ->latest('id')
            ->firstOrFail();

        $this->assertSame($originalValidUntil, $updated->old_data['valid_until']);
        $this->assertSame($newValidUntil, $updated->new_data['valid_until']);
        $this->assertSame('Payment within 7 days.', $updated->old_data['payment_terms']);
        $this->assertSame('Full payment on delivery.', $updated->new_data['payment_terms']);
        $this->assertSame(12, $updated->old_data['service_fee_percentage']);
        $this->assertSame(20, $updated->new_data['service_fee_percentage']);

        $override = AuditLog::query()
            ->where('action', 'quotation.service_fee_overridden')
            ->latest('id')
            ->firstOrFail();

        $this->assertSame($admin->id, $override->admin_id);
        $this->assertSame(12, $override->old_data['service_fee_percentage']);
        $this->assertSame(20, $override->new_data['service_fee_percentage']);
        $this->assertSame(2000, $override->new_data['service_fee']);
    }

    public function test_create_override_audits_the_master_default_as_prior_value(): void
    {
        $this->actingAsAdmin();
        $request = $this->quotationRequest();
        $item = $request->items()->first();

        $this->postJson("/api/v1/admin/quotation-requests/{$request->id}/quotations", [
            'items' => [[
                'product_id' => $item->product_id,
                'quantity' => 1,
                'unit_price' => 10000,
            ]],
            'service_fee_percentage' => 12,
        ])->assertCreated();

        $override = AuditLog::query()
            ->where('action', 'quotation.service_fee_overridden')
            ->latest('id')
            ->firstOrFail();

        $this->assertSame(5, $override->old_data['service_fee_percentage']);
        $this->assertSame(12, $override->new_data['service_fee_percentage']);
        $this->assertSame(1200, $override->new_data['service_fee']);
    }

    public function test_generated_pdf_includes_its_generation_time(): void
    {
        $this->actingAsAdmin();
        $request = $this->quotationRequest();
        $item = $request->items()->first();

        $create = $this->postJson("/api/v1/admin/quotation-requests/{$request->id}/quotations", [
            'items' => [[
                'product_id' => $item->product_id,
                'quantity' => 1,
                'unit_price' => 10000,
            ]],
        ])->assertCreated();

        $quotationId = $create->json('data.quotation.id');
        $this->postJson("/api/v1/admin/quotations/{$quotationId}/send")->assertOk();

        $content = $this->get("/api/v1/admin/quotations/{$quotationId}/pdf/download")
            ->assertOk()
            ->streamedContent();

        // mPDF encodes text into per-font glyph streams, so the rendered copy
        // is asserted against the HTML template instead of the binary body.
        $this->assertStringStartsWith('%PDF-', $content);
        $this->assertStringContainsString('/Type /Page', $content);
        $this->assertStringContainsString('/FontFile2', $content);

        $quotation = Quotation::query()->with([
            'quotationRequest',
            'items.supplier',
            'createdByAdmin',
        ])->findOrFail($quotationId);

        $html = app(QuotationPdfTemplate::class)->html($quotation, now());

        $this->assertMatchesRegularExpression(
            '/Generated by .+ from .+ on \d{2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2}\./',
            $html,
        );

        $this->assertStringContainsString('AMOUNT', $html);
        $this->assertStringContainsString('All amounts in MMK', $html);
        $this->assertStringContainsString('TOTAL (COD)', $html);
        $this->assertStringNotContainsString('LINE TOTAL', $html);
        $this->assertStringNotContainsString('SKU ', $html);
        $this->assertStringNotContainsString('Warranty:', $html);
        $this->assertStringNotContainsString('Supplier ', $html);

        // Typography/colour system: cyan headings and the bordered totals box.
        $this->assertStringContainsString('color: #008ecc', $html);
        $this->assertStringContainsString('class="totals"', $html);
        $this->assertStringContainsString('class="doc-type">QUOTATION', $html);
    }

    public function test_supplier_warranty_policy_is_printed_once_in_the_pdf(): void
    {
        $this->actingAsAdmin();

        $customer = Customer::factory()->create();
        $supplier = Supplier::factory()->create([
            'warranty_policy' => '90-day warranty against manufacturing defects.',
        ]);
        $product = Product::factory()
            ->for($supplier)
            ->for(Category::factory())
            ->published()
            ->withPrice(['retail_price' => 10000])
            ->create();

        $request = QuotationRequest::factory()
            ->for($customer)
            ->create(['email' => 'buyer@example.com']);

        QuotationItem::factory()
            ->forRequest($request)
            ->forProduct($product)
            ->create(['quantity' => 1, 'display_price' => 10000]);

        $item = $request->fresh()->items()->first();

        $create = $this->postJson("/api/v1/admin/quotation-requests/{$request->id}/quotations", [
            'items' => [[
                'product_id' => $item->product_id,
                'quantity' => 1,
                'unit_price' => 10000,
            ]],
        ])->assertCreated();

        $quotationId = $create->json('data.quotation.id');
        $this->postJson("/api/v1/admin/quotations/{$quotationId}/send")->assertOk();

        $content = $this->get("/api/v1/admin/quotations/{$quotationId}/pdf/download")
            ->assertOk()
            ->streamedContent();

        $this->assertStringStartsWith('%PDF-', $content);

        $quotation = Quotation::query()->with([
            'quotationRequest',
            'items.supplier',
            'createdByAdmin',
        ])->findOrFail($quotationId);

        $html = app(QuotationPdfTemplate::class)->html($quotation, now());

        $this->assertStringContainsString('WARRANTY', $html);
        $this->assertSame(1, substr_count($html, '90-day warranty against manufacturing defects.'));
    }

    public function test_download_regenerates_a_blank_placeholder_pdf(): void
    {
        $admin = $this->actingAsAdmin();
        $request = $this->quotationRequest();
        $item = $request->items()->first();

        $create = $this->postJson("/api/v1/admin/quotation-requests/{$request->id}/quotations", [
            'items' => [[
                'product_id' => $item->product_id,
                'quantity' => 1,
                'unit_price' => 10000,
            ]],
        ])->assertCreated();

        $quotationId = $create->json('data.quotation.id');
        $this->postJson("/api/v1/admin/quotations/{$quotationId}/send")->assertOk();

        $quotation = Quotation::query()->findOrFail($quotationId);
        $placeholderPath = 'quotation-pdfs/placeholder.pdf';

        Storage::disk('local')->put($placeholderPath, <<<'PDF'
%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] >>
endobj
trailer
<< /Root 1 0 R >>
%%EOF
PDF);

        $quotation->pdfs()->create([
            'file_path' => $placeholderPath,
            'file_name' => 'placeholder.pdf',
            'generated_by_admin_id' => $admin->id,
            'generated_at' => now()->addMinute(),
        ]);

        $content = $this->get("/api/v1/admin/quotations/{$quotationId}/pdf/download")
            ->assertOk()
            ->streamedContent();

        $this->assertStringContainsString('/Contents', $content);
        $this->assertStringContainsString('/Type /Page', $content);
    }

    private function actingAsAdmin(): Admin
    {
        $admin = Admin::factory()->create();
        Sanctum::actingAs($admin, ['admin']);

        return $admin;
    }

    private function quotationRequest(?string $withEmail = 'buyer@example.com'): QuotationRequest
    {
        $customer = Customer::factory()->create();
        $supplier = Supplier::factory()->create();
        $product = Product::factory()
            ->for($supplier)
            ->for(Category::factory())
            ->published()
            ->withPrice(['retail_price' => 10000])
            ->create();

        $request = QuotationRequest::factory()
            ->for($customer)
            ->create(['email' => $withEmail]);

        QuotationItem::factory()
            ->forRequest($request)
            ->forProduct($product)
            ->create(['quantity' => 2, 'display_price' => 10000]);

        return $request->fresh();
    }
}
