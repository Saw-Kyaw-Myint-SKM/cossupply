<?php

namespace Tests\Feature\Api\V1;

use App\Enums\OrderStatus;
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
use Tests\TestCase;

class AdminOrderWorkflowTest extends TestCase
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
     * @param  array<string, mixed>  $attributes
     * @return array{0: Order, 1: OrderItem, 2: Delivery, 3: CashPayment}
     */
    private function orderScenario(array $attributes = []): array
    {
        $supplier = Supplier::factory()->create([
            'shop_name' => 'Yangon Office Supply',
            'contact_person' => 'Ko Aung',
            'phone' => '09-111-222-333',
            'viber_phone' => '09-444-555-666',
        ]);
        $product = Product::factory()->for($supplier)->create();

        $order = Order::factory()
            ->priced(20000, 0, 500, 5)
            ->create(array_merge([
                'order_status' => OrderStatus::SUPPLIER_CONFIRMATION_REQUIRED->value,
            ], $attributes));

        $item = OrderItem::factory()
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

        $delivery = Delivery::factory()->forOrder($order)->create([
            'supplier_id' => $supplier->id,
            'delivery_fee' => 500,
        ]);

        $payment = CashPayment::factory()
            ->forOrder($order)
            ->forDelivery($delivery)
            ->create();

        OrderStatusHistory::factory()->forOrder($order)->create([
            'old_status' => null,
            'new_status' => 'SUPPLIER_CONFIRMATION_REQUIRED',
            'changed_by_type' => 'SYSTEM',
            'changed_by_id' => null,
        ]);

        return [$order, $item, $delivery, $payment];
    }

    public function test_guest_and_customer_tokens_cannot_use_admin_order_routes(): void
    {
        $this->getJson('/api/v1/admin/orders')->assertUnauthorized();
        $this->postJson('/api/v1/admin/orders/1/supplier-confirmation', ['result' => 'CONFIRMED'])
            ->assertUnauthorized();

        [$order] = $this->orderScenario();

        $customer = Customer::factory()->create();
        $customerToken = $customer->createToken('customer-token', ['customer'])->plainTextToken;

        $this->withToken($customerToken)->getJson('/api/v1/admin/orders')->assertForbidden();
        $this->withToken($customerToken)
            ->postJson("/api/v1/admin/orders/{$order->id}/supplier-confirmation", ['result' => 'CONFIRMED'])
            ->assertForbidden();
    }

    public function test_admin_can_list_and_filter_orders(): void
    {
        [, $token] = $this->authenticateAdmin();

        [$waiting] = $this->orderScenario();
        [$preparing] = $this->orderScenario([
            'order_status' => OrderStatus::PREPARING->value,
        ]);

        $this->withToken($token)
            ->getJson('/api/v1/admin/orders')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.meta.total', 2)
            ->assertJsonPath('data.orders.0.id', $preparing->id)
            ->assertJsonPath('data.orders.1.id', $waiting->id)
            ->assertJsonStructure([
                'data' => [
                    'orders' => [[
                        'id',
                        'order_number',
                        'customer_name',
                        'order_status',
                        'payment_status',
                        'delivery_status',
                        'total_amount',
                        'item_count',
                    ]],
                    'statuses',
                    'payment_statuses',
                ],
            ]);

        $this->withToken($token)
            ->getJson('/api/v1/admin/orders?status=SUPPLIER_CONFIRMATION_REQUIRED')
            ->assertOk()
            ->assertJsonPath('data.meta.total', 1)
            ->assertJsonPath('data.orders.0.id', $waiting->id);

        $this->withToken($token)
            ->getJson('/api/v1/admin/orders?search=Yangon')
            ->assertOk();

        $this->withToken($token)
            ->getJson('/api/v1/admin/orders?status=NOT_A_STATUS')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['status']);
    }

    public function test_admin_order_detail_includes_items_delivery_payment_history_and_supplier_contact(): void
    {
        [, $token] = $this->authenticateAdmin();
        [$order, $item, $delivery, $payment] = $this->orderScenario();

        $this->withToken($token)
            ->getJson("/api/v1/admin/orders/{$order->id}")
            ->assertOk()
            ->assertJsonPath('data.order.id', $order->id)
            ->assertJsonPath('data.order.order_number', $order->order_number)
            ->assertJsonPath('data.order.item_count', 1)
            ->assertJsonPath('data.order.items.0.id', $item->id)
            ->assertJsonPath('data.order.items.0.product_name_snapshot', 'Plastic Chair')
            ->assertJsonPath('data.order.delivery.id', $delivery->id)
            ->assertJsonPath('data.order.cash_payment.id', $payment->id)
            ->assertJsonPath('data.order.cash_payment.amount_due', 21500)
            ->assertJsonPath('data.order.cash_payment.amount_remaining', 21500)
            ->assertJsonPath('data.order.cash_payment.amount_collected', 0)
            ->assertJsonPath('data.order.status_histories.0.new_status', 'SUPPLIER_CONFIRMATION_REQUIRED')
            ->assertJsonPath('data.order.suppliers.0.supplier.shop_name', 'Yangon Office Supply')
            ->assertJsonPath('data.order.suppliers.0.supplier.viber_phone', '09-444-555-666');
    }

    public function test_supplier_confirmation_walks_order_confirmed_then_preparing(): void
    {
        [$admin, $token] = $this->authenticateAdmin();
        [$order] = $this->orderScenario();

        $this->withToken($token)
            ->postJson("/api/v1/admin/orders/{$order->id}/supplier-confirmation", [
                'result' => 'CONFIRMED',
                'note' => 'Supplier confirmed stock over Viber.',
            ])
            ->assertOk()
            ->assertJsonPath('data.order.order_status', 'PREPARING');

        $order->refresh();
        $this->assertSame(OrderStatus::PREPARING, $order->order_status);

        $histories = OrderStatusHistory::query()
            ->where('order_id', $order->id)
            ->orderBy('id')
            ->get();

        $this->assertCount(3, $histories);
        $this->assertSame('SUPPLIER_CONFIRMATION_REQUIRED', $histories[0]->new_status);
        $this->assertSame('SUPPLIER_CONFIRMATION_REQUIRED', $histories[1]->old_status);
        $this->assertSame('ORDER_CONFIRMED', $histories[1]->new_status);
        $this->assertSame('ORDER_CONFIRMED', $histories[2]->old_status);
        $this->assertSame('PREPARING', $histories[2]->new_status);
        $this->assertSame('ADMIN', $histories[1]->changed_by_type);
        $this->assertSame($admin->id, $histories[1]->changed_by_id);

        $this->assertDatabaseHas('audit_logs', [
            'admin_id' => $admin->id,
            'action' => 'ORDER_SUPPLIER_CONFIRMED',
            'entity_type' => 'order',
            'entity_id' => (string) $order->id,
        ]);
    }

    public function test_supplier_confirmation_cannot_run_twice(): void
    {
        [, $token] = $this->authenticateAdmin();
        [$order] = $this->orderScenario();

        $this->withToken($token)
            ->postJson("/api/v1/admin/orders/{$order->id}/supplier-confirmation", [
                'result' => 'CONFIRMED',
            ])
            ->assertOk();

        $this->withToken($token)
            ->postJson("/api/v1/admin/orders/{$order->id}/supplier-confirmation", [
                'result' => 'CONFIRMED',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['order']);

        $this->assertSame('PREPARING', $order->refresh()->order_status->value);
        $this->assertSame(
            1,
            AuditLog::query()->where('action', 'ORDER_SUPPLIER_CONFIRMED')->count(),
        );
    }

    public function test_supplier_unavailable_closes_the_order_for_supplier_confirmation(): void
    {
        [$admin, $token] = $this->authenticateAdmin();
        [$order] = $this->orderScenario();

        $this->withToken($token)
            ->postJson("/api/v1/admin/orders/{$order->id}/supplier-confirmation", [
                'result' => 'UNAVAILABLE',
                'note' => 'Supplier has no stock this month.',
            ])
            ->assertOk()
            ->assertJsonPath('data.order.order_status', 'SUPPLIER_UNAVAILABLE');

        $order->refresh();
        $this->assertSame(OrderStatus::SUPPLIER_UNAVAILABLE, $order->order_status);

        $history = OrderStatusHistory::query()
            ->where('order_id', $order->id)
            ->orderByDesc('id')
            ->firstOrFail();

        $this->assertSame('SUPPLIER_CONFIRMATION_REQUIRED', $history->old_status);
        $this->assertSame('SUPPLIER_UNAVAILABLE', $history->new_status);
        $this->assertSame('Supplier has no stock this month.', $history->note);

        $this->assertDatabaseHas('audit_logs', [
            'admin_id' => $admin->id,
            'action' => 'ORDER_SUPPLIER_UNAVAILABLE',
            'entity_id' => (string) $order->id,
        ]);
    }

    public function test_unavailable_requires_a_note(): void
    {
        [, $token] = $this->authenticateAdmin();
        [$order] = $this->orderScenario();

        $this->withToken($token)
            ->postJson("/api/v1/admin/orders/{$order->id}/supplier-confirmation", [
                'result' => 'UNAVAILABLE',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['note']);

        $this->assertSame(
            'SUPPLIER_CONFIRMATION_REQUIRED',
            $order->refresh()->order_status->value,
        );
    }

    public function test_admin_can_cancel_an_order_with_a_reason(): void
    {
        [$admin, $token] = $this->authenticateAdmin();
        [$order] = $this->orderScenario([
            'order_status' => OrderStatus::PREPARING->value,
        ]);

        $this->withToken($token)
            ->postJson("/api/v1/admin/orders/{$order->id}/cancel", [
                'note' => 'Customer requested cancellation.',
            ])
            ->assertOk()
            ->assertJsonPath('data.order.order_status', 'CANCELLED');

        $history = OrderStatusHistory::query()
            ->where('order_id', $order->id)
            ->orderByDesc('id')
            ->firstOrFail();

        $this->assertSame('PREPARING', $history->old_status);
        $this->assertSame('CANCELLED', $history->new_status);
        $this->assertSame('ADMIN', $history->changed_by_type);
        $this->assertSame($admin->id, $history->changed_by_id);

        $this->assertDatabaseHas('audit_logs', [
            'admin_id' => $admin->id,
            'action' => 'ORDER_CANCELLED',
            'entity_id' => (string) $order->id,
        ]);
    }

    public function test_terminal_or_delivered_orders_cannot_be_cancelled(): void
    {
        [, $token] = $this->authenticateAdmin();
        [$order] = $this->orderScenario([
            'order_status' => OrderStatus::DELIVERED->value,
        ]);

        $this->withToken($token)
            ->postJson("/api/v1/admin/orders/{$order->id}/cancel", [
                'note' => 'Too late to cancel.',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['order']);

        $this->assertSame('DELIVERED', $order->refresh()->order_status->value);
        $this->assertSame(0, AuditLog::query()->where('action', 'ORDER_CANCELLED')->count());
    }

    public function test_cancellation_requires_a_reason(): void
    {
        [, $token] = $this->authenticateAdmin();
        [$order] = $this->orderScenario();

        $this->withToken($token)
            ->postJson("/api/v1/admin/orders/{$order->id}/cancel", [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['note']);

        $this->assertSame(
            'SUPPLIER_CONFIRMATION_REQUIRED',
            $order->refresh()->order_status->value,
        );
    }
}
