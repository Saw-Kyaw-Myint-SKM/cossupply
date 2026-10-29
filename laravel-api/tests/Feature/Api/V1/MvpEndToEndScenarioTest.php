<?php

namespace Tests\Feature\Api\V1;

use App\Enums\NotificationType;
use App\Enums\PaymentStatus;
use App\Enums\QuotationVersionStatus;
use App\Models\Admin;
use App\Models\Customer;
use App\Models\Product;
use App\Models\Setting;
use App\Models\Supplier;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Task 13: one end-to-end walk through every required MVP scenario.
 *
 * 1. Guest browses the catalog and is refused when requesting a quotation.
 * 2. Customer registers and submits a quotation request.
 * 3. Admin contacts the supplier, creates and sends a quotation version.
 * 4. Customer reads the notification, views the quotation, requests a change.
 * 5. Admin sends a superseding version.
 * 6. Customer accepts the latest version and exactly one order is created.
 * 7. Admin confirms the supplier, delivers in full, records full COD, and
 *    the order completes.
 * 8. A foreign customer cannot read or act on any of those records.
 *
 * The flow uses only documented HTTP endpoints (no factories for domain
 * transitions) so a regression in routing, authorization or status rules
 * breaks this test.
 */
class MvpEndToEndScenarioTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');

        // Deterministic quotation money rules: 5% service fee, 10-day validity.
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

    public function test_complete_mvp_scenario_from_guest_browsing_to_completed_cod_order(): void
    {
        // ---------------------------------------------------------------
        // Scenario 1 — guest browses the catalog.
        // ---------------------------------------------------------------
        $supplier = Supplier::factory()->create([
            'phone' => '09111111111',
            'viber_phone' => '09111111111',
        ]);

        $product = Product::factory()
            ->for($supplier)
            ->published()
            ->withPrice([
                'retail_price' => 10000,
                'wholesale_price' => null,
                'discount_price' => null,
                'minimum_order_quantity' => 1,
            ])
            ->withStock(['stock_status' => 'IN_STOCK'])
            ->create();

        $this->getJson('/api/v1/products')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonFragment(['id' => $product->id]);

        $this->getJson("/api/v1/products/{$product->id}")
            ->assertOk()
            ->assertJsonPath('data.product.id', $product->id);

        // The guest cart lives in the browser; the server-side gate is the
        // authentication requirement on quotation-request creation.
        $this->postJson('/api/v1/customer/quotation-requests', [
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ])->assertUnauthorized();

        // ---------------------------------------------------------------
        // Scenario 2 — customer registers and submits a request.
        // ---------------------------------------------------------------
        $register = $this->postJson('/api/v1/auth/register', [
            'name' => 'Aung Aung',
            'phone' => '09123456789',
            'email' => 'aung@example.com',
            'company_name' => 'Aung Trading',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ])->assertCreated();

        $customerId = (int) $register->json('data.user.id');
        $customerToken = (string) $register->json('data.token');

        $submit = $this->withToken($customerToken)->postJson('/api/v1/customer/quotation-requests', [
            'items' => [['product_id' => $product->id, 'quantity' => 2]],
            'name' => 'Aung Aung',
            'phone' => '09123456789',
            'email' => 'aung@example.com',
            'city' => 'Yangon',
            'township' => 'Hlaing',
            'delivery_address' => 'No. 123, Main Road, Hlaing Township',
        ])->assertCreated();

        $requestId = (int) $submit->json('data.quotation_request.id');
        $submit->assertJsonPath('data.quotation_request.customer_id', $customerId)
            ->assertJsonPath('data.quotation_request.status', 'NEW');

        // ---------------------------------------------------------------
        // Scenario 3 — admin contacts the supplier and sends v1.
        // ---------------------------------------------------------------
        $admin = Admin::factory()->create(['email' => 'ops@example.com']);

        $adminLogin = $this->postJson('/api/v1/admin/login', [
            'email' => 'ops@example.com',
            'password' => 'password',
        ])->assertOk();

        $adminToken = (string) $adminLogin->json('data.token');

        $this->withToken($adminToken)
            ->getJson('/api/v1/admin/quotation-requests?status=NEW')
            ->assertOk()
            ->assertJsonPath('data.quotation_requests.0.id', $requestId);

        $this->withToken($adminToken)
            ->postJson("/api/v1/admin/quotation-requests/{$requestId}/communications", [
                'supplier_id' => $supplier->id,
                'contact_method' => 'VIBER',
                'message_text' => 'Please confirm stock and price for 2 units.',
                'supplier_response' => 'Stock available, delivery in 3 days.',
            ])
            ->assertCreated()
            ->assertJsonPath('data.communication.supplier_id', $supplier->id);

        $v1 = $this->withToken($adminToken)
            ->postJson("/api/v1/admin/quotation-requests/{$requestId}/quotations", [
                'items' => [[
                    'product_id' => $product->id,
                    'quantity' => 2,
                    'unit_price' => 10000,
                    'discount' => 0,
                    'delivery_date' => now()->addDays(3)->toDateString(),
                    'warranty_note' => '6 months',
                ]],
                'discount' => 0,
                'delivery_fee' => 500,
                'admin_note' => 'Valid for the listed items only.',
            ])->assertCreated();

        $v1Id = (int) $v1->json('data.quotation.id');
        // 2 × 10000 + 500 delivery + 5% service fee (1000).
        $v1->assertJsonPath('data.quotation.subtotal', 20000)
            ->assertJsonPath('data.quotation.service_fee', 1000)
            ->assertJsonPath('data.quotation.total_amount', 21500);

        $this->withToken($adminToken)
            ->postJson("/api/v1/admin/quotations/{$v1Id}/send")
            ->assertOk()
            ->assertJsonPath('data.quotation.status', 'SENT')
            ->assertJsonPath('data.email.status', 'SENT');

        // ---------------------------------------------------------------
        // Scenario 4 — customer reads the notification, views the
        // quotation (VIEWED), and requests a change.
        // ---------------------------------------------------------------
        $this->withToken($customerToken)
            ->getJson('/api/v1/notifications')
            ->assertOk()
            ->assertJsonFragment(['type' => NotificationType::QUOTATION_SENT->value]);

        $this->withToken($customerToken)
            ->getJson("/api/v1/customer/quotation-requests/{$requestId}")
            ->assertOk()
            ->assertJsonPath('data.quotation_request.current_quotation.id', $v1Id)
            ->assertJsonPath('data.quotation_request.current_quotation.status', 'VIEWED')
            ->assertJsonPath('data.quotation_request.current_quotation.total_amount', 21500)
            ->assertJsonPath('data.quotation_request.can_accept', true);

        $this->withToken($customerToken)
            ->postJson("/api/v1/customer/quotations/{$v1Id}/request-change", [
                'customer_note' => 'Please reduce the delivery fee to 200 MMK.',
            ])
            ->assertOk()
            ->assertJsonPath('data.quotation_request.status', 'CHANGE_REQUESTED');

        // ---------------------------------------------------------------
        // Scenario 5 — admin sends a superseding version.
        // ---------------------------------------------------------------
        $v2 = $this->withToken($adminToken)
            ->postJson("/api/v1/admin/quotation-requests/{$requestId}/quotations", [
                'items' => [[
                    'product_id' => $product->id,
                    'quantity' => 2,
                    'unit_price' => 10000,
                    'discount' => 0,
                ]],
                'discount' => 0,
                'delivery_fee' => 200,
            ])->assertCreated();

        $v2Id = (int) $v2->json('data.quotation.id');
        $this->assertSame(2, (int) $v2->json('data.quotation.version'));

        $this->withToken($adminToken)
            ->postJson("/api/v1/admin/quotations/{$v2Id}/send")
            ->assertOk()
            ->assertJsonPath('data.quotation.status', 'SENT');

        $this->assertDatabaseHas('quotations', [
            'id' => $v1Id,
            'status' => QuotationVersionStatus::SUPERSEDED->value,
            'is_current' => false,
        ]);
        $this->assertDatabaseHas('quotations', [
            'id' => $v2Id,
            'status' => QuotationVersionStatus::SENT->value,
            'is_current' => true,
        ]);

        // ---------------------------------------------------------------
        // Scenario 6 — customer accepts the latest version; one order.
        // ---------------------------------------------------------------
        $accept = $this->withToken($customerToken)
            ->postJson("/api/v1/customer/quotations/{$v2Id}/accept")
            ->assertOk()
            ->assertJsonPath('data.quotation.status', 'ACCEPTED')
            ->assertJsonPath('data.quotation_request.status', 'ACCEPTED')
            ->assertJsonPath('data.order.order_status', 'SUPPLIER_CONFIRMATION_REQUIRED');

        $orderId = (int) $accept->json('data.order.id');
        // 20000 + 200 delivery + 1000 service fee.
        $this->assertSame(21200, (int) $accept->json('data.order.total_amount'));

        $this->assertDatabaseCount('orders', 1);
        $this->assertDatabaseHas('orders', [
            'id' => $orderId,
            'quotation_id' => $v2Id,
            'customer_id' => $customerId,
            'order_status' => 'SUPPLIER_CONFIRMATION_REQUIRED',
            'payment_status' => PaymentStatus::NOT_PAID->value,
        ]);

        // ---------------------------------------------------------------
        // Scenario 7 — supplier confirmed, full delivery, full COD,
        // payment confirmed, order completed.
        // ---------------------------------------------------------------
        $this->withToken($adminToken)
            ->postJson("/api/v1/admin/orders/{$orderId}/supplier-confirmation", [
                'result' => 'CONFIRMED',
            ])
            ->assertOk()
            ->assertJsonPath('data.order.order_status', 'PREPARING');

        $this->withToken($adminToken)
            ->postJson("/api/v1/admin/orders/{$orderId}/delivery-status", [
                'status' => 'READY_TO_SHIP',
            ])
            ->assertOk()
            ->assertJsonPath('data.order.order_status', 'READY_TO_SHIP');

        $this->withToken($adminToken)
            ->postJson("/api/v1/admin/orders/{$orderId}/delivery-status", [
                'status' => 'OUT_FOR_DELIVERY',
                'delivery_partner' => 'Royal Express',
                'tracking_number' => 'TRK-E2E-01',
            ])
            ->assertOk()
            ->assertJsonPath('data.order.payment_status', 'CASH_COLLECTION_PENDING');

        $this->withToken($adminToken)
            ->postJson("/api/v1/admin/orders/{$orderId}/delivery-status", [
                'status' => 'DELIVERED',
                'received_by' => 'Aung Aung',
            ])
            ->assertOk()
            ->assertJsonPath('data.order.order_status', 'DELIVERED');

        $this->withToken($adminToken)
            ->postJson("/api/v1/admin/orders/{$orderId}/cash-collection", [
                'amount_collected' => 21200,
                'received_by' => 'Aung Aung',
            ])
            ->assertOk()
            ->assertJsonPath('data.order.cash_payment.status', 'CASH_COLLECTED')
            ->assertJsonPath('data.order.cash_payment.amount_remaining', 0)
            ->assertJsonPath('data.order.cash_payment.receipt_available', true);

        $this->withToken($adminToken)
            ->postJson("/api/v1/admin/orders/{$orderId}/payment-confirmation", [
                'note' => 'Cash counted against the receipt.',
            ])
            ->assertOk()
            ->assertJsonPath('data.order.order_status', 'COMPLETED')
            ->assertJsonPath('data.order.cash_payment.status', 'PAYMENT_CONFIRMED');

        $this->assertDatabaseHas('orders', [
            'id' => $orderId,
            'order_status' => 'COMPLETED',
            'payment_status' => 'PAYMENT_CONFIRMED',
        ]);

        // The owner can download the private receipt.
        $receipt = $this->withToken($customerToken)
            ->get("/api/v1/customer/orders/{$orderId}/receipt/download");

        $receipt->assertOk();
        $this->assertStringStartsWith('%PDF', $receipt->streamedContent());

        // ---------------------------------------------------------------
        // Scenario 8 — a foreign customer reaches none of it.
        // ---------------------------------------------------------------
        $intruder = $this->postJson('/api/v1/auth/register', [
            'name' => 'Intruder',
            'phone' => '09999999999',
            'email' => 'intruder@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ])->assertCreated();

        $intruderToken = (string) $intruder->json('data.token');

        $notificationId = DB::table('notifications')
            ->where('customer_id', $customerId)
            ->where('type', NotificationType::QUOTATION_SENT->value)
            ->value('id');

        $this->assertNotNull($notificationId);

        $this->withToken($intruderToken)
            ->getJson("/api/v1/customer/quotation-requests/{$requestId}")
            ->assertNotFound();

        $this->withToken($intruderToken)
            ->postJson("/api/v1/customer/quotations/{$v2Id}/accept")
            ->assertNotFound();

        $this->withToken($intruderToken)
            ->getJson("/api/v1/customer/orders/{$orderId}")
            ->assertNotFound();

        $this->withToken($intruderToken)
            ->get("/api/v1/customer/orders/{$orderId}/receipt/download")
            ->assertNotFound();

        $this->withToken($intruderToken)
            ->patchJson("/api/v1/notifications/{$notificationId}/read")
            ->assertNotFound();

        // Rejected calls changed nothing.
        $this->assertDatabaseCount('orders', 1);
        $this->assertDatabaseHas('quotations', [
            'id' => $v2Id,
            'status' => 'ACCEPTED',
        ]);
        $this->assertDatabaseHas('notifications', [
            'id' => $notificationId,
            'is_read' => false,
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'admin_id' => $admin->id,
            'action' => 'admin.login',
        ]);

        $this->assertSame($customerId, Customer::query()->findOrFail($customerId)->id);
    }
}
