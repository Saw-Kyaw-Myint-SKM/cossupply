<?php

namespace Tests\Feature\Api\V1;

use App\Enums\OrderStatus;
use App\Models\Admin;
use App\Models\CashPayment;
use App\Models\Customer;
use App\Models\Delivery;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\Quotation;
use App\Models\QuotationRequest;
use App\Models\Supplier;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CustomerOrderTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array{0: Customer, 1: string}
     */
    private function authenticate(?Customer $customer = null): array
    {
        $customer ??= Customer::factory()->create();
        $token = $customer->createToken('customer-token', ['customer'])->plainTextToken;

        return [$customer, $token];
    }

    /**
     * An order owned by the given customer, with one item and a delivery.
     *
     * @param  array<string, mixed>  $attributes
     * @return array{0: Order, 1: OrderItem}
     */
    private function orderFor(Customer $customer, array $attributes = []): array
    {
        $request = QuotationRequest::factory()->create(['customer_id' => $customer->id]);
        $quotation = Quotation::factory()
            ->accepted()
            ->priced(20000, 0, 500, 5)
            ->create([
                'quotation_request_id' => $request->id,
                'quotation_number' => $request->quotation_number,
            ]);

        $order = Order::factory()
            ->priced(20000, 0, 500, 5)
            ->create(array_merge([
                'quotation_id' => $quotation->id,
                'quotation_request_id' => $request->id,
                'customer_id' => $customer->id,
                'customer_name' => $request->customer_name,
                'phone' => $request->phone,
                'delivery_address' => $request->delivery_address,
                'city' => $request->city,
                'order_status' => OrderStatus::SUPPLIER_CONFIRMATION_REQUIRED->value,
            ], $attributes));

        $supplier = Supplier::factory()->create(['shop_name' => 'Yangon Office Supply']);
        $product = Product::factory()->for($supplier)->create();

        $item = OrderItem::factory()->forOrder($order)->create([
            'product_id' => $product->id,
            'supplier_id' => $supplier->id,
            'product_name_snapshot' => 'Plastic Chair',
            'quantity' => 2,
            'unit_price' => 10000,
            'discount' => 0,
            'line_total' => 20000,
        ]);

        Delivery::factory()->forOrder($order)->create(['supplier_id' => $supplier->id]);

        $delivery = Delivery::query()->where('order_id', $order->id)->firstOrFail();

        CashPayment::factory()
            ->forOrder($order)
            ->forDelivery($delivery)
            ->create();

        return [$order, $item];
    }

    public function test_guest_cannot_access_customer_order_routes(): void
    {
        $this->getJson('/api/v1/customer/orders')->assertUnauthorized();
        $this->getJson('/api/v1/customer/orders/1')->assertUnauthorized();
    }

    public function test_admin_token_cannot_access_customer_order_routes(): void
    {
        $admin = Admin::factory()->create();
        $token = $admin->createToken('admin-token', ['admin'])->plainTextToken;

        [$customer] = $this->authenticate();
        [$order] = $this->orderFor($customer);

        $this->withToken($token)->getJson('/api/v1/customer/orders')->assertForbidden();
        $this->withToken($token)->getJson("/api/v1/customer/orders/{$order->id}")->assertForbidden();
    }

    public function test_customer_only_sees_their_own_orders(): void
    {
        [$customer, $token] = $this->authenticate();
        [$own] = $this->orderFor($customer);

        [$other] = $this->authenticate();
        $this->orderFor($other);

        $this->withToken($token)
            ->getJson('/api/v1/customer/orders')
            ->assertOk()
            ->assertJsonPath('data.meta.total', 1)
            ->assertJsonPath('data.orders.0.id', $own->id)
            ->assertJsonPath('data.orders.0.customer_id', $customer->id)
            ->assertJsonPath('data.orders.0.order_status', 'SUPPLIER_CONFIRMATION_REQUIRED')
            ->assertJsonPath('data.orders.0.payment_method', 'CASH_ON_DELIVERY')
            ->assertJsonPath('data.orders.0.item_count', 1)
            ->assertJsonCount(1, 'data.orders');

        $this->withToken($token)
            ->getJson('/api/v1/customer/orders?status=PREPARING')
            ->assertOk()
            ->assertJsonPath('data.meta.total', 0);
    }

    public function test_customer_can_open_their_own_order_detail(): void
    {
        [$customer, $token] = $this->authenticate();
        [$order] = $this->orderFor($customer);

        $this->withToken($token)
            ->getJson("/api/v1/customer/orders/{$order->id}")
            ->assertOk()
            ->assertJsonPath('data.order.id', $order->id)
            ->assertJsonPath('data.order.order_number', $order->order_number)
            ->assertJsonPath('data.order.customer_id', $customer->id)
            ->assertJsonPath('data.order.order_status', 'SUPPLIER_CONFIRMATION_REQUIRED')
            ->assertJsonPath('data.order.items.0.product_name_snapshot', 'Plastic Chair')
            ->assertJsonPath('data.order.items.0.supplier.shop_name', 'Yangon Office Supply')
            ->assertJsonPath('data.order.delivery.delivery_status', 'NOT_ASSIGNED')
            ->assertJsonPath('data.order.cash_payment.status', 'NOT_PAID')
            ->assertJsonPath('data.order.suppliers', []);
    }

    public function test_another_customers_order_answers_404(): void
    {
        [, $token] = $this->authenticate();
        [$other] = $this->authenticate();
        [$foreign] = $this->orderFor($other);

        $this->withToken($token)
            ->getJson("/api/v1/customer/orders/{$foreign->id}")
            ->assertNotFound()
            ->assertJsonPath('message', 'Order not found.');

        $this->withToken($token)
            ->getJson('/api/v1/customer/orders/999999')
            ->assertNotFound();
    }
}
