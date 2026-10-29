<?php

namespace Tests\Feature\Api\V1;

use App\Enums\DeliveryStatus;
use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Enums\QuotationRequestStatus;
use App\Models\Admin;
use App\Models\AuditLog;
use App\Models\CashPayment;
use App\Models\Customer;
use App\Models\Delivery;
use App\Models\Notification as InAppNotification;
use App\Models\Order;
use App\Models\Product;
use App\Models\Quotation;
use App\Models\QuotationRequest;
use App\Models\QuotationVersionItem;
use App\Models\Supplier;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Task 12: access control, sensitive data, audit trail, rate limiting and
 * server-owned money rules.
 *
 * These tests deliberately exercise the *other* side of existing happy-path
 * suites: a foreign customer id, a client-supplied total, a repeated login
 * attempt and a private file path must all fail closed.
 */
class SecurityHardeningTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array{0: Customer, 1: string}
     */
    private function authenticateCustomer(?Customer $customer = null): array
    {
        $customer ??= Customer::factory()->create();
        $token = $customer->createToken('customer-token', ['customer'])->plainTextToken;

        return [$customer, $token];
    }

    /**
     * @return array{0: Admin, 1: string}
     */
    private function authenticateAdmin(?Admin $admin = null): array
    {
        $admin ??= Admin::factory()->create();
        $token = $admin->createToken('admin-token', ['admin'])->plainTextToken;

        return [$admin, $token];
    }

    /**
     * A current, sent quotation with one line for the given customer.
     *
     * @return array{0: QuotationRequest, 1: Quotation}
     */
    private function sentQuotation(Customer $customer): array
    {
        $request = QuotationRequest::factory()->create([
            'customer_id' => $customer->id,
            'status' => QuotationRequestStatus::QUOTATION_SENT->value,
            'email' => 'buyer@example.com',
        ]);

        $quotation = Quotation::factory()
            ->sent()
            ->priced(20000, 0, 500, 5)
            ->create([
                'quotation_request_id' => $request->id,
                'quotation_number' => $request->quotation_number,
                'valid_until' => now()->addDays(7)->toDateString(),
            ]);

        $product = Product::factory()->for(Supplier::factory())->create();

        QuotationVersionItem::factory()
            ->forQuotation($quotation)
            ->forProduct($product)
            ->create([
                'quantity' => 2,
                'unit_price' => 10000,
                'discount' => 0,
                'line_total' => 20000,
            ]);

        return [$request->refresh(), $quotation->refresh()];
    }

    /**
     * An order that belongs to the given customer, with delivery and COD rows.
     *
     * @return array{0: Order, 1: Delivery, 2: CashPayment}
     */
    private function orderFor(Customer $customer): array
    {
        $request = QuotationRequest::factory()->create([
            'customer_id' => $customer->id,
            'email' => 'buyer@example.com',
        ]);

        $quotation = Quotation::factory()
            ->accepted()
            ->priced(20000, 0, 500, 5)
            ->create([
                'quotation_request_id' => $request->id,
                'quotation_number' => $request->quotation_number,
            ]);

        $order = Order::factory()
            ->priced(20000, 0, 500, 5)
            ->create([
                'quotation_id' => $quotation->id,
                'quotation_request_id' => $request->id,
                'customer_id' => $customer->id,
                'customer_name' => $customer->name,
                'email' => $customer->email,
                'order_status' => OrderStatus::DELIVERED->value,
                'delivery_status' => DeliveryStatus::DELIVERED->value,
                'payment_status' => PaymentStatus::CASH_COLLECTED->value,
            ]);

        $delivery = Delivery::factory()->forOrder($order)->create([
            'delivery_status' => DeliveryStatus::DELIVERED->value,
            'delivered_at' => now(),
            'received_by' => $customer->name,
        ]);

        $payment = CashPayment::factory()
            ->forOrder($order)
            ->forDelivery($delivery)
            ->create([
                'status' => PaymentStatus::CASH_COLLECTED->value,
                'amount_collected' => 21500,
                'amount_remaining' => 0,
                'collected_at' => now(),
                'received_by' => $customer->name,
            ]);

        return [$order->refresh(), $delivery, $payment];
    }

    public function test_customer_login_is_rate_limited_after_five_failed_attempts(): void
    {
        Customer::factory()->create(['email' => 'limited@example.com']);

        for ($attempt = 1; $attempt <= 5; $attempt++) {
            $this->postJson('/api/v1/auth/login', [
                'email' => 'limited@example.com',
                'password' => 'wrong-password',
            ])->assertUnprocessable();
        }

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'limited@example.com',
            'password' => 'wrong-password',
        ]);

        $response->assertStatus(429)
            ->assertJsonPath('success', false)
            ->assertJsonPath('message', 'Too many attempts. Please wait and try again.');

        $response->assertHeader('Retry-After');
    }

    public function test_admin_login_is_rate_limited_after_five_failed_attempts(): void
    {
        Admin::factory()->create(['email' => 'admin@example.com']);

        for ($attempt = 1; $attempt <= 5; $attempt++) {
            $this->postJson('/api/v1/admin/login', [
                'email' => 'admin@example.com',
                'password' => 'wrong-password',
            ])->assertUnprocessable();
        }

        $this->postJson('/api/v1/admin/login', [
            'email' => 'admin@example.com',
            'password' => 'wrong-password',
        ])->assertStatus(429)
            ->assertJsonPath('success', false);
    }

    public function test_admin_login_and_logout_are_written_to_the_audit_trail(): void
    {
        $admin = Admin::factory()->create(['email' => 'admin@example.com']);

        $login = $this->postJson('/api/v1/admin/login', [
            'email' => 'admin@example.com',
            'password' => 'password',
        ])->assertOk();

        $this->assertDatabaseHas('audit_logs', [
            'admin_id' => $admin->id,
            'action' => 'admin.login',
            'entity_type' => 'admin',
            'entity_id' => (string) $admin->id,
        ]);

        $this->withToken($login->json('data.token'))
            ->postJson('/api/v1/admin/logout')
            ->assertOk();

        $this->assertDatabaseHas('audit_logs', [
            'admin_id' => $admin->id,
            'action' => 'admin.logout',
            'entity_type' => 'admin',
            'entity_id' => (string) $admin->id,
        ]);
    }

    public function test_audit_log_list_is_admin_only_and_exposes_old_and_new_data(): void
    {
        [$admin, $token] = $this->authenticateAdmin();
        $otherAdmin = Admin::factory()->create();

        $settingLog = AuditLog::factory()->for($admin)->create([
            'action' => 'setting.updated',
            'entity_type' => 'setting',
            'entity_id' => '7',
            'old_data' => ['key' => 'quotation_validity_days', 'value' => 7],
            'new_data' => ['key' => 'quotation_validity_days', 'value' => 14],
            'created_at' => now()->subDay(),
        ]);

        AuditLog::factory()->for($otherAdmin)->create([
            'action' => 'ORDER_DELIVERY_UPDATED',
            'entity_type' => 'order',
            'entity_id' => '9',
            'created_at' => now(),
        ]);

        $this->withToken($token)
            ->getJson('/api/v1/admin/audit-logs')
            ->assertOk()
            ->assertJsonPath('data.meta.total', 2)
            ->assertJsonPath('data.audit_logs.0.action', 'ORDER_DELIVERY_UPDATED')
            ->assertJsonCount(2, 'data.audit_logs');

        $filtered = $this->withToken($token)
            ->getJson('/api/v1/admin/audit-logs?action=setting.updated&admin_id='.$admin->id)
            ->assertOk()
            ->assertJsonPath('data.meta.total', 1)
            ->assertJsonPath('data.audit_logs.0.id', $settingLog->id)
            ->assertJsonPath('data.audit_logs.0.entity_id', '7')
            ->assertJsonPath('data.audit_logs.0.admin.id', $admin->id)
            ->assertJsonPath('data.audit_logs.0.old_data.value', 7)
            ->assertJsonPath('data.audit_logs.0.new_data.value', 14);

        $filtered->assertJsonMissingPath('data.audit_logs.0.admin.password');

        // The entity filter and the free-text search share the same trail.
        $this->withToken($token)
            ->getJson('/api/v1/admin/audit-logs?entity_type=setting&search=no-such-entity')
            ->assertOk()
            ->assertJsonPath('data.meta.total', 0);

        $this->withToken($token)
            ->getJson('/api/v1/admin/audit-logs?entity_type=setting&search=7')
            ->assertOk()
            ->assertJsonPath('data.meta.total', 1);

        [$customer, $customerToken] = $this->authenticateCustomer();

        $this->withToken($customerToken)
            ->getJson('/api/v1/admin/audit-logs')
            ->assertForbidden();

        $this->flushHeaders();
        $this->app['auth']->forgetGuards();

        $this->getJson('/api/v1/admin/audit-logs')->assertUnauthorized();
    }

    public function test_customer_directory_is_admin_only_and_never_leaks_credentials(): void
    {
        [$admin, $token] = $this->authenticateAdmin();

        $active = Customer::factory()->business()->create(['name' => 'Daw Hla']);
        [$request] = $this->sentQuotation($active);
        $this->orderFor($active);

        $suspended = Customer::factory()->suspended()->create(['name' => 'Ko Aung']);

        $this->withToken($token)
            ->getJson('/api/v1/admin/customers')
            ->assertOk()
            ->assertJsonPath('data.meta.total', 2)
            ->assertJsonCount(2, 'data.customers')
            ->assertJsonPath('data.customers.1.id', $active->id)
            ->assertJsonPath('data.customers.1.quotation_requests_count', 2)
            ->assertJsonPath('data.customers.1.orders_count', 1)
            ->assertJsonMissingPath('data.customers.0.password')
            ->assertJsonMissingPath('data.customers.0.remember_token');

        $this->withToken($token)
            ->getJson('/api/v1/admin/customers?status=active&search=Daw')
            ->assertOk()
            ->assertJsonPath('data.meta.total', 1)
            ->assertJsonPath('data.customers.0.id', $active->id)
            ->assertJsonPath('data.customers.0.quotation_requests_count', 2);

        $this->withToken($token)
            ->getJson('/api/v1/admin/customers?customer_type=individual')
            ->assertOk()
            ->assertJsonPath('data.meta.total', 1)
            ->assertJsonPath('data.customers.0.id', $suspended->id);

        [, $customerToken] = $this->authenticateCustomer();

        $this->withToken($customerToken)
            ->getJson('/api/v1/admin/customers')
            ->assertForbidden();

        $this->flushHeaders();
        $this->app['auth']->forgetGuards();

        $this->getJson('/api/v1/admin/customers')->assertUnauthorized();

        // The request created above belongs to the listed customer.
        $this->assertSame($active->id, $request->customer_id);
    }

    public function test_foreign_customers_cannot_read_or_act_on_quotations_orders_receipts_and_notifications(): void
    {
        Storage::fake('local');

        [$owner] = $this->authenticateCustomer();
        [, $intruderToken] = $this->authenticateCustomer();

        [$request, $quotation] = $this->sentQuotation($owner);
        [$order] = $this->orderFor($owner);
        $notification = InAppNotification::factory()->forCustomer($owner)->create();

        // Quotation detail and every customer decision are ownership scoped.
        $this->withToken($intruderToken)
            ->getJson("/api/v1/customer/quotation-requests/{$request->id}")
            ->assertNotFound();

        foreach (['accept', 'reject', 'request-change'] as $action) {
            $this->withToken($intruderToken)
                ->postJson("/api/v1/customer/quotations/{$quotation->id}/{$action}", [
                    'customer_note' => 'Hijack attempt.',
                ])
                ->assertNotFound();
        }

        $this->withToken($intruderToken)
            ->getJson("/api/v1/customer/orders/{$order->id}")
            ->assertNotFound();

        $this->withToken($intruderToken)
            ->getJson("/api/v1/customer/orders/{$order->id}/receipt/download")
            ->assertNotFound();

        $this->withToken($intruderToken)
            ->patchJson("/api/v1/notifications/{$notification->id}/read")
            ->assertNotFound();

        // Lists never include a foreign row either.
        $this->withToken($intruderToken)
            ->getJson('/api/v1/customer/quotation-requests')
            ->assertOk()
            ->assertJsonPath('data.meta.total', 0);

        $this->withToken($intruderToken)
            ->getJson('/api/v1/customer/orders')
            ->assertOk()
            ->assertJsonPath('data.meta.total', 0);

        $this->withToken($intruderToken)
            ->getJson('/api/v1/notifications')
            ->assertOk()
            ->assertJsonPath('data.unread_count', 0)
            ->assertJsonCount(0, 'data.notifications');

        // Nothing was mutated by the rejected calls.
        $this->assertSame(QuotationRequestStatus::QUOTATION_SENT, $request->refresh()->status);
        $this->assertSame(OrderStatus::DELIVERED, $order->refresh()->order_status);
        $this->assertFalse($notification->refresh()->is_read);
        $this->assertSame($owner->id, $request->customer_id);
    }

    public function test_client_supplied_ids_totals_and_statuses_are_ignored_by_the_server(): void
    {
        Storage::fake('local');

        [$customer, $token] = $this->authenticateCustomer();
        $otherCustomer = Customer::factory()->create();

        $product = Product::factory()
            ->for(Supplier::factory())
            ->published()
            ->withPrice(['retail_price' => 10000, 'wholesale_price' => null, 'discount_price' => null, 'minimum_order_quantity' => 1])
            ->withStock(['stock_status' => 'IN_STOCK'])
            ->create();

        $submitted = $this->withToken($token)->postJson('/api/v1/customer/quotation-requests', [
            'customer_id' => $otherCustomer->id,
            'status' => QuotationRequestStatus::ACCEPTED->value,
            'items' => [[
                'product_id' => $product->id,
                'quantity' => 1,
                'unit_price' => 1,
                'line_total' => 1,
            ]],
            'name' => 'Aung Aung',
            'phone' => '09123456789',
            'email' => 'aung@example.com',
            'city' => 'Yangon',
            'township' => 'Hlaing',
            'delivery_address' => 'No. 123, Main Road',
        ])->assertCreated();

        $requestId = (int) $submitted->json('data.quotation_request.id');
        $request = QuotationRequest::query()->findOrFail($requestId);

        $this->assertSame($customer->id, $request->customer_id);
        $this->assertSame(QuotationRequestStatus::NEW, $request->status);
        $this->assertSame(1, $request->items()->count());

        // Admin-side version creation ignores client totals as well.
        [$admin, $adminToken] = $this->authenticateAdmin();

        $request->update(['status' => QuotationRequestStatus::PREPARING_QUOTATION->value]);

        $created = $this->withToken($adminToken)
            ->postJson("/api/v1/admin/quotation-requests/{$requestId}/quotations", [
                'items' => [[
                    'product_id' => $product->id,
                    'quantity' => 2,
                    'unit_price' => 10000,
                    'line_total' => 1,
                ]],
                'subtotal' => 1,
                'service_fee' => 1,
                'service_fee_percentage' => 5,
                'delivery_fee' => 500,
                'discount' => 0,
                'total_amount' => 1,
                'valid_until' => now()->addDays(7)->toDateString(),
            ])->assertCreated();

        $this->assertSame(20000, (int) $created->json('data.quotation.subtotal'));
        $this->assertSame(1000, (int) $created->json('data.quotation.service_fee'));
        $this->assertSame(21500, (int) $created->json('data.quotation.total_amount'));

        // The customer cannot force the order price or status on acceptance.
        $this->withToken($adminToken)
            ->postJson("/api/v1/admin/quotations/{$created->json('data.quotation.id')}/send")
            ->assertOk();

        $accepted = $this->withToken($token)
            ->postJson("/api/v1/customer/quotations/{$created->json('data.quotation.id')}/accept", [
                'total_amount' => 1,
                'order_status' => OrderStatus::COMPLETED->value,
                'payment_status' => PaymentStatus::PAYMENT_CONFIRMED->value,
            ])->assertOk();

        $orderId = (int) $accepted->json('data.order.id');
        $order = Order::query()->findOrFail($orderId);

        $this->assertSame(21500, $order->total_amount);
        $this->assertSame(OrderStatus::SUPPLIER_CONFIRMATION_REQUIRED, $order->order_status);
        $this->assertSame(PaymentStatus::NOT_PAID, $order->payment_status);
        $this->assertSame($customer->id, $order->customer_id);
        $this->assertNotNull($admin->id);
    }

    public function test_invalid_status_transitions_are_rejected_without_changing_rows(): void
    {
        [, $token] = $this->authenticateAdmin();
        [$order] = $this->orderFor(Customer::factory()->create());

        // A delivered order may only move to COMPLETED/RETURNED, never back
        // to PREPARING through the delivery endpoint.
        $this->withToken($token)
            ->postJson("/api/v1/admin/orders/{$order->id}/delivery-status", [
                'status' => OrderStatus::PREPARING->value,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['order']);

        $this->assertSame(OrderStatus::DELIVERED, $order->refresh()->order_status);

        // Payment cannot be confirmed before full cash collection.
        $payment = CashPayment::query()->where('order_id', $order->id)->firstOrFail();
        $payment->update([
            'status' => PaymentStatus::CASH_COLLECTION_PENDING->value,
            'amount_collected' => 0,
            'amount_remaining' => $payment->amount_due,
            'collected_at' => null,
        ]);

        $this->withToken($token)
            ->postJson("/api/v1/admin/orders/{$order->id}/payment-confirmation")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['payment']);

        $this->assertSame(PaymentStatus::CASH_COLLECTION_PENDING, $payment->refresh()->status);
        $this->assertSame(OrderStatus::DELIVERED, $order->refresh()->order_status);
    }

    public function test_private_files_and_receipts_are_not_reachable_without_authorization(): void
    {
        Storage::fake('local');
        Storage::disk('local')->put('receipts/secret.pdf', 'private');

        $this->getJson('/api/v1/admin/files/receipts/secret.pdf')->assertUnauthorized();

        [, $customerToken] = $this->authenticateCustomer();

        $this->withToken($customerToken)
            ->getJson('/api/v1/admin/files/receipts/secret.pdf')
            ->assertForbidden();

        [, $adminToken] = $this->authenticateAdmin();

        $this->withToken($adminToken)
            ->getJson('/api/v1/admin/files/receipts/../secret.pdf')
            ->assertNotFound();

        $this->withToken($adminToken)
            ->getJson('/api/v1/admin/files/')
            ->assertNotFound();
    }
}
