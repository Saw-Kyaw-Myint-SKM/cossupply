<?php

namespace Tests\Feature\Api\V1;

use App\Models\Admin;
use App\Models\AuditLog;
use App\Models\CashPayment;
use App\Models\Category;
use App\Models\Customer;
use App\Models\Delivery;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderStatusHistory;
use App\Models\Product;
use App\Models\Quotation;
use App\Models\QuotationRequest;
use App\Models\Supplier;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminOrderTest extends TestCase
{
    use RefreshDatabase;

    private function adminToken(?Admin $admin = null): string
    {
        $admin ??= Admin::factory()->create();

        return $admin->createToken('admin-token', ['admin'])->plainTextToken;
    }

    /**
     * A coherent order with one item, one delivery, one COD payment and one
     * opening status history row.
     *
     * @return array{
     *     admin: Admin,
     *     customer: Customer,
     *     supplier: Supplier,
     *     product: Product,
     *     request: QuotationRequest,
     *     quotation: Quotation,
     *     order: Order,
     *     delivery: Delivery,
     *     payment: CashPayment,
     *     history: OrderStatusHistory
     * }
     */
    private function makeOrder(
        string $orderStatus = 'SUPPLIER_CONFIRMATION_REQUIRED',
        string $customerName = 'Alice Buyer',
        string $phone = '09111111111',
        string $orderNumber = 'ORD-2026-0001',
    ): array {
        $admin = Admin::factory()->create();
        $customer = Customer::factory()->create(['name' => $customerName]);
        $supplier = Supplier::factory()->create(['shop_name' => 'Snapshot Supplier']);
        $product = Product::factory()
            ->for($supplier)
            ->for(Category::factory())
            ->published()
            ->withPrice(['retail_price' => 5000])
            ->create();

        $request = QuotationRequest::factory()
            ->for($customer)
            ->create([
                'quotation_number' => 'QT-2026-'.str_pad((string) $customer->id, 4, '0', STR_PAD_LEFT),
                'customer_name' => $customerName,
                'phone' => $phone,
                'status' => 'ACCEPTED',
            ]);

        $quotation = Quotation::factory()
            ->for($request)
            ->priced(10000)
            ->create([
                'quotation_number' => $request->quotation_number,
                'version' => 1,
                'status' => 'ACCEPTED',
                'is_current' => true,
                'accepted_at' => now(),
                'created_by_admin_id' => $admin->id,
            ]);

        $order = Order::factory()->create([
            'order_number' => $orderNumber,
            'quotation_id' => $quotation->id,
            'quotation_request_id' => $request->id,
            'customer_id' => $customer->id,
            'customer_name' => $customerName,
            'phone' => $phone,
            'subtotal' => 10000,
            'discount' => 0,
            'delivery_fee' => 0,
            'service_fee_percentage' => 0,
            'service_fee' => 0,
            'total_amount' => 10000,
            'order_status' => $orderStatus,
        ]);

        $item = OrderItem::factory()
            ->forOrder($order)
            ->forProduct($product)
            ->create([
                'quantity' => 2,
                'unit_price' => 5000,
                'discount' => 0,
                'line_total' => 10000,
            ]);

        $delivery = Delivery::factory()
            ->forOrder($order)
            ->create([
                'supplier_id' => $supplier->id,
                'delivery_contact_name' => $customerName,
                'delivery_phone' => $phone,
                'delivery_fee' => 0,
            ]);

        $payment = CashPayment::factory()
            ->forOrder($order)
            ->forDelivery($delivery)
            ->create([
                'amount_due' => 10000,
                'amount_collected' => 0,
                'amount_remaining' => 10000,
            ]);

        $history = OrderStatusHistory::factory()
            ->forOrder($order)
            ->create([
                'old_status' => null,
                'new_status' => $orderStatus,
                'changed_by_type' => 'SYSTEM',
                'changed_by_id' => null,
            ]);

        return [
            'admin' => $admin,
            'customer' => $customer,
            'supplier' => $supplier,
            'product' => $product,
            'request' => $request,
            'quotation' => $quotation,
            'order' => $order,
            'item' => $item,
            'delivery' => $delivery,
            'payment' => $payment,
            'history' => $history,
        ];
    }

    public function test_guest_and_customer_cannot_access_admin_order_routes(): void
    {
        $fixture = $this->makeOrder();
        $orderId = $fixture['order']->id;

        $this->getJson('/api/v1/admin/orders')->assertUnauthorized();
        $this->getJson("/api/v1/admin/orders/{$orderId}")->assertUnauthorized();
        $this->patchJson("/api/v1/admin/orders/{$orderId}/status", [
            'status' => 'ORDER_CONFIRMED',
        ])->assertUnauthorized();

        $customerToken = $fixture['customer']->createToken('customer-token', ['customer'])->plainTextToken;

        $this->withToken($customerToken)
            ->getJson('/api/v1/admin/orders')
            ->assertForbidden();
        $this->withToken($customerToken)
            ->getJson("/api/v1/admin/orders/{$orderId}")
            ->assertForbidden();
        $this->withToken($customerToken)
            ->patchJson("/api/v1/admin/orders/{$orderId}/status", [
                'status' => 'ORDER_CONFIRMED',
            ])
            ->assertForbidden();

        $this->withToken($this->adminToken())
            ->getJson('/api/v1/admin/orders')
            ->assertOk();
    }

    public function test_admin_list_filters_searches_and_paginates_newest_first(): void
    {
        $admin = Admin::factory()->create();
        $token = $this->adminToken($admin);

        $first = $this->makeOrder(
            orderStatus: 'SUPPLIER_CONFIRMATION_REQUIRED',
            customerName: 'Alice Buyer',
            phone: '09111111111',
            orderNumber: 'ORD-2026-0001',
        );
        $second = $this->makeOrder(
            orderStatus: 'ORDER_CONFIRMED',
            customerName: 'Bob Buyer',
            phone: '09222222222',
            orderNumber: 'ORD-2026-0002',
        );

        $this->withToken($token)
            ->getJson('/api/v1/admin/orders')
            ->assertOk()
            ->assertJsonCount(2, 'data.orders')
            ->assertJsonPath('data.orders.0.id', $second['order']->id)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'orders' => [
                        '*' => [
                            'id',
                            'order_number',
                            'quotation_number',
                            'customer_name',
                            'phone',
                            'order_status',
                            'payment_status',
                            'delivery_status',
                            'total_amount',
                            'created_at',
                        ],
                    ],
                    'meta' => ['current_page', 'per_page', 'total', 'last_page'],
                ],
            ]);

        $this->withToken($token)
            ->getJson('/api/v1/admin/orders?order_status=ORDER_CONFIRMED')
            ->assertOk()
            ->assertJsonCount(1, 'data.orders')
            ->assertJsonPath('data.orders.0.id', $second['order']->id);

        $this->withToken($token)
            ->getJson('/api/v1/admin/orders?search=Alice')
            ->assertOk()
            ->assertJsonCount(1, 'data.orders')
            ->assertJsonPath('data.orders.0.id', $first['order']->id);

        $this->withToken($token)
            ->getJson('/api/v1/admin/orders?search=09222222222')
            ->assertOk()
            ->assertJsonCount(1, 'data.orders')
            ->assertJsonPath('data.orders.0.id', $second['order']->id);

        $this->withToken($token)
            ->getJson('/api/v1/admin/orders?per_page=1')
            ->assertOk()
            ->assertJsonCount(1, 'data.orders')
            ->assertJsonPath('data.meta.per_page', 1)
            ->assertJsonPath('data.meta.total', 2)
            ->assertJsonPath('data.meta.last_page', 2);

        // An explicit empty or whitespace-only search is equivalent to no
        // filter: it must not become a LIKE '%%' clause.
        $this->withToken($token)
            ->getJson('/api/v1/admin/orders?search=')
            ->assertOk()
            ->assertJsonCount(2, 'data.orders')
            ->assertJsonPath('data.meta.total', 2);

        $this->withToken($token)
            ->getJson('/api/v1/admin/orders?search=%20')
            ->assertOk()
            ->assertJsonCount(2, 'data.orders')
            ->assertJsonPath('data.meta.total', 2);

        $this->withToken($token)
            ->getJson('/api/v1/admin/orders?order_status=NOT_A_STATUS')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['order_status']);
    }

    public function test_order_detail_returns_full_shape_and_only_task_09_available_statuses(): void
    {
        $token = $this->adminToken();
        $fixture = $this->makeOrder();

        $this->withToken($token)
            ->getJson("/api/v1/admin/orders/{$fixture['order']->id}")
            ->assertOk()
            ->assertJsonPath('data.order.order_number', 'ORD-2026-0001')
            ->assertJsonPath('data.order.quotation_number', $fixture['quotation']->quotation_number)
            ->assertJsonPath('data.order.customer_name', 'Alice Buyer')
            ->assertJsonPath('data.order.items.0.quantity', 2)
            ->assertJsonPath('data.order.items.0.supplier.shop_name', 'Snapshot Supplier')
            ->assertJsonPath('data.order.delivery.id', $fixture['delivery']->id)
            ->assertJsonPath('data.order.cash_payment.receipt_number', $fixture['payment']->receipt_number)
            ->assertJsonPath('data.order.cash_payment.amount_due', 10000)
            ->assertJsonPath('data.order.cash_payment.amount_remaining', 10000)
            ->assertJsonPath('data.order.status_histories.0.new_status', 'SUPPLIER_CONFIRMATION_REQUIRED')
            ->assertJsonPath('data.order.status_histories.0.changed_by_type', 'SYSTEM')
            ->assertJsonPath('data.order.quotation_request.id', $fixture['request']->id)
            ->assertJsonPath('data.order.quotation_request.status', 'ACCEPTED')
            ->assertJsonPath('data.order.available_statuses', [
                'ORDER_CONFIRMED',
                'SUPPLIER_UNAVAILABLE',
                'CANCELLED',
            ]);

        $confirmed = $this->makeOrder(
            orderStatus: 'ORDER_CONFIRMED',
            customerName: 'Confirmed Buyer',
            orderNumber: 'ORD-2026-0002',
        );

        $this->withToken($token)
            ->getJson("/api/v1/admin/orders/{$confirmed['order']->id}")
            ->assertOk()
            ->assertJsonPath('data.order.available_statuses', ['PREPARING', 'CANCELLED']);

        $preparing = $this->makeOrder(
            orderStatus: 'PREPARING',
            customerName: 'Preparing Buyer',
            orderNumber: 'ORD-2026-0003',
        );

        $response = $this->withToken($token)
            ->getJson("/api/v1/admin/orders/{$preparing['order']->id}")
            ->assertOk()
            ->assertJsonPath('data.order.available_statuses', ['CANCELLED']);

        $this->assertNotContains('READY_TO_SHIP', $response->json('data.order.available_statuses'));
        $this->assertNotContains('OUT_FOR_DELIVERY', $response->json('data.order.available_statuses'));
        $this->assertNotContains('COMPLETED', $response->json('data.order.available_statuses'));
    }

    public function test_valid_transitions_write_history_and_audit_rows(): void
    {
        $admin = Admin::factory()->create();
        $token = $this->adminToken($admin);
        $fixture = $this->makeOrder();
        $order = $fixture['order'];

        $this->withToken($token)
            ->patchJson("/api/v1/admin/orders/{$order->id}/status", [
                'status' => 'ORDER_CONFIRMED',
            ])
            ->assertOk()
            ->assertJsonPath('data.order.order_status', 'ORDER_CONFIRMED')
            ->assertJsonPath('message', 'Order status updated.');

        $this->withToken($token)
            ->patchJson("/api/v1/admin/orders/{$order->id}/status", [
                'status' => 'PREPARING',
            ])
            ->assertOk()
            ->assertJsonPath('data.order.order_status', 'PREPARING');

        $this->assertSame(3, OrderStatusHistory::query()->where('order_id', $order->id)->count());

        $latest = OrderStatusHistory::query()
            ->where('order_id', $order->id)
            ->orderByDesc('id')
            ->firstOrFail();

        $this->assertSame('ORDER_CONFIRMED', $latest->old_status);
        $this->assertSame('PREPARING', $latest->new_status);
        $this->assertSame('ADMIN', $latest->changed_by_type);
        $this->assertSame($admin->id, $latest->changed_by_id);

        $audit = AuditLog::query()
            ->where('action', 'order.status_updated')
            ->where('entity_type', 'order')
            ->where('entity_id', (string) $order->id)
            ->orderByDesc('id')
            ->firstOrFail();

        $this->assertSame($admin->id, $audit->admin_id);
        $this->assertSame(['status' => 'ORDER_CONFIRMED'], $audit->old_data);
        $this->assertSame(['status' => 'PREPARING', 'note' => null], $audit->new_data);

        // PREPARING -> ORDER_CONFIRMED is in the Task 09 target list but is
        // an invalid transition, so it must answer 409.
        $this->withToken($token)
            ->patchJson("/api/v1/admin/orders/{$order->id}/status", [
                'status' => 'ORDER_CONFIRMED',
            ])
            ->assertStatus(409)
            ->assertJsonPath('success', false);

        $this->assertDatabaseHas('orders', [
            'id' => $order->id,
            'order_status' => 'PREPARING',
        ]);
    }

    public function test_supplier_unavailable_and_cancellation_require_and_store_a_note(): void
    {
        $token = $this->adminToken();
        $unavailable = $this->makeOrder(
            customerName: 'Unavailable Buyer',
            orderNumber: 'ORD-2026-0010',
        );

        $this->withToken($token)
            ->patchJson("/api/v1/admin/orders/{$unavailable['order']->id}/status", [
                'status' => 'SUPPLIER_UNAVAILABLE',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['note']);

        $this->withToken($token)
            ->patchJson("/api/v1/admin/orders/{$unavailable['order']->id}/status", [
                'status' => 'SUPPLIER_UNAVAILABLE',
                'note' => 'Supplier confirmed the item is out of stock.',
            ])
            ->assertOk()
            ->assertJsonPath('data.order.order_status', 'SUPPLIER_UNAVAILABLE');

        $this->assertDatabaseHas('order_status_histories', [
            'order_id' => $unavailable['order']->id,
            'new_status' => 'SUPPLIER_UNAVAILABLE',
            'changed_by_type' => 'ADMIN',
            'note' => 'Supplier confirmed the item is out of stock.',
        ]);

        $cancelled = $this->makeOrder(
            customerName: 'Cancelled Buyer',
            orderNumber: 'ORD-2026-0011',
        );

        $this->withToken($token)
            ->patchJson("/api/v1/admin/orders/{$cancelled['order']->id}/status", [
                'status' => 'CANCELLED',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['note']);

        $this->withToken($token)
            ->patchJson("/api/v1/admin/orders/{$cancelled['order']->id}/status", [
                'status' => 'CANCELLED',
                'note' => 'Customer approved the cancellation.',
            ])
            ->assertOk()
            ->assertJsonPath('data.order.order_status', 'CANCELLED');

        $this->assertDatabaseHas('order_status_histories', [
            'order_id' => $cancelled['order']->id,
            'new_status' => 'CANCELLED',
            'changed_by_type' => 'ADMIN',
            'note' => 'Customer approved the cancellation.',
        ]);
    }

    public function test_delivery_and_payment_targets_are_rejected_with_422(): void
    {
        $token = $this->adminToken();
        $fixture = $this->makeOrder();
        $url = "/api/v1/admin/orders/{$fixture['order']->id}/status";

        foreach (['READY_TO_SHIP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED', 'CASH_COLLECTED'] as $status) {
            $this->withToken($token)
                ->patchJson($url, ['status' => $status])
                ->assertUnprocessable()
                ->assertJsonValidationErrors(['status']);
        }

        $this->assertDatabaseHas('orders', [
            'id' => $fixture['order']->id,
            'order_status' => 'SUPPLIER_CONFIRMATION_REQUIRED',
        ]);
    }
}
