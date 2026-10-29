<?php

namespace Tests\Feature\Api\V1;

use App\Enums\DeliveryStatus;
use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Models\Admin;
use App\Models\AuditLog;
use App\Models\CashPayment;
use App\Models\Customer;
use App\Models\Delivery;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderStatusHistory;
use App\Models\Product;
use App\Models\Supplier;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class OrderDeliveryCashWorkflowTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array{0: Admin, 1: string}
     */
    private function authenticateAdmin(): array
    {
        $admin = Admin::factory()->create();
        $token = $admin->createToken('admin-token', ['admin'])->plainTextToken;

        return [$admin, $token];
    }

    /**
     * An order with one item, delivery, COD payment and initial history.
     *
     * @return array{0: Order, 1: Delivery, 2: CashPayment}
     */
    private function orderScenario(
        OrderStatus $orderStatus = OrderStatus::PREPARING,
        DeliveryStatus $deliveryStatus = DeliveryStatus::PREPARING,
        PaymentStatus $paymentStatus = PaymentStatus::NOT_PAID,
        ?Customer $customer = null,
    ): array {
        $supplier = Supplier::factory()->create();
        $product = Product::factory()->for($supplier)->create();

        $factory = Order::factory()->priced(20000, 0, 500, 5);

        if ($customer !== null) {
            $factory = $factory->for($customer);
        }

        $order = $factory->create([
            'order_status' => $orderStatus->value,
            'delivery_status' => $deliveryStatus->value,
            'payment_status' => $paymentStatus->value,
        ]);

        OrderItem::factory()
            ->forOrder($order)
            ->create([
                'product_id' => $product->id,
                'supplier_id' => $supplier->id,
                'product_name_snapshot' => 'Plastic Chair',
                'quantity' => 2,
                'unit_price' => 10000,
                'discount' => 0,
                'line_total' => 20000,
            ]);

        $shipped = in_array($deliveryStatus, [DeliveryStatus::OUT_FOR_DELIVERY, DeliveryStatus::DELIVERED], true);
        $delivered = $deliveryStatus === DeliveryStatus::DELIVERED;

        $delivery = Delivery::factory()->forOrder($order)->create([
            'supplier_id' => $supplier->id,
            'delivery_fee' => 500,
            'delivery_status' => $deliveryStatus->value,
            'shipped_at' => $shipped ? now()->subDay() : null,
            'delivered_at' => $delivered ? now() : null,
            'received_by' => $delivered ? 'Daw Mya' : null,
        ]);

        $collected = in_array($paymentStatus, [
            PaymentStatus::CASH_COLLECTED,
            PaymentStatus::PAYMENT_CONFIRMED,
        ], true);

        $payment = CashPayment::factory()
            ->forOrder($order)
            ->forDelivery($delivery)
            ->create([
                'status' => $paymentStatus->value,
                'amount_collected' => $collected ? 21500 : 0,
                'amount_remaining' => $collected ? 0 : 21500,
                'collected_at' => $collected ? now() : null,
                'received_by' => $collected ? 'Daw Mya' : null,
            ]);

        OrderStatusHistory::factory()->forOrder($order)->create([
            'old_status' => null,
            'new_status' => $orderStatus->value,
            'changed_by_type' => 'SYSTEM',
            'changed_by_id' => null,
        ]);

        return [$order, $delivery, $payment];
    }

    public function test_guest_and_customer_tokens_cannot_use_delivery_and_cash_routes(): void
    {
        [$order] = $this->orderScenario(OrderStatus::OUT_FOR_DELIVERY, DeliveryStatus::OUT_FOR_DELIVERY, PaymentStatus::CASH_COLLECTION_PENDING);

        foreach ([
            ['post', "/api/v1/admin/orders/{$order->id}/delivery-status"],
            ['post', "/api/v1/admin/orders/{$order->id}/cash-collection"],
            ['post', "/api/v1/admin/orders/{$order->id}/payment-confirmation"],
            ['post', "/api/v1/admin/orders/{$order->id}/customer-refused-payment"],
            ['get', "/api/v1/admin/orders/{$order->id}/receipt/download"],
        ] as [$method, $url]) {
            $this->{$method.'Json'}($url)->assertUnauthorized();
        }

        $customer = Customer::factory()->create();
        $token = $customer->createToken('customer-token', ['customer'])->plainTextToken;

        $this->withToken($token)
            ->postJson("/api/v1/admin/orders/{$order->id}/delivery-status", ['status' => 'READY_TO_SHIP'])
            ->assertForbidden();
        $this->withToken($token)
            ->getJson("/api/v1/admin/orders/{$order->id}/receipt/download")
            ->assertForbidden();
    }

    public function test_supplier_confirmation_starts_delivery_preparation(): void
    {
        [, $token] = $this->authenticateAdmin();
        [$order, $delivery] = $this->orderScenario(
            OrderStatus::SUPPLIER_CONFIRMATION_REQUIRED,
            DeliveryStatus::NOT_ASSIGNED,
        );

        $this->withToken($token)
            ->postJson("/api/v1/admin/orders/{$order->id}/supplier-confirmation", [
                'result' => 'CONFIRMED',
            ])
            ->assertOk()
            ->assertJsonPath('data.order.order_status', 'PREPARING')
            ->assertJsonPath('data.order.delivery.delivery_status', 'PREPARING');

        $this->assertSame(DeliveryStatus::PREPARING, $delivery->refresh()->delivery_status);
        $this->assertSame(DeliveryStatus::PREPARING, $order->refresh()->delivery_status);
    }

    public function test_admin_can_walk_full_delivery_collect_cash_and_complete_order(): void
    {
        Storage::fake('local');

        [$admin, $token] = $this->authenticateAdmin();
        [$order, $delivery, $payment] = $this->orderScenario();

        $this->withToken($token)
            ->postJson("/api/v1/admin/orders/{$order->id}/delivery-status", [
                'status' => 'READY_TO_SHIP',
            ])
            ->assertOk()
            ->assertJsonPath('data.order.order_status', 'READY_TO_SHIP')
            ->assertJsonPath('data.order.delivery.delivery_status', 'PREPARING');

        $this->withToken($token)
            ->postJson("/api/v1/admin/orders/{$order->id}/delivery-status", [
                'status' => 'OUT_FOR_DELIVERY',
                'delivery_partner' => 'Royal Express',
                'tracking_number' => 'TRK-9012',
            ])
            ->assertOk()
            ->assertJsonPath('data.order.order_status', 'OUT_FOR_DELIVERY')
            ->assertJsonPath('data.order.delivery.delivery_status', 'OUT_FOR_DELIVERY')
            ->assertJsonPath('data.order.payment_status', 'CASH_COLLECTION_PENDING')
            ->assertJsonPath('data.order.delivery.delivery_partner', 'Royal Express')
            ->assertJsonPath('data.order.delivery.tracking_number', 'TRK-9012');

        $this->assertNotNull($delivery->refresh()->shipped_at);
        $this->assertSame(PaymentStatus::CASH_COLLECTION_PENDING, $payment->refresh()->status);

        $this->withToken($token)
            ->postJson("/api/v1/admin/orders/{$order->id}/delivery-status", [
                'status' => 'DELIVERED',
                'received_by' => 'Daw Mya',
            ])
            ->assertOk()
            ->assertJsonPath('data.order.order_status', 'DELIVERED')
            ->assertJsonPath('data.order.delivery.delivery_status', 'DELIVERED')
            ->assertJsonPath('data.order.delivery.received_by', 'Daw Mya');

        $this->assertNotNull($delivery->refresh()->delivered_at);

        $this->withToken($token)
            ->postJson("/api/v1/admin/orders/{$order->id}/cash-collection", [
                'amount_collected' => 21500,
                'received_by' => 'Daw Mya',
            ])
            ->assertOk()
            ->assertJsonPath('data.order.order_status', 'DELIVERED')
            ->assertJsonPath('data.order.cash_payment.status', 'CASH_COLLECTED')
            ->assertJsonPath('data.order.cash_payment.amount_collected', 21500)
            ->assertJsonPath('data.order.cash_payment.amount_remaining', 0)
            ->assertJsonPath('data.order.cash_payment.receipt_available', true)
            ->assertJsonMissingPath('data.order.cash_payment.receipt_file_path');

        $payment->refresh();
        $this->assertSame(PaymentStatus::CASH_COLLECTED, $payment->status);
        $this->assertSame(0, $payment->amount_remaining);
        $this->assertNotNull($payment->receipt_file_path);
        Storage::disk('local')->assertExists($payment->receipt_file_path);

        $download = $this->withToken($token)
            ->get("/api/v1/admin/orders/{$order->id}/receipt/download");

        $download->assertOk();
        $download->assertHeader('content-type', 'application/pdf');
        $this->assertStringStartsWith('%PDF', $download->streamedContent());

        $this->withToken($token)
            ->postJson("/api/v1/admin/orders/{$order->id}/payment-confirmation", [
                'note' => 'Cash counted and verified against the receipt.',
            ])
            ->assertOk()
            ->assertJsonPath('data.order.order_status', 'COMPLETED')
            ->assertJsonPath('data.order.cash_payment.status', 'PAYMENT_CONFIRMED');

        $history = OrderStatusHistory::query()
            ->where('order_id', $order->id)
            ->orderByDesc('id')
            ->firstOrFail();

        $this->assertSame('DELIVERED', $history->old_status);
        $this->assertSame('COMPLETED', $history->new_status);
        $this->assertSame('ADMIN', $history->changed_by_type);
        $this->assertSame($admin->id, $history->changed_by_id);

        $this->assertSame(
            ['PREPARING', 'READY_TO_SHIP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED'],
            OrderStatusHistory::query()
                ->where('order_id', $order->id)
                ->orderBy('id')
                ->pluck('new_status')
                ->all(),
        );

        $this->assertDatabaseHas('audit_logs', [
            'admin_id' => $admin->id,
            'action' => 'CASH_COLLECTED',
            'entity_id' => (string) $order->id,
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'admin_id' => $admin->id,
            'action' => 'CASH_PAYMENT_CONFIRMED',
            'entity_id' => (string) $order->id,
        ]);
    }

    public function test_partial_payment_is_rejected_and_payment_stays_pending(): void
    {
        [$admin, $token] = $this->authenticateAdmin();
        [$order, , $payment] = $this->orderScenario(
            OrderStatus::DELIVERED,
            DeliveryStatus::DELIVERED,
            PaymentStatus::CASH_COLLECTION_PENDING,
        );

        $this->withToken($token)
            ->postJson("/api/v1/admin/orders/{$order->id}/cash-collection", [
                'amount_collected' => 10000,
                'received_by' => 'Daw Mya',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['amount_collected']);

        $payment->refresh();
        $this->assertSame(PaymentStatus::CASH_COLLECTION_PENDING, $payment->status);
        $this->assertSame(0, $payment->amount_collected);
        $this->assertSame(21500, $payment->amount_remaining);
        $this->assertSame(
            0,
            AuditLog::query()->where('action', 'CASH_COLLECTED')->count(),
        );
    }

    public function test_cash_cannot_be_collected_before_full_delivery(): void
    {
        [, $token] = $this->authenticateAdmin();
        [$order, , $payment] = $this->orderScenario(
            OrderStatus::OUT_FOR_DELIVERY,
            DeliveryStatus::OUT_FOR_DELIVERY,
            PaymentStatus::CASH_COLLECTION_PENDING,
        );

        $this->withToken($token)
            ->postJson("/api/v1/admin/orders/{$order->id}/cash-collection", [
                'amount_collected' => 21500,
                'received_by' => 'Daw Mya',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['order']);

        $this->assertSame(PaymentStatus::CASH_COLLECTION_PENDING, $payment->refresh()->status);
    }

    public function test_cash_collection_requires_a_receipt_number(): void
    {
        [, $token] = $this->authenticateAdmin();
        [$order, , $payment] = $this->orderScenario(
            OrderStatus::DELIVERED,
            DeliveryStatus::DELIVERED,
            PaymentStatus::CASH_COLLECTION_PENDING,
        );

        $payment->update(['receipt_number' => '']);

        $this->withToken($token)
            ->postJson("/api/v1/admin/orders/{$order->id}/cash-collection", [
                'amount_collected' => 21500,
                'received_by' => 'Daw Mya',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['receipt_number']);

        $this->assertSame(PaymentStatus::CASH_COLLECTION_PENDING, $payment->refresh()->status);
    }

    public function test_payment_confirmation_requires_collected_cash(): void
    {
        [, $token] = $this->authenticateAdmin();
        [$order] = $this->orderScenario(
            OrderStatus::DELIVERED,
            DeliveryStatus::DELIVERED,
            PaymentStatus::CASH_COLLECTION_PENDING,
        );

        $this->withToken($token)
            ->postJson("/api/v1/admin/orders/{$order->id}/payment-confirmation")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['payment']);

        $this->assertSame('DELIVERED', $order->refresh()->order_status->value);
    }

    public function test_delivery_failure_keeps_payment_pending_and_allows_redelivery(): void
    {
        [$admin, $token] = $this->authenticateAdmin();
        [$order, $delivery, $payment] = $this->orderScenario(
            OrderStatus::OUT_FOR_DELIVERY,
            DeliveryStatus::OUT_FOR_DELIVERY,
            PaymentStatus::CASH_COLLECTION_PENDING,
        );

        $this->withToken($token)
            ->postJson("/api/v1/admin/orders/{$order->id}/delivery-status", [
                'status' => 'DELIVERY_FAILED',
                'note' => 'Customer was not at home.',
            ])
            ->assertOk()
            ->assertJsonPath('data.order.order_status', 'DELIVERY_FAILED')
            ->assertJsonPath('data.order.delivery.delivery_status', 'DELIVERY_FAILED')
            ->assertJsonPath('data.order.payment_status', 'CASH_COLLECTION_PENDING');

        $this->assertSame(DeliveryStatus::DELIVERY_FAILED, $delivery->refresh()->delivery_status);
        $this->assertSame(PaymentStatus::CASH_COLLECTION_PENDING, $payment->refresh()->status);

        $this->withToken($token)
            ->postJson("/api/v1/admin/orders/{$order->id}/delivery-status", [
                'status' => 'READY_TO_SHIP',
                'note' => 'Re-delivery scheduled for tomorrow.',
            ])
            ->assertOk()
            ->assertJsonPath('data.order.order_status', 'READY_TO_SHIP')
            ->assertJsonPath('data.order.delivery.delivery_status', 'PREPARING');

        $this->withToken($token)
            ->postJson("/api/v1/admin/orders/{$order->id}/delivery-status", [
                'status' => 'OUT_FOR_DELIVERY',
            ])
            ->assertOk()
            ->assertJsonPath('data.order.order_status', 'OUT_FOR_DELIVERY');

        $this->assertSame(DeliveryStatus::OUT_FOR_DELIVERY, $delivery->refresh()->delivery_status);
        $this->assertSame($admin->id, AuditLog::query()->where('action', 'ORDER_DELIVERY_UPDATED')->firstOrFail()->admin_id);
    }

    public function test_return_marks_uncollected_payment_as_failed(): void
    {
        [, $token] = $this->authenticateAdmin();
        [$order, $delivery, $payment] = $this->orderScenario(
            OrderStatus::OUT_FOR_DELIVERY,
            DeliveryStatus::OUT_FOR_DELIVERY,
            PaymentStatus::CASH_COLLECTION_PENDING,
        );

        $this->withToken($token)
            ->postJson("/api/v1/admin/orders/{$order->id}/delivery-status", [
                'status' => 'RETURNED',
                'note' => 'Customer rejected the goods at the door.',
            ])
            ->assertOk()
            ->assertJsonPath('data.order.order_status', 'RETURNED')
            ->assertJsonPath('data.order.delivery.delivery_status', 'RETURNED')
            ->assertJsonPath('data.order.payment_status', 'PAYMENT_FAILED');

        $this->assertSame(DeliveryStatus::RETURNED, $delivery->refresh()->delivery_status);
        $this->assertSame(PaymentStatus::PAYMENT_FAILED, $payment->refresh()->status);
    }

    public function test_customer_refusal_records_payment_delivery_and_responsible_person(): void
    {
        [$admin, $token] = $this->authenticateAdmin();
        [$order, $delivery, $payment] = $this->orderScenario(
            OrderStatus::OUT_FOR_DELIVERY,
            DeliveryStatus::OUT_FOR_DELIVERY,
            PaymentStatus::CASH_COLLECTION_PENDING,
        );

        $this->withToken($token)
            ->postJson("/api/v1/admin/orders/{$order->id}/customer-refused-payment", [
                'delivery_outcome' => 'DELIVERY_FAILED',
                'responsible_person' => 'Ko Aung',
                'note' => 'Customer refused to pay the full COD amount.',
            ])
            ->assertOk()
            ->assertJsonPath('data.order.order_status', 'DELIVERY_FAILED')
            ->assertJsonPath('data.order.delivery.delivery_status', 'DELIVERY_FAILED')
            ->assertJsonPath('data.order.payment_status', 'CUSTOMER_REFUSED_TO_PAY');

        $this->assertSame(PaymentStatus::CUSTOMER_REFUSED_TO_PAY, $payment->refresh()->status);
        $this->assertSame(DeliveryStatus::DELIVERY_FAILED, $delivery->refresh()->delivery_status);
        $this->assertStringContainsString('Ko Aung', (string) $payment->note);

        $history = OrderStatusHistory::query()
            ->where('order_id', $order->id)
            ->orderByDesc('id')
            ->firstOrFail();

        $this->assertSame('OUT_FOR_DELIVERY', $history->old_status);
        $this->assertSame('DELIVERY_FAILED', $history->new_status);
        $this->assertStringContainsString('Customer refused to pay', (string) $history->note);
        $this->assertStringContainsString('Ko Aung', (string) $history->note);

        $this->assertDatabaseHas('audit_logs', [
            'admin_id' => $admin->id,
            'action' => 'CUSTOMER_REFUSED_PAYMENT',
            'entity_id' => (string) $order->id,
        ]);
    }

    public function test_receipt_is_not_available_before_cash_is_collected(): void
    {
        [, $token] = $this->authenticateAdmin();
        [$order] = $this->orderScenario(
            OrderStatus::DELIVERED,
            DeliveryStatus::DELIVERED,
            PaymentStatus::CASH_COLLECTION_PENDING,
        );

        $this->withToken($token)
            ->getJson("/api/v1/admin/orders/{$order->id}/receipt/download")
            ->assertNotFound();
    }

    public function test_customer_can_only_download_their_own_receipt(): void
    {
        Storage::fake('local');

        [, $adminToken] = $this->authenticateAdmin();
        $owner = Customer::factory()->create();
        $ownerToken = $owner->createToken('customer-token', ['customer'])->plainTextToken;
        $stranger = Customer::factory()->create();
        $strangerToken = $stranger->createToken('customer-token', ['customer'])->plainTextToken;

        [$order] = $this->orderScenario(
            OrderStatus::DELIVERED,
            DeliveryStatus::DELIVERED,
            PaymentStatus::CASH_COLLECTION_PENDING,
            $owner,
        );

        $this->withToken($adminToken)
            ->postJson("/api/v1/admin/orders/{$order->id}/cash-collection", [
                'amount_collected' => 21500,
                'received_by' => 'Daw Mya',
            ])
            ->assertOk();

        $ownerDownload = $this->withToken($ownerToken)
            ->get("/api/v1/customer/orders/{$order->id}/receipt/download");

        $ownerDownload->assertOk();
        $ownerDownload->assertHeader('content-type', 'application/pdf');
        $this->assertStringStartsWith('%PDF', $ownerDownload->streamedContent());

        $this->withToken($strangerToken)
            ->getJson("/api/v1/customer/orders/{$order->id}/receipt/download")
            ->assertNotFound();

        $this->withToken($adminToken)
            ->get("/api/v1/admin/orders/{$order->id}/receipt/download")
            ->assertOk();
    }

    public function test_delivery_status_requires_a_supported_target(): void
    {
        [, $token] = $this->authenticateAdmin();
        [$order] = $this->orderScenario();

        $this->withToken($token)
            ->postJson("/api/v1/admin/orders/{$order->id}/delivery-status", [
                'status' => 'COMPLETED',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['status']);
    }
}
