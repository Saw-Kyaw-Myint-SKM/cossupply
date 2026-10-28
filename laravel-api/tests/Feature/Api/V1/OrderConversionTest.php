<?php

namespace Tests\Feature\Api\V1;

use App\Enums\OrderStatus;
use App\Enums\QuotationRequestStatus;
use App\Models\CashPayment;
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
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Tests\TestCase;

class OrderConversionTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array{0: Customer, 1: string}
     */
    private function authenticate(): array
    {
        $customer = Customer::factory()->create();
        $token = $customer->createToken('customer-token', ['customer'])->plainTextToken;

        return [$customer, $token];
    }

    /**
     * A sent current quotation whose version items deliberately differ from
     * the original request items.
     *
     * @return array{0: QuotationRequest, 1: Quotation, 2: Product, 3: Supplier}
     */
    private function quotationScenario(Customer $customer): array
    {
        $supplier = Supplier::factory()->create();
        $product = Product::factory()->for($supplier)->create();
        $originalProduct = Product::factory()->for($supplier)->create();

        $request = QuotationRequest::factory()->create([
            'customer_id' => $customer->id,
            'status' => QuotationRequestStatus::QUOTATION_SENT->value,
            'customer_name' => 'Daw Hla Hla',
            'company_name' => 'Hla Trading Co., Ltd.',
            'phone' => '09-770-100-200',
            'email' => 'daw.hla@example.com',
            'delivery_address' => 'No. 12, Main Road',
            'city' => 'Yangon',
            'township' => 'Hlaing',
            'landmark' => 'Near Bogyoke Market',
            'customer_note' => 'Please deliver in the morning.',
        ]);

        // The request snapshot must never be the source of order items.
        QuotationItem::factory()->forRequest($request)->create([
            'product_id' => $originalProduct->id,
            'supplier_id' => $supplier->id,
            'product_name_snapshot' => 'Original request line',
            'quantity' => 1,
            'display_price' => 999,
        ]);

        $quotation = Quotation::factory()
            ->sent()
            ->priced(29500, 1000, 500, 5)
            ->create([
                'quotation_request_id' => $request->id,
                'quotation_number' => $request->quotation_number,
                'payment_method' => 'BANK_TRANSFER',
                'valid_until' => now()->addDays(7)->toDateString(),
            ]);

        QuotationVersionItem::factory()
            ->forQuotation($quotation)
            ->create([
                'product_id' => $product->id,
                'supplier_id' => $supplier->id,
                'product_name_snapshot' => 'Confirmed plastic chair',
                'sku_snapshot' => 'SKU-CHAIR-BLUE',
                'specification_snapshot' => 'Blue, stackable',
                'quantity' => 3,
                'unit_price' => 10000,
                'discount' => 500,
                'line_total' => 29500,
                'delivery_date' => now()->addDays(3)->toDateString(),
            ]);

        return [$request->refresh(), $quotation->refresh(), $product, $supplier];
    }

    public function test_accepting_a_quotation_creates_one_complete_order(): void
    {
        [$customer, $token] = $this->authenticate();
        [$request, $quotation, $product, $supplier] = $this->quotationScenario($customer);

        $response = $this->withToken($token)
            ->postJson("/api/v1/customer/quotations/{$quotation->id}/accept");

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.quotation_request.status', 'ACCEPTED')
            ->assertJsonPath('data.order.quotation_id', $quotation->id)
            ->assertJsonPath('data.order.order_status', 'SUPPLIER_CONFIRMATION_REQUIRED')
            ->assertJsonPath('data.order.payment_method', 'CASH_ON_DELIVERY')
            ->assertJsonPath('data.order.total_amount', 30475);

        $this->assertSame(1, Order::query()->count());

        $order = Order::query()->firstOrFail();

        $this->assertMatchesRegularExpression('/^ORD-\d{4}-000001$/', $order->order_number);
        $this->assertSame($quotation->id, $order->quotation_id);
        $this->assertSame($request->id, $order->quotation_request_id);
        $this->assertSame($customer->id, $order->customer_id);

        // Customer snapshots come from the request that was accepted.
        $this->assertSame('Daw Hla Hla', $order->customer_name);
        $this->assertSame('Hla Trading Co., Ltd.', $order->company_name);
        $this->assertSame('09-770-100-200', $order->phone);
        $this->assertSame('daw.hla@example.com', $order->email);
        $this->assertSame('No. 12, Main Road', $order->delivery_address);
        $this->assertSame('Yangon', $order->city);
        $this->assertSame('Hlaing', $order->township);
        $this->assertSame('Near Bogyoke Market', $order->landmark);
        $this->assertSame('Please deliver in the morning.', $order->customer_note);

        // Amounts are the accepted quotation values, not request display prices.
        $this->assertSame(29500, $order->subtotal);
        $this->assertSame(1000, $order->discount);
        $this->assertSame(500, $order->delivery_fee);
        $this->assertSame(5, $order->service_fee_percentage);
        $this->assertSame(1475, $order->service_fee);
        $this->assertSame(30475, $order->total_amount);
        $this->assertSame('CASH_ON_DELIVERY', $order->payment_method);
        $this->assertSame(OrderStatus::SUPPLIER_CONFIRMATION_REQUIRED, $order->order_status);

        // Items are copied from the accepted version, never the request.
        $item = OrderItem::query()->firstOrFail();
        $this->assertSame($order->id, $item->order_id);
        $this->assertSame($product->id, $item->product_id);
        $this->assertSame($supplier->id, $item->supplier_id);
        $this->assertSame('Confirmed plastic chair', $item->product_name_snapshot);
        $this->assertSame('SKU-CHAIR-BLUE', $item->sku_snapshot);
        $this->assertSame('Blue, stackable', $item->specification_snapshot);
        $this->assertSame(3, $item->quantity);
        $this->assertSame(10000, $item->unit_price);
        $this->assertSame(500, $item->discount);
        $this->assertSame(29500, $item->line_total);

        // One full delivery snapshot for the order.
        $delivery = Delivery::query()->firstOrFail();
        $this->assertSame($order->id, $delivery->order_id);
        $this->assertSame($supplier->id, $delivery->supplier_id);
        $this->assertSame('Daw Hla Hla', $delivery->delivery_contact_name);
        $this->assertSame('09-770-100-200', $delivery->delivery_phone);
        $this->assertSame('No. 12, Main Road', $delivery->delivery_address);
        $this->assertSame(500, $delivery->delivery_fee);
        $this->assertSame(now()->addDays(3)->toDateString(), $delivery->estimated_delivery_date?->toDateString());
        $this->assertSame('NOT_ASSIGNED', $delivery->delivery_status->value);

        // COD starts unpaid, linked to the delivery.
        $payment = CashPayment::query()->firstOrFail();
        $this->assertSame($order->id, $payment->order_id);
        $this->assertSame($delivery->id, $payment->delivery_id);
        $this->assertSame(30475, $payment->amount_due);
        $this->assertSame(0, $payment->amount_collected);
        $this->assertSame(30475, $payment->amount_remaining);
        $this->assertSame('NOT_PAID', $payment->status->value);
        $this->assertMatchesRegularExpression('/^RCP-\d{4}-000001$/', $payment->receipt_number);

        // Initial status history row.
        $history = OrderStatusHistory::query()->firstOrFail();
        $this->assertSame($order->id, $history->order_id);
        $this->assertNull($history->old_status);
        $this->assertSame('SUPPLIER_CONFIRMATION_REQUIRED', $history->new_status);
        $this->assertSame('SYSTEM', $history->changed_by_type);
    }

    public function test_accepting_twice_creates_only_one_order(): void
    {
        [$customer, $token] = $this->authenticate();
        [, $quotation] = $this->quotationScenario($customer);

        $this->withToken($token)
            ->postJson("/api/v1/customer/quotations/{$quotation->id}/accept")
            ->assertOk();

        $this->withToken($token)
            ->postJson("/api/v1/customer/quotations/{$quotation->id}/accept")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['quotation']);

        $this->assertSame(1, Order::query()->count());
        $this->assertSame(1, OrderItem::query()->count());
        $this->assertSame(1, Delivery::query()->count());
        $this->assertSame(1, CashPayment::query()->count());
        $this->assertSame(1, OrderStatusHistory::query()->count());
        $this->assertSame(1, QuotationAction::query()->where('action', 'ACCEPTED')->count());
    }

    public function test_failed_order_creation_rolls_back_the_whole_acceptance(): void
    {
        [$customer, $token] = $this->authenticate();
        [$request, $quotation] = $this->quotationScenario($customer);

        // Fail after the order, items and delivery have been inserted, so a
        // missing rollback would leave visible partial rows.
        $failing = true;

        DB::connection()->beforeExecuting(function (string $query) use (&$failing): void {
            if ($failing && str_contains($query, 'cash_payments')) {
                $failing = false;

                throw new RuntimeException('Forced cash payment failure.');
            }
        });

        try {
            $this->withToken($token)
                ->postJson("/api/v1/customer/quotations/{$quotation->id}/accept")
                ->assertStatus(500);
        } finally {
            $failing = false;
        }

        $this->assertSame(0, Order::query()->count());
        $this->assertSame(0, OrderItem::query()->count());
        $this->assertSame(0, Delivery::query()->count());
        $this->assertSame(0, CashPayment::query()->count());
        $this->assertSame(0, OrderStatusHistory::query()->count());
        $this->assertSame(0, QuotationAction::query()->count());

        $this->assertSame('SENT', $quotation->refresh()->status->value);
        $this->assertSame('QUOTATION_SENT', $request->refresh()->status->value);
    }

    public function test_database_enforces_one_order_per_quotation_version(): void
    {
        [$customer] = $this->authenticate();
        [, $quotation] = $this->quotationScenario($customer);

        Order::factory()->create(['quotation_id' => $quotation->id]);

        $this->expectException(QueryException::class);

        Order::factory()->create(['quotation_id' => $quotation->id]);
    }
}
