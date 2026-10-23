<?php

namespace Tests\Feature\Api\V1;

use App\Models\Admin;
use App\Models\CashPayment;
use App\Models\Category;
use App\Models\Customer;
use App\Models\Delivery;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderStatusHistory;
use App\Models\Product;
use App\Models\Quotation;
use App\Models\QuotationAction;
use App\Models\QuotationItem;
use App\Models\QuotationRequest;
use App\Models\QuotationVersionItem;
use App\Models\Supplier;
use App\Services\Order\ReceiptNumberGenerator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use RuntimeException;
use Tests\TestCase;

class OrderConversionTest extends TestCase
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
     * A customer-owned request with one priced, current quotation version.
     *
     * @return array{
     *     admin: Admin,
     *     customer: Customer,
     *     products: list<Product>,
     *     request: QuotationRequest,
     *     quotation: Quotation,
     *     version_items: list<QuotationVersionItem>,
     *     request_item: QuotationItem
     * }
     */
    private function makeQuotation(?Customer $customer = null, bool $mixedSuppliers = false): array
    {
        $admin = Admin::factory()->create();
        $customer ??= Customer::factory()->create();

        $request = QuotationRequest::factory()
            ->for($customer)
            ->create([
                'status' => 'QUOTATION_SENT',
                'customer_name' => 'Snapshot Buyer',
                'company_name' => 'Snapshot Trading Co., Ltd.',
                'phone' => '09999999999',
                'email' => 'snapshot@example.com',
                'delivery_address' => 'No. 1 Snapshot Street',
                'city' => 'Yangon',
                'township' => 'Hlaing',
                'landmark' => 'Near the market',
                'customer_note' => 'Please call before delivery.',
            ]);

        $quotation = Quotation::factory()
            ->for($request)
            ->priced(30000, 1000, 2000, 5)
            ->create([
                'version' => 1,
                'status' => 'SENT',
                'is_current' => true,
                'valid_until' => now()->addDays(5)->toDateString(),
                'sent_at' => now(),
                'created_by_admin_id' => $admin->id,
            ]);

        $products = [];
        $versionItems = [];

        if ($mixedSuppliers) {
            $specs = [
                ['supplier' => Supplier::factory()->create(), 'quantity' => 2],
                ['supplier' => Supplier::factory()->create(), 'quantity' => 1],
            ];
        } else {
            $specs = [
                ['supplier' => Supplier::factory()->create(), 'quantity' => 3],
            ];
        }

        foreach ($specs as $index => $spec) {
            $product = Product::factory()
                ->for($spec['supplier'])
                ->for(Category::factory())
                ->published()
                ->withPrice(['retail_price' => 10000])
                ->create();

            $products[] = $product;

            $versionItems[] = QuotationVersionItem::factory()
                ->forQuotation($quotation)
                ->forProduct($product)
                ->create([
                    'quantity' => $spec['quantity'],
                    'unit_price' => 10000,
                    'discount' => 0,
                    'line_total' => $spec['quantity'] * 10000,
                ]);
        }

        $requestItem = QuotationItem::factory()
            ->forRequest($request)
            ->forProduct($products[0])
            ->create([
                'quantity' => 9,
                'display_price' => 1234,
            ]);

        return [
            'admin' => $admin,
            'customer' => $customer,
            'products' => $products,
            'request' => $request,
            'quotation' => $quotation,
            'version_items' => $versionItems,
            'request_item' => $requestItem,
        ];
    }

    public function test_accept_creates_one_order_with_snapshots_items_delivery_payment_and_history(): void
    {
        $fixture = $this->makeQuotation();
        [$customer, $token] = $this->authenticate($fixture['customer']);

        $response = $this->withToken($token)
            ->postJson("/api/v1/customer/quotations/{$fixture['quotation']->id}/accept", [
                'cod_terms_accepted' => true,
            ])
            ->assertOk()
            ->assertJsonPath('message', 'Quotation accepted.')
            ->assertJsonPath('data.quotation.status', 'ACCEPTED')
            ->assertJsonPath('data.request.status', 'ACCEPTED')
            ->assertJsonPath('data.order.order_status', 'SUPPLIER_CONFIRMATION_REQUIRED')
            ->assertJsonPath('data.order.payment_status', 'NOT_PAID')
            ->assertJsonPath('data.order.delivery_status', 'NOT_ASSIGNED')
            ->assertJsonPath('data.order.total_amount', 32500)
            ->assertJsonStructure([
                'data' => [
                    'order' => [
                        'id',
                        'order_number',
                        'order_status',
                        'payment_status',
                        'delivery_status',
                        'total_amount',
                        'created_at',
                    ],
                ],
            ]);

        $orderId = $response->json('data.order.id');
        $this->assertNotNull($orderId);

        $order = Order::query()->findOrFail($orderId);

        $this->assertMatchesRegularExpression('/^ORD-\d{4}-\d{4,}$/', $order->order_number);
        $this->assertSame($fixture['quotation']->id, $order->quotation_id);
        $this->assertSame($fixture['request']->id, $order->quotation_request_id);
        $this->assertSame($customer->id, $order->customer_id);
        $this->assertSame('Snapshot Buyer', $order->customer_name);
        $this->assertSame('Snapshot Trading Co., Ltd.', $order->company_name);
        $this->assertSame('09999999999', $order->phone);
        $this->assertSame('snapshot@example.com', $order->email);
        $this->assertSame('No. 1 Snapshot Street', $order->delivery_address);
        $this->assertSame('Yangon', $order->city);
        $this->assertSame('Hlaing', $order->township);
        $this->assertSame('Near the market', $order->landmark);
        $this->assertSame('Please call before delivery.', $order->customer_note);

        $this->assertSame(30000, $order->subtotal);
        $this->assertSame(1000, $order->discount);
        $this->assertSame(2000, $order->delivery_fee);
        $this->assertSame(5, $order->service_fee_percentage);
        $this->assertSame(1500, $order->service_fee);
        $this->assertSame(32500, $order->total_amount);
        $this->assertSame('CASH_ON_DELIVERY', $order->payment_method);

        $orderItems = OrderItem::query()->where('order_id', $order->id)->orderBy('id')->get();
        $this->assertCount(1, $orderItems);

        $versionItem = $fixture['version_items'][0];
        $orderItem = $orderItems->first();

        $this->assertSame($versionItem->product_id, $orderItem->product_id);
        $this->assertSame($versionItem->supplier_id, $orderItem->supplier_id);
        $this->assertSame($versionItem->product_name_snapshot, $orderItem->product_name_snapshot);
        $this->assertSame($versionItem->sku_snapshot, $orderItem->sku_snapshot);
        $this->assertSame($versionItem->specification_snapshot, $orderItem->specification_snapshot);
        $this->assertSame(3, $orderItem->quantity);
        $this->assertSame(10000, $orderItem->unit_price);
        $this->assertSame(0, $orderItem->discount);
        $this->assertSame(30000, $orderItem->line_total);

        // The original request item must never drive the order snapshot.
        $this->assertNotSame($fixture['request_item']->quantity, $orderItem->quantity);

        $delivery = Delivery::query()->where('order_id', $order->id)->sole();
        $this->assertSame($versionItem->supplier_id, $delivery->supplier_id);
        $this->assertSame('Snapshot Buyer', $delivery->delivery_contact_name);
        $this->assertSame('09999999999', $delivery->delivery_phone);
        $this->assertSame('No. 1 Snapshot Street', $delivery->delivery_address);
        $this->assertSame('Yangon', $delivery->city);
        $this->assertSame('Hlaing', $delivery->township);
        $this->assertSame('Near the market', $delivery->landmark);
        $this->assertSame(2000, $delivery->delivery_fee);
        $this->assertSame('Please call before delivery.', $delivery->customer_note);
        $this->assertSame('NOT_ASSIGNED', $delivery->delivery_status->value);

        $payment = CashPayment::query()->where('order_id', $order->id)->sole();
        $this->assertMatchesRegularExpression('/^RCP-\d{4}-\d{4,}$/', $payment->receipt_number);
        $this->assertSame($delivery->id, $payment->delivery_id);
        $this->assertSame(32500, $payment->amount_due);
        $this->assertSame(0, $payment->amount_collected);
        $this->assertSame(32500, $payment->amount_remaining);
        $this->assertSame('NOT_PAID', $payment->status->value);

        $history = OrderStatusHistory::query()->where('order_id', $order->id)->sole();
        $this->assertNull($history->old_status);
        $this->assertSame('SUPPLIER_CONFIRMATION_REQUIRED', $history->new_status);
        $this->assertSame('CUSTOMER', $history->changed_by_type);
        $this->assertSame($customer->id, $history->changed_by_id);
        $this->assertSame(
            'Order created from accepted quotation '.$fixture['request']->quotation_number.' v1.',
            $history->note,
        );

        $this->assertDatabaseHas('quotations', [
            'id' => $fixture['quotation']->id,
            'status' => 'ACCEPTED',
            'is_current' => true,
        ]);
        $this->assertDatabaseHas('quotation_requests', [
            'id' => $fixture['request']->id,
            'status' => 'ACCEPTED',
        ]);

        $action = QuotationAction::query()->sole();
        $this->assertSame('ACCEPTED', $action->action->value);
        $this->assertSame('CUSTOMER', $action->actor_type);
        $this->assertSame($customer->id, $action->actor_id);
    }

    public function test_mixed_supplier_items_leave_the_delivery_supplier_unassigned(): void
    {
        $fixture = $this->makeQuotation(mixedSuppliers: true);
        [, $token] = $this->authenticate($fixture['customer']);

        $this->withToken($token)
            ->postJson("/api/v1/customer/quotations/{$fixture['quotation']->id}/accept", [
                'cod_terms_accepted' => true,
            ])
            ->assertOk();

        $order = Order::query()->sole();
        $this->assertSame(2, OrderItem::query()->where('order_id', $order->id)->count());
        $this->assertNull(Delivery::query()->where('order_id', $order->id)->sole()->supplier_id);
    }

    public function test_second_accept_returns_conflict_and_keeps_exactly_one_order(): void
    {
        $fixture = $this->makeQuotation();
        [, $token] = $this->authenticate($fixture['customer']);
        $url = "/api/v1/customer/quotations/{$fixture['quotation']->id}/accept";

        $this->withToken($token)
            ->postJson($url, ['cod_terms_accepted' => true])
            ->assertOk();

        $this->withToken($token)
            ->postJson($url, ['cod_terms_accepted' => true])
            ->assertStatus(409)
            ->assertJsonPath('success', false);

        $this->assertDatabaseCount('orders', 1);
        $this->assertDatabaseCount('order_items', 1);
        $this->assertDatabaseCount('deliveries', 1);
        $this->assertDatabaseCount('cash_payments', 1);
        $this->assertDatabaseCount('quotation_actions', 1);
    }

    public function test_duplicate_insertion_race_is_converted_to_conflict_and_rolled_back(): void
    {
        $existing = $this->makeQuotation();
        $existingOrder = Order::factory()->create([
            'quotation_id' => $existing['quotation']->id,
        ]);

        $target = $this->makeQuotation();
        [, $token] = $this->authenticate($target['customer']);

        // Simulate the competing transaction that commits between our
        // exists() pre-check and the orders insert: the inserted row is
        // deflected onto the already-used quotation_id, so the unique index
        // fires.
        Order::creating(function (Order $order) use ($existingOrder): void {
            $order->quotation_id = $existingOrder->quotation_id;
        });

        try {
            $this->withToken($token)
                ->postJson("/api/v1/customer/quotations/{$target['quotation']->id}/accept", [
                    'cod_terms_accepted' => true,
                ])
                ->assertStatus(409)
                ->assertJsonPath('message', 'An order already exists for this quotation.');
        } finally {
            Order::flushEventListeners();
        }

        $this->assertDatabaseCount('orders', 1);
        $this->assertDatabaseCount('order_items', 0);
        $this->assertDatabaseCount('deliveries', 0);
        $this->assertDatabaseCount('cash_payments', 0);
        $this->assertDatabaseCount('quotation_actions', 0);
        $this->assertDatabaseHas('quotations', [
            'id' => $target['quotation']->id,
            'status' => 'SENT',
        ]);
        $this->assertDatabaseHas('quotation_requests', [
            'id' => $target['request']->id,
            'status' => 'QUOTATION_SENT',
        ]);
    }

    public function test_failure_after_partial_writes_rolls_everything_back(): void
    {
        $fixture = $this->makeQuotation();
        [, $token] = $this->authenticate($fixture['customer']);

        $this->mock(ReceiptNumberGenerator::class, function ($mock): void {
            $mock->shouldReceive('generate')->andThrow(new RuntimeException('Forced receipt failure.'));
        });

        $this->withToken($token)
            ->postJson("/api/v1/customer/quotations/{$fixture['quotation']->id}/accept", [
                'cod_terms_accepted' => true,
            ])
            ->assertStatus(500);

        $this->assertDatabaseCount('orders', 0);
        $this->assertDatabaseCount('order_items', 0);
        $this->assertDatabaseCount('deliveries', 0);
        $this->assertDatabaseCount('cash_payments', 0);
        $this->assertDatabaseCount('order_status_histories', 0);
        $this->assertDatabaseCount('quotation_actions', 0);

        $this->assertDatabaseHas('quotations', [
            'id' => $fixture['quotation']->id,
            'status' => 'SENT',
        ]);
        $this->assertDatabaseHas('quotation_requests', [
            'id' => $fixture['request']->id,
            'status' => 'QUOTATION_SENT',
        ]);
    }

    public function test_foreign_customer_cannot_accept_and_the_order_belongs_to_the_owner(): void
    {
        $fixture = $this->makeQuotation();
        [$intruder, $intruderToken] = $this->authenticate();
        $url = "/api/v1/customer/quotations/{$fixture['quotation']->id}/accept";

        $this->withToken($intruderToken)
            ->postJson($url, ['cod_terms_accepted' => true])
            ->assertNotFound();

        $this->assertDatabaseCount('orders', 0);

        [$owner, $ownerToken] = $this->authenticate($fixture['customer']);

        $this->withToken($ownerToken)
            ->postJson($url, ['cod_terms_accepted' => true])
            ->assertOk();

        $this->assertSame($owner->id, Order::query()->sole()->customer_id);
        $this->assertNotSame($intruder->id, Order::query()->sole()->customer_id);
    }
}
