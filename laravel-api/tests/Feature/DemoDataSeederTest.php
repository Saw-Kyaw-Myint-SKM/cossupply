<?php

namespace Tests\Feature;

use App\Enums\DeliveryStatus;
use App\Enums\PaymentStatus;
use App\Enums\ProductStatus;
use App\Enums\QuotationRequestStatus;
use App\Enums\QuotationVersionStatus;
use App\Enums\StockStatus;
use App\Models\Admin;
use App\Models\CashPayment;
use App\Models\Category;
use App\Models\Customer;
use App\Models\Delivery;
use App\Models\Order;
use App\Models\Product;
use App\Models\Quotation;
use App\Models\QuotationItem;
use App\Models\QuotationRequest;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\DemoDataSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Tests\TestCase;

class DemoDataSeederTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Every table documented in specification/DatabaseFlow.md §3.
     *
     * @var list<string>
     */
    private const DOMAIN_TABLES = [
        'admins',
        'customers',
        'customer_addresses',
        'categories',
        'suppliers',
        'products',
        'product_prices',
        'product_stocks',
        'quotation_requests',
        'quotation_items',
        'supplier_communications',
        'quotations',
        'quotation_version_items',
        'quotation_pdfs',
        'quotation_actions',
        'orders',
        'order_items',
        'deliveries',
        'cash_payments',
        'order_status_histories',
        'notifications',
        'email_logs',
        'settings',
        'audit_logs',
    ];

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');
        Storage::fake('local');
    }

    public function test_database_seeder_populates_every_database_flow_table(): void
    {
        $this->seed(DatabaseSeeder::class);

        foreach (self::DOMAIN_TABLES as $table) {
            $this->assertGreaterThan(
                0,
                DB::table($table)->count(),
                "Expected the demo dataset to populate `{$table}`.",
            );
        }
    }

    public function test_money_totals_reconcile_for_quotations_and_orders(): void
    {
        $this->seed(DatabaseSeeder::class);

        $quotations = Quotation::query()->with('items')->get();
        $this->assertGreaterThan(0, $quotations->count());

        foreach ($quotations as $quotation) {
            $this->assertSame(
                (int) $quotation->items->sum('line_total'),
                $quotation->subtotal,
                "Quotation {$quotation->id} subtotal must equal sum of its item line_totals.",
            );

            $this->assertSame(
                $quotation->subtotal - $quotation->discount + $quotation->delivery_fee + $quotation->service_fee,
                $quotation->total_amount,
                "Quotation {$quotation->id} total_amount must equal subtotal - discount + delivery_fee + service_fee.",
            );

            foreach ($quotation->items as $item) {
                $this->assertSame(
                    $item->quantity * $item->unit_price - $item->discount,
                    $item->line_total,
                    "Version item {$item->id} line_total is inconsistent.",
                );
            }
        }

        $orders = Order::query()->with('items')->get();
        $this->assertGreaterThan(0, $orders->count());

        foreach ($orders as $order) {
            $this->assertSame(
                (int) $order->items->sum('line_total'),
                $order->subtotal,
                "Order {$order->id} subtotal must equal sum of its item line_totals.",
            );

            $this->assertSame(
                $order->subtotal - $order->discount + $order->delivery_fee + $order->service_fee,
                $order->total_amount,
                "Order {$order->id} total_amount must equal subtotal - discount + delivery_fee + service_fee.",
            );

            foreach ($order->items as $item) {
                $this->assertSame(
                    $item->quantity * $item->unit_price - $item->discount,
                    $item->line_total,
                    "Order item {$item->id} line_total is inconsistent.",
                );
            }
        }
    }

    public function test_exactly_one_current_quotation_version_per_request(): void
    {
        $this->seed(DatabaseSeeder::class);

        $requestsWithQuotations = 0;

        foreach (QuotationRequest::query()->with('quotations')->get() as $request) {
            if ($request->quotations->isEmpty()) {
                continue;
            }

            $requestsWithQuotations++;

            $this->assertSame(
                1,
                $request->quotations->where('is_current', true)->count(),
                "Request {$request->id} must have exactly one current quotation version.",
            );
        }

        $this->assertGreaterThan(0, $requestsWithQuotations);
    }

    public function test_superseded_and_sent_version_pair_exists(): void
    {
        $this->seed(DatabaseSeeder::class);

        $superseded = Quotation::query()->where('status', QuotationVersionStatus::SUPERSEDED->value)->first();
        $this->assertNotNull($superseded);
        $this->assertSame(1, $superseded->version);
        $this->assertFalse($superseded->is_current);

        $successor = Quotation::query()
            ->where('quotation_request_id', $superseded->quotation_request_id)
            ->where('version', 2)
            ->first();

        $this->assertNotNull($successor);
        $this->assertSame(QuotationVersionStatus::SENT, $successor->status);
        $this->assertTrue($successor->is_current);
    }

    public function test_orders_come_only_from_accepted_quotations_with_unique_quotation_id(): void
    {
        $this->seed(DatabaseSeeder::class);

        $orders = Order::query()->with('quotation')->get();

        $this->assertGreaterThan(0, $orders->count());
        $this->assertSame(
            $orders->count(),
            Order::query()->distinct()->count('quotation_id'),
            'orders.quotation_id must be unique.',
        );

        foreach ($orders as $order) {
            $this->assertSame(QuotationVersionStatus::ACCEPTED, $order->quotation->status);
            $this->assertSame($order->quotation->subtotal, $order->subtotal);
            $this->assertSame($order->quotation->total_amount, $order->total_amount);
        }
    }

    public function test_cash_payment_and_delivery_invariants_hold(): void
    {
        $this->seed(DatabaseSeeder::class);

        $payments = CashPayment::query()->with('order', 'delivery')->get();
        $this->assertGreaterThan(0, $payments->count());

        foreach ($payments as $payment) {
            $this->assertSame(
                $payment->amount_due - $payment->amount_collected,
                $payment->amount_remaining,
                "Cash payment {$payment->id} amount_remaining is inconsistent.",
            );

            $this->assertSame($payment->order->total_amount, $payment->amount_due);

            if ($payment->status === PaymentStatus::PAYMENT_CONFIRMED) {
                $this->assertSame($payment->amount_due, $payment->amount_collected);
                $this->assertSame(0, $payment->amount_remaining);
            }
        }

        foreach (Delivery::query()->with('order')->get() as $delivery) {
            $this->assertNotSame(DeliveryStatus::NOT_ASSIGNED, $delivery->order->delivery_status);
        }
    }

    public function test_quotation_items_snapshot_the_product_supplier(): void
    {
        $this->seed(DatabaseSeeder::class);

        $items = QuotationItem::query()->with('product')->get();
        $this->assertGreaterThan(0, $items->count());

        foreach ($items as $item) {
            $this->assertSame(
                $item->product->supplier_id,
                $item->supplier_id,
                "Quotation item {$item->id} must snapshot the product's own supplier.",
            );
        }
    }

    public function test_demo_data_covers_every_status_enum(): void
    {
        $this->seed(DatabaseSeeder::class);

        $requestStatuses = QuotationRequest::query()->get()
            ->map(static fn (QuotationRequest $request): string => $request->status->value)
            ->unique()
            ->values()
            ->all();

        $this->assertEqualsCanonicalizing(QuotationRequestStatus::values(), $requestStatuses);

        $versionStatuses = Quotation::query()->get()
            ->map(static fn (Quotation $quotation): string => $quotation->status->value)
            ->unique()
            ->values()
            ->all();

        foreach ([
            QuotationVersionStatus::DRAFT,
            QuotationVersionStatus::SENT,
            QuotationVersionStatus::VIEWED,
            QuotationVersionStatus::CHANGE_REQUESTED,
            QuotationVersionStatus::ACCEPTED,
            QuotationVersionStatus::REJECTED,
            QuotationVersionStatus::EXPIRED,
            QuotationVersionStatus::SUPERSEDED,
        ] as $status) {
            $this->assertContains($status->value, $versionStatuses, "Missing quotation version status {$status->value}.");
        }

        $productStatuses = Product::query()->get()
            ->map(static fn (Product $product): string => $product->status->value)
            ->unique()
            ->values()
            ->all();

        foreach (ProductStatus::cases() as $status) {
            $this->assertContains($status->value, $productStatuses, "Missing product status {$status->value}.");
        }

        $stockStatuses = DB::table('product_stocks')->distinct()->pluck('stock_status')->all();

        foreach (StockStatus::cases() as $status) {
            $this->assertContains($status->value, $stockStatuses, "Missing stock status {$status->value}.");
        }
    }

    public function test_published_products_with_an_empty_photo_exist(): void
    {
        $this->seed(DatabaseSeeder::class);

        $emptyPhotoPublished = Product::query()
            ->where('status', ProductStatus::PUBLISHED->value)
            ->where('photo', '')
            ->count();

        $this->assertGreaterThanOrEqual(4, $emptyPhotoPublished);

        foreach (Product::query()->where('photo', '!=', '')->get() as $product) {
            $this->assertTrue(
                Storage::disk('public')->exists($product->photo),
                "Seeded product photo `{$product->photo}` should exist on the public disk.",
            );
        }
    }

    public function test_public_catalog_exposes_only_published_products(): void
    {
        $this->seed(DatabaseSeeder::class);

        $publishedCount = Product::query()->where('status', ProductStatus::PUBLISHED->value)->count();

        $response = $this->getJson('/api/v1/products?per_page=100')->assertOk();

        $response->assertJsonPath('data.meta.total', $publishedCount);

        $visibleIds = collect($response->json('data.products'))->pluck('id')->all();
        $this->assertCount($publishedCount, $visibleIds);

        $hiddenIds = Product::query()
            ->where('status', '!=', ProductStatus::PUBLISHED->value)
            ->pluck('id')
            ->all();

        foreach ($hiddenIds as $hiddenId) {
            $this->assertNotContains(
                $hiddenId,
                $visibleIds,
                "Unpublished product {$hiddenId} leaked into the public catalog.",
            );
        }
    }

    public function test_database_seeder_preserves_the_default_admin_and_demo_credentials(): void
    {
        $this->seed(DatabaseSeeder::class);

        $defaultAdmin = Admin::query()->where('email', 'admin@cos.local')->first();
        $this->assertNotNull($defaultAdmin);
        $this->assertTrue(Hash::check('password', $defaultAdmin->password));

        $this->assertDatabaseHas('admins', ['email' => 'admin.demo@cos.local']);
        $this->assertDatabaseHas('admins', ['email' => 'ops.demo@cos.local']);

        $this->assertSame(3, Admin::query()->count());
        $this->assertSame(5, Customer::query()->count());
        $this->assertDatabaseHas('customers', ['email' => 'customer1@cos.local']);
    }

    public function test_database_seeder_does_not_seed_demo_data_in_production(): void
    {
        $this->app['env'] = 'production';

        $this->artisan('db:seed', [
            '--class' => DatabaseSeeder::class,
            '--force' => true,
        ])->assertSuccessful();

        $this->assertSame(0, Category::query()->count());
        $this->assertSame(0, Product::query()->count());
        $this->assertSame(0, QuotationRequest::query()->count());
        $this->assertGreaterThan(0, Admin::query()->count());
        $this->assertGreaterThan(0, DB::table('settings')->count());
    }

    public function test_demo_data_seeder_aborts_in_production(): void
    {
        $this->app['env'] = 'production';

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('DemoDataSeeder');

        (new DemoDataSeeder)->run();
    }

    public function test_repeat_runs_produce_identical_row_counts(): void
    {
        $this->seed(DatabaseSeeder::class);

        $firstCounts = $this->tableCounts();

        $this->seed(DemoDataSeeder::class);

        $this->assertSame($firstCounts, $this->tableCounts());
    }

    /**
     * Row counts for the tables covered by the demo dataset.
     *
     * @return array<string, int>
     */
    private function tableCounts(): array
    {
        $counts = [];

        foreach (self::DOMAIN_TABLES as $table) {
            $counts[$table] = DB::table($table)->count();
        }

        return $counts;
    }
}
