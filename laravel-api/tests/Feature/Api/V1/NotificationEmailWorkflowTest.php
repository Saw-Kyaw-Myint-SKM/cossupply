<?php

namespace Tests\Feature\Api\V1;

use App\Enums\DeliveryStatus;
use App\Enums\EmailType;
use App\Enums\NotificationType;
use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Enums\QuotationRequestStatus;
use App\Models\Admin;
use App\Models\AuditLog;
use App\Models\CashPayment;
use App\Models\Customer;
use App\Models\Delivery;
use App\Models\EmailLog;
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
 * Task 11: in-app notifications, synchronous email delivery, email logs and
 * resend actions, and the 60-second polling API contract.
 */
class NotificationEmailWorkflowTest extends TestCase
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
     * A request with one sent current version and a matching line item.
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
            ->priced(20000, 1000, 500, 5)
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
     * An order with delivery and COD payment records.
     *
     * @return array{0: Order, 1: Delivery, 2: CashPayment, 3: Customer}
     */
    private function orderScenario(
        OrderStatus $orderStatus,
        DeliveryStatus $deliveryStatus,
        PaymentStatus $paymentStatus,
        ?string $email = 'buyer@example.com',
    ): array {
        $customer = Customer::factory()->create();
        $request = QuotationRequest::factory()->create([
            'customer_id' => $customer->id,
            'email' => $email,
            'customer_name' => 'Daw Hla',
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
                'customer_name' => 'Daw Hla',
                'email' => $email,
                'order_status' => $orderStatus->value,
                'delivery_status' => $deliveryStatus->value,
                'payment_status' => $paymentStatus->value,
            ]);

        $delivered = $deliveryStatus === DeliveryStatus::DELIVERED;

        $delivery = Delivery::factory()->forOrder($order)->create([
            'delivery_contact_name' => 'Daw Hla',
            'delivery_status' => $deliveryStatus->value,
            'shipped_at' => in_array($deliveryStatus, [DeliveryStatus::OUT_FOR_DELIVERY, DeliveryStatus::DELIVERED], true)
                ? now()->subDay()
                : null,
            'delivered_at' => $delivered ? now() : null,
            'received_by' => $delivered ? 'Daw Hla' : null,
        ]);

        $collected = in_array($paymentStatus, [PaymentStatus::CASH_COLLECTED, PaymentStatus::PAYMENT_CONFIRMED], true);

        $payment = CashPayment::factory()
            ->forOrder($order)
            ->forDelivery($delivery)
            ->create([
                'status' => $paymentStatus->value,
                'amount_collected' => $collected ? 21500 : 0,
                'amount_remaining' => $collected ? 0 : 21500,
                'collected_at' => $collected ? now() : null,
                'received_by' => $collected ? 'Daw Hla' : null,
            ]);

        return [$order->refresh(), $delivery, $payment, $customer];
    }

    private function customerNotificationCount(Customer $customer, NotificationType $type): int
    {
        return InAppNotification::query()
            ->where('recipient_type', 'CUSTOMER')
            ->where('recipient_id', $customer->id)
            ->where('type', $type->value)
            ->count();
    }

    private function adminNotificationCount(Admin $admin, NotificationType $type): int
    {
        return InAppNotification::query()
            ->where('recipient_type', 'ADMIN')
            ->where('recipient_id', $admin->id)
            ->where('type', $type->value)
            ->count();
    }

    public function test_notification_list_and_mark_read_are_scoped_to_the_authenticated_recipient(): void
    {
        [$customer, $token] = $this->authenticateCustomer();
        $otherCustomer = Customer::factory()->create();

        $mine = InAppNotification::factory()->forCustomer($customer)->create();
        $alsoMine = InAppNotification::factory()->forCustomer($customer)->read()->create();
        $foreign = InAppNotification::factory()->forCustomer($otherCustomer)->create();
        $adminNotification = InAppNotification::factory()->forAdmin(Admin::factory()->create())->create();

        $this->withToken($token)
            ->getJson('/api/v1/notifications')
            ->assertOk()
            ->assertJsonPath('data.unread_count', 1)
            ->assertJsonCount(2, 'data.notifications')
            ->assertJsonFragment(['id' => $mine->id])
            ->assertJsonMissing(['id' => $foreign->id])
            ->assertJsonMissing(['id' => $adminNotification->id]);

        $this->withToken($token)
            ->getJson('/api/v1/notifications/unread-count')
            ->assertOk()
            ->assertJsonPath('data.unread_count', 1);

        $this->withToken($token)
            ->patchJson("/api/v1/notifications/{$mine->id}/read")
            ->assertOk()
            ->assertJsonPath('data.notification.is_read', true)
            ->assertJsonPath('data.unread_count', 0);

        $this->assertNotNull($mine->refresh()->read_at);

        $this->withToken($token)
            ->patchJson("/api/v1/notifications/{$foreign->id}/read")
            ->assertNotFound();

        $this->assertFalse($foreign->refresh()->is_read);

        InAppNotification::factory()->forCustomer($customer)->create();

        $this->withToken($token)
            ->postJson('/api/v1/notifications/read-all')
            ->assertOk()
            ->assertJsonPath('data.marked', 1)
            ->assertJsonPath('data.unread_count', 0);

        $this->assertSame(0, InAppNotification::query()
            ->where('recipient_type', 'CUSTOMER')
            ->where('recipient_id', $customer->id)
            ->where('is_read', false)
            ->count());
        $this->assertFalse($foreign->refresh()->is_read);
        $this->assertFalse($adminNotification->refresh()->is_read);
    }

    public function test_admin_notification_endpoint_uses_the_admin_recipient_only(): void
    {
        [$admin, $token] = $this->authenticateAdmin();

        InAppNotification::factory()->forAdmin($admin)->create();
        InAppNotification::factory()->forCustomer(Customer::factory()->create())->create();

        $this->withToken($token)
            ->getJson('/api/v1/notifications')
            ->assertOk()
            ->assertJsonPath('data.unread_count', 1)
            ->assertJsonCount(1, 'data.notifications');

        $this->flushHeaders();
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/v1/notifications')->assertUnauthorized();
    }

    public function test_submitting_a_quotation_request_notifies_the_customer_and_active_admins(): void
    {
        [$customer, $token] = $this->authenticateCustomer();
        [$admin] = $this->authenticateAdmin();
        Admin::factory()->inactive()->create();

        $product = Product::factory()
            ->for(Supplier::factory())
            ->published()
            ->withPrice(['retail_price' => 10000, 'wholesale_price' => null, 'discount_price' => null, 'minimum_order_quantity' => 1])
            ->withStock(['stock_status' => 'IN_STOCK'])
            ->create();

        $response = $this->withToken($token)->postJson('/api/v1/customer/quotation-requests', [
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'name' => 'Aung Aung',
            'phone' => '09123456789',
            'email' => 'aung@example.com',
            'city' => 'Yangon',
            'township' => 'Hlaing',
            'delivery_address' => 'No. 123, Main Road',
        ])->assertCreated();

        $requestId = $response->json('data.quotation_request.id');
        $this->assertNotNull($requestId);

        $this->assertDatabaseHas('notifications', [
            'recipient_type' => 'CUSTOMER',
            'recipient_id' => $customer->id,
            'customer_id' => $customer->id,
            'type' => NotificationType::QUOTATION_REQUEST_RECEIVED->value,
        ]);

        $this->assertDatabaseHas('notifications', [
            'recipient_type' => 'ADMIN',
            'recipient_id' => $admin->id,
            'admin_id' => $admin->id,
            'type' => NotificationType::ADMIN_NEW_QUOTATION_REQUEST->value,
        ]);

        $this->assertSame(1, $this->adminNotificationCount(
            $admin,
            NotificationType::ADMIN_NEW_QUOTATION_REQUEST,
        ));
    }

    public function test_sending_a_quotation_creates_an_app_notification_and_a_sent_email_log(): void
    {
        [$admin, $token] = $this->authenticateAdmin();
        $customer = Customer::factory()->create();
        $request = QuotationRequest::factory()->create([
            'customer_id' => $customer->id,
            'status' => QuotationRequestStatus::PREPARING_QUOTATION->value,
            'email' => 'buyer@example.com',
        ]);

        $quotation = Quotation::factory()
            ->priced(20000, 0, 500, 5)
            ->create([
                'quotation_request_id' => $request->id,
                'quotation_number' => $request->quotation_number,
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

        $this->withToken($token)
            ->postJson("/api/v1/admin/quotations/{$quotation->id}/send")
            ->assertOk()
            ->assertJsonPath('data.email.status', 'SENT');

        $this->assertSame(1, $this->customerNotificationCount(
            $customer,
            NotificationType::QUOTATION_SENT,
        ));

        $this->assertDatabaseHas('email_logs', [
            'related_type' => Quotation::class,
            'related_id' => $quotation->id,
            'email_type' => EmailType::QUOTATION_SENT->value,
            'status' => 'SENT',
            'recipient_email' => 'buyer@example.com',
        ]);
    }

    public function test_accepting_a_quotation_notifies_the_customer_and_admins(): void
    {
        [$customer, $token] = $this->authenticateCustomer();
        [$admin] = $this->authenticateAdmin();
        [, $quotation] = $this->sentQuotation($customer);

        $this->withToken($token)
            ->postJson("/api/v1/customer/quotations/{$quotation->id}/accept")
            ->assertOk()
            ->assertJsonPath('data.order.order_status', 'SUPPLIER_CONFIRMATION_REQUIRED');

        $this->assertSame(1, $this->customerNotificationCount(
            $customer,
            NotificationType::QUOTATION_ACCEPTED,
        ));
        $this->assertSame(1, $this->adminNotificationCount(
            $admin,
            NotificationType::ADMIN_QUOTATION_ACCEPTED,
        ));
        $this->assertSame(1, $this->adminNotificationCount(
            $admin,
            NotificationType::ADMIN_SUPPLIER_CONFIRMATION_REQUIRED,
        ));
    }

    public function test_rejecting_a_quotation_notifies_both_sides(): void
    {
        [$customer, $token] = $this->authenticateCustomer();
        [$admin] = $this->authenticateAdmin();
        [, $quotation] = $this->sentQuotation($customer);

        $this->withToken($token)
            ->postJson("/api/v1/customer/quotations/{$quotation->id}/reject", [
                'customer_note' => 'Price is too high.',
            ])
            ->assertOk();

        $this->assertSame(1, $this->customerNotificationCount(
            $customer,
            NotificationType::QUOTATION_REJECTED,
        ));
        $this->assertSame(1, $this->adminNotificationCount(
            $admin,
            NotificationType::ADMIN_QUOTATION_REJECTED,
        ));
    }

    public function test_change_request_notifies_both_sides_with_the_note(): void
    {
        [$customer, $token] = $this->authenticateCustomer();
        [$admin] = $this->authenticateAdmin();
        [, $quotation] = $this->sentQuotation($customer);

        $this->withToken($token)
            ->postJson("/api/v1/customer/quotations/{$quotation->id}/request-change", [
                'customer_note' => 'Please deliver one day later.',
            ])
            ->assertOk();

        $this->assertSame(1, $this->customerNotificationCount(
            $customer,
            NotificationType::QUOTATION_CHANGE_REQUESTED,
        ));

        $notification = InAppNotification::query()
            ->where('recipient_type', 'ADMIN')
            ->where('recipient_id', $admin->id)
            ->where('type', NotificationType::ADMIN_QUOTATION_CHANGE_REQUESTED->value)
            ->first();

        $this->assertNotNull($notification);
        $this->assertStringContainsString('Please deliver one day later.', $notification->message);
    }

    public function test_supplier_confirmation_notifies_the_customer_and_logs_the_email(): void
    {
        [$admin, $token] = $this->authenticateAdmin();
        [$order, , , $customer] = $this->orderScenario(
            OrderStatus::SUPPLIER_CONFIRMATION_REQUIRED,
            DeliveryStatus::NOT_ASSIGNED,
            PaymentStatus::NOT_PAID,
        );

        $this->withToken($token)
            ->postJson("/api/v1/admin/orders/{$order->id}/supplier-confirmation", [
                'result' => 'CONFIRMED',
            ])
            ->assertOk()
            ->assertJsonPath('data.order.order_status', 'PREPARING');

        $this->assertSame(1, $this->customerNotificationCount(
            $customer,
            NotificationType::ORDER_CONFIRMED,
        ));

        $this->assertDatabaseHas('email_logs', [
            'related_type' => Order::class,
            'related_id' => $order->id,
            'email_type' => EmailType::ORDER_CONFIRMED->value,
            'status' => 'SENT',
            'recipient_email' => 'buyer@example.com',
        ]);

        AuditLog::query()->where('action', 'ORDER_SUPPLIER_CONFIRMED')->firstOrFail();
    }

    public function test_out_for_delivery_and_delivered_create_customer_notifications_and_email(): void
    {
        [, $token] = $this->authenticateAdmin();
        [$order, , , $customer] = $this->orderScenario(
            OrderStatus::PREPARING,
            DeliveryStatus::PREPARING,
            PaymentStatus::NOT_PAID,
        );

        $this->withToken($token)->postJson("/api/v1/admin/orders/{$order->id}/delivery-status", [
            'status' => 'READY_TO_SHIP',
        ])->assertOk();

        $this->withToken($token)->postJson("/api/v1/admin/orders/{$order->id}/delivery-status", [
            'status' => 'OUT_FOR_DELIVERY',
            'delivery_partner' => 'Royal Express',
        ])->assertOk();

        $this->assertSame(1, $this->customerNotificationCount(
            $customer,
            NotificationType::ORDER_OUT_FOR_DELIVERY,
        ));

        $this->assertDatabaseHas('email_logs', [
            'related_type' => Order::class,
            'related_id' => $order->id,
            'email_type' => EmailType::ORDER_OUT_FOR_DELIVERY->value,
            'status' => 'SENT',
        ]);

        $this->withToken($token)->postJson("/api/v1/admin/orders/{$order->id}/delivery-status", [
            'status' => 'DELIVERED',
            'received_by' => 'Daw Hla',
        ])->assertOk();

        $this->assertSame(1, $this->customerNotificationCount(
            $customer,
            NotificationType::ORDER_DELIVERED,
        ));
    }

    public function test_payment_confirmation_notifies_the_customer_and_logs_the_email(): void
    {
        Storage::fake('local');

        [, $token] = $this->authenticateAdmin();
        [$order, , , $customer] = $this->orderScenario(
            OrderStatus::DELIVERED,
            DeliveryStatus::DELIVERED,
            PaymentStatus::CASH_COLLECTED,
        );

        $this->withToken($token)
            ->postJson("/api/v1/admin/orders/{$order->id}/payment-confirmation")
            ->assertOk()
            ->assertJsonPath('data.order.order_status', 'COMPLETED');

        $this->assertSame(1, $this->customerNotificationCount(
            $customer,
            NotificationType::PAYMENT_CONFIRMED,
        ));

        $this->assertDatabaseHas('email_logs', [
            'related_type' => Order::class,
            'related_id' => $order->id,
            'email_type' => EmailType::PAYMENT_CONFIRMED->value,
            'status' => 'SENT',
        ]);
    }

    public function test_cash_collection_notifies_active_admins(): void
    {
        Storage::fake('local');

        [$admin, $token] = $this->authenticateAdmin();
        [$order] = $this->orderScenario(
            OrderStatus::DELIVERED,
            DeliveryStatus::DELIVERED,
            PaymentStatus::CASH_COLLECTION_PENDING,
        );

        $this->withToken($token)
            ->postJson("/api/v1/admin/orders/{$order->id}/cash-collection", [
                'amount_collected' => 21500,
                'received_by' => 'Daw Hla',
            ])
            ->assertOk();

        $this->assertSame(1, $this->adminNotificationCount(
            $admin,
            NotificationType::ADMIN_CASH_COLLECTION_RECORDED,
        ));
        $this->assertDatabaseHas('notifications', [
            'type' => NotificationType::ADMIN_CASH_COLLECTION_RECORDED->value,
            'order_id' => $order->id,
        ]);
    }

    public function test_cancellation_notifies_the_customer_and_logs_the_email(): void
    {
        [, $token] = $this->authenticateAdmin();
        [$order, , , $customer] = $this->orderScenario(
            OrderStatus::PREPARING,
            DeliveryStatus::PREPARING,
            PaymentStatus::NOT_PAID,
        );

        $this->withToken($token)
            ->postJson("/api/v1/admin/orders/{$order->id}/cancel", [
                'note' => 'Supplier cannot fulfil the order.',
            ])
            ->assertOk()
            ->assertJsonPath('data.order.order_status', 'CANCELLED');

        $this->assertSame(1, $this->customerNotificationCount(
            $customer,
            NotificationType::ORDER_CANCELLED,
        ));

        $this->assertDatabaseHas('email_logs', [
            'related_type' => Order::class,
            'related_id' => $order->id,
            'email_type' => EmailType::ORDER_CANCELLED->value,
            'status' => 'SENT',
        ]);
    }

    public function test_email_failure_is_logged_without_rolling_back_the_order_status(): void
    {
        [, $token] = $this->authenticateAdmin();
        [$order] = $this->orderScenario(
            OrderStatus::SUPPLIER_CONFIRMATION_REQUIRED,
            DeliveryStatus::NOT_ASSIGNED,
            PaymentStatus::NOT_PAID,
            email: null,
        );

        $this->withToken($token)
            ->postJson("/api/v1/admin/orders/{$order->id}/supplier-confirmation", [
                'result' => 'CONFIRMED',
            ])
            ->assertOk()
            ->assertJsonPath('data.order.order_status', 'PREPARING');

        $this->assertSame(OrderStatus::PREPARING, $order->refresh()->order_status);

        $this->assertDatabaseHas('email_logs', [
            'related_type' => Order::class,
            'related_id' => $order->id,
            'email_type' => EmailType::ORDER_CONFIRMED->value,
            'status' => 'FAILED',
        ]);

        $this->assertDatabaseHas('notifications', [
            'recipient_type' => 'CUSTOMER',
            'recipient_id' => $order->customer_id,
            'type' => NotificationType::ORDER_CONFIRMED->value,
        ]);
    }

    public function test_admin_can_list_email_delivery_errors_and_resend_an_eligible_email(): void
    {
        [$admin, $token] = $this->authenticateAdmin();
        [$order] = $this->orderScenario(
            OrderStatus::PREPARING,
            DeliveryStatus::PREPARING,
            PaymentStatus::NOT_PAID,
        );

        $failed = EmailLog::factory()->failed()->create([
            'related_type' => Order::class,
            'related_id' => $order->id,
            'email_type' => EmailType::ORDER_CONFIRMED->value,
            'recipient_email' => 'old@example.com',
            'error_message' => 'Connection refused',
        ]);

        $this->withToken($token)
            ->getJson('/api/v1/admin/email-logs?status=FAILED')
            ->assertOk()
            ->assertJsonPath('data.meta.total', 1)
            ->assertJsonPath('data.email_logs.0.id', $failed->id)
            ->assertJsonPath('data.email_logs.0.error_message', 'Connection refused')
            ->assertJsonPath('data.email_logs.0.resendable', true);

        $this->withToken($token)
            ->postJson("/api/v1/admin/email-logs/{$failed->id}/resend")
            ->assertOk()
            ->assertJsonPath('data.email.status', 'SENT')
            ->assertJsonPath('data.email.recipient_email', 'buyer@example.com');

        $this->assertDatabaseHas('email_logs', [
            'related_type' => Order::class,
            'related_id' => $order->id,
            'email_type' => EmailType::ORDER_CONFIRMED->value,
            'status' => 'SENT',
        ]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'email.resent']);

        // The original attempt keeps its failure record.
        $this->assertSame('FAILED', $failed->refresh()->status);
    }

    public function test_unsupported_email_type_cannot_be_resent(): void
    {
        [, $token] = $this->authenticateAdmin();
        [$order] = $this->orderScenario(
            OrderStatus::PREPARING,
            DeliveryStatus::PREPARING,
            PaymentStatus::NOT_PAID,
        );

        $log = EmailLog::factory()->failed()->create([
            'related_type' => Order::class,
            'related_id' => $order->id,
            'email_type' => 'LEGACY_NOTICE',
        ]);

        $this->withToken($token)
            ->postJson("/api/v1/admin/email-logs/{$log->id}/resend")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email_log']);
    }

    public function test_customers_cannot_access_admin_email_logs(): void
    {
        [, $token] = $this->authenticateCustomer();
        $log = EmailLog::factory()->failed()->create();

        $this->withToken($token)
            ->getJson('/api/v1/admin/email-logs')
            ->assertForbidden();

        $this->withToken($token)
            ->postJson("/api/v1/admin/email-logs/{$log->id}/resend")
            ->assertForbidden();
    }
}
