<?php

namespace Tests\Feature\Api\V1;

use App\Models\Admin;
use App\Models\Category;
use App\Models\Customer;
use App\Models\Product;
use App\Models\QuotationItem;
use App\Models\QuotationRequest;
use App\Models\Supplier;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class CustomerQuotationRequestTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array{0: Customer, 1: string}
     */
    private function authenticate(array $customerAttributes = []): array
    {
        $customer = Customer::factory()->create($customerAttributes);
        $token = $customer->createToken('customer-token', ['customer'])->plainTextToken;

        return [$customer, $token];
    }

    /**
     * A published product with a price row and an optional stock row.
     *
     * @param  array<string, mixed>  $price
     * @param  array<string, mixed>|null  $stock
     */
    private function publishedProduct(array $price = [], ?array $stock = ['stock_status' => 'IN_STOCK']): Product
    {
        $product = Product::factory()
            ->for(Supplier::factory()->create())
            ->for(Category::factory()->create())
            ->published()
            ->withPrice(array_merge([
                'retail_price' => 10000,
                'wholesale_price' => null,
                'discount_price' => null,
                'minimum_order_quantity' => 1,
            ], $price));

        $product = $stock === null
            ? $product->create()
            : $product->withStock($stock)->create();

        return $product->refresh();
    }

    /**
     * A valid quotation request payload around the given cart items.
     *
     * @param  list<array<string, mixed>>  $items
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function payload(array $items = [], array $overrides = []): array
    {
        return array_merge([
            'items' => $items,
            'name' => 'Aung Aung',
            'phone' => '09123456789',
            'company_name' => 'Aung Trading Co., Ltd.',
            'email' => 'aung@example.com',
            'city' => 'Yangon',
            'township' => 'Hlaing',
            'delivery_address' => 'No. 123, Main Road, Hlaing Township',
            'landmark' => 'Near Thingaha Hotel',
            'required_delivery_date' => now()->addDays(5)->toDateString(),
            'customer_note' => 'Please include bulk pricing where applicable.',
        ], $overrides);
    }

    public function test_guest_cannot_access_any_quotation_request_route(): void
    {
        $this->getJson('/api/v1/customer/quotation-requests')->assertUnauthorized();
        $this->postJson('/api/v1/customer/quotation-requests', ['items' => []])->assertUnauthorized();
    }

    public function test_admin_token_cannot_access_customer_quotation_routes(): void
    {
        $admin = Admin::factory()->create();
        $token = $admin->createToken('admin-token', ['admin'])->plainTextToken;

        $this->withToken($token)->getJson('/api/v1/customer/quotation-requests')->assertForbidden();
        $this->withToken($token)
            ->postJson('/api/v1/customer/quotation-requests', ['items' => []])
            ->assertForbidden();
    }

    public function test_customer_can_submit_a_quotation_request_from_the_cart(): void
    {
        [$customer, $token] = $this->authenticate();
        $product = $this->publishedProduct(
            ['retail_price' => 10000, 'discount_price' => 9000],
            ['stock_status' => 'LOW_STOCK'],
        );
        $specification = $product->specification;

        $response = $this->withToken($token)->postJson(
            '/api/v1/customer/quotation-requests',
            $this->payload([['product_id' => $product->id, 'quantity' => 2]]),
        );

        $response->assertCreated()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.quotation_request.status', 'NEW')
            ->assertJsonPath('data.quotation_request.customer_id', $customer->id)
            ->assertJsonPath('data.quotation_request.customer_name', 'Aung Aung')
            ->assertJsonPath('data.quotation_request.phone', '09123456789')
            ->assertJsonPath('data.quotation_request.city', 'Yangon')
            ->assertJsonPath('data.quotation_request.items.0.display_price', 9000)
            ->assertJsonPath('data.quotation_request.items.0.stock_status', 'LOW_STOCK');

        // Quotation number format: QT-YYYY-#### (at least four digits).
        $quotationNumber = $response->json('data.quotation_request.quotation_number');
        $this->assertMatchesRegularExpression('/^QT-\d{4}-\d{4,}$/', $quotationNumber);
        $this->assertSame(now()->year.'', (string) Str::between($quotationNumber, 'QT-', '-'), 'Year segment must be the current year.');

        $row = QuotationRequest::query()->where('quotation_number', $quotationNumber)->sole();
        $this->assertSame($customer->id, $row->customer_id);
        $this->assertSame('NEW', $row->status->value);
        $this->assertSame('Aung Aung', $row->customer_name);
        $this->assertNotNull($row->required_delivery_date);

        $item = QuotationItem::query()->where('quotation_request_id', $row->id)->sole();
        $this->assertSame($product->id, $item->product_id);
        $this->assertSame($product->supplier_id, $item->supplier_id);
        $this->assertSame($product->name_en, $item->product_name_snapshot);
        $this->assertSame($specification, $item->specification_snapshot);
        $this->assertSame(2, $item->quantity);
        $this->assertSame(9000, $item->display_price);
        $this->assertSame('LOW_STOCK', $item->stock_status->value);
    }

    public function test_body_customer_id_is_ignored_and_owner_is_the_authenticatee(): void
    {
        [$customer, $token] = $this->authenticate();
        $intruder = Customer::factory()->create();
        $product = $this->publishedProduct();

        $response = $this->withToken($token)->postJson(
            '/api/v1/customer/quotation-requests',
            $this->payload([['product_id' => $product->id, 'quantity' => 1]], ['customer_id' => $intruder->id]),
        );

        $response->assertCreated();
        $row = QuotationRequest::query()->sole();

        $this->assertSame($customer->id, $row->customer_id);
        $this->assertNotSame($intruder->id, $row->customer_id);
    }

    public function test_empty_or_missing_items_are_rejected(): void
    {
        [$customer, $token] = $this->authenticate();

        $this->withToken($token)->postJson('/api/v1/customer/quotation-requests', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['items']);

        $this->withToken($token)->postJson(
            '/api/v1/customer/quotation-requests',
            $this->payload([]),
        )->assertUnprocessable()->assertJsonValidationErrors(['items']);

        $this->assertDatabaseCount('quotation_requests', 0);
    }

    public function test_required_contact_and_delivery_fields_are_validated(): void
    {
        [$customer, $token] = $this->authenticate();
        $product = $this->publishedProduct();
        $base = [['product_id' => $product->id, 'quantity' => 1]];

        foreach (['name', 'phone', 'city', 'delivery_address'] as $field) {
            $payload = $this->payload($base);
            unset($payload[$field]);

            $this->withToken($token)->postJson('/api/v1/customer/quotation-requests', $payload)
                ->assertUnprocessable()
                ->assertJsonValidationErrors([$field]);
        }

        $this->assertDatabaseCount('quotation_requests', 0);
        $this->assertDatabaseCount('quotation_items', 0);
    }

    public function test_nonexistent_product_is_rejected_without_persisting(): void
    {
        [$customer, $token] = $this->authenticate();

        $response = $this->withToken($token)->postJson(
            '/api/v1/customer/quotation-requests',
            $this->payload([['product_id' => 999999, 'quantity' => 1]]),
        );

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['items.0.product_id']);

        $this->assertDatabaseCount('quotation_requests', 0);
        $this->assertDatabaseCount('quotation_items', 0);
    }

    public function test_unpublished_product_is_rejected_without_persisting(): void
    {
        [$customer, $token] = $this->authenticate();
        $product = $this->publishedProduct([], null);
        $product->update(['status' => 'DRAFT']);

        $response = $this->withToken($token)->postJson(
            '/api/v1/customer/quotation-requests',
            $this->payload([['product_id' => $product->id, 'quantity' => 1]]),
        );

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['items.0.product_id', 'items.0']);

        $this->assertDatabaseCount('quotation_requests', 0);
        $this->assertDatabaseCount('quotation_items', 0);
    }

    public function test_out_of_stock_product_is_rejected_without_persisting(): void
    {
        [$customer, $token] = $this->authenticate();
        $product = $this->publishedProduct([], ['stock_status' => 'OUT_OF_STOCK']);

        $response = $this->withToken($token)->postJson(
            '/api/v1/customer/quotation-requests',
            $this->payload([['product_id' => $product->id, 'quantity' => 1]]),
        );

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['items.0.product_id', 'items.0']);

        $this->assertDatabaseCount('quotation_requests', 0);
        $this->assertDatabaseCount('quotation_items', 0);
    }

    public function test_quantity_below_minimum_order_quantity_is_rejected_without_persisting(): void
    {
        [$customer, $token] = $this->authenticate();
        $product = $this->publishedProduct(
            ['retail_price' => 10000, 'minimum_order_quantity' => 10, 'discount_price' => null],
            null,
        );

        $response = $this->withToken($token)->postJson(
            '/api/v1/customer/quotation-requests',
            $this->payload([['product_id' => $product->id, 'quantity' => 2]]),
        );

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['items.0.quantity']);

        $this->assertDatabaseCount('quotation_requests', 0);
        $this->assertDatabaseCount('quotation_items', 0);

        // At or above MOQ succeeds.
        $this->withToken($token)->postJson(
            '/api/v1/customer/quotation-requests',
            $this->payload([['product_id' => $product->id, 'quantity' => 10]]),
        )->assertCreated();
    }

    public function test_per_item_errors_are_keyed_by_item_index(): void
    {
        [$customer, $token] = $this->authenticate();
        $valid = $this->publishedProduct();
        $unavailable = $this->publishedProduct([], ['stock_status' => 'OUT_OF_STOCK']);
        $missingMoq = $this->publishedProduct(
            ['retail_price' => 5000, 'minimum_order_quantity' => 5, 'discount_price' => null],
            null,
        );

        $response = $this->withToken($token)->postJson(
            '/api/v1/customer/quotation-requests',
            $this->payload([
                ['product_id' => $valid->id, 'quantity' => 1],
                ['product_id' => $unavailable->id, 'quantity' => 1],
                ['product_id' => $missingMoq->id, 'quantity' => 1],
            ]),
        );

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['items.1.product_id', 'items.2.quantity']);

        $this->assertDatabaseCount('quotation_requests', 0);
        $this->assertDatabaseCount('quotation_items', 0);
    }

    public function test_duplicate_product_ids_are_rejected(): void
    {
        [$customer, $token] = $this->authenticate();
        $product = $this->publishedProduct();

        $response = $this->withToken($token)->postJson(
            '/api/v1/customer/quotation-requests',
            $this->payload([
                ['product_id' => $product->id, 'quantity' => 1],
                ['product_id' => $product->id, 'quantity' => 3],
            ]),
        );

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['items.1.product_id']);

        $this->assertDatabaseCount('quotation_requests', 0);
        $this->assertDatabaseCount('quotation_items', 0);
    }

    public function test_required_delivery_date_cannot_be_in_the_past_or_malformed(): void
    {
        [$customer, $token] = $this->authenticate();
        $product = $this->publishedProduct();

        $this->withToken($token)->postJson(
            '/api/v1/customer/quotation-requests',
            $this->payload([['product_id' => $product->id, 'quantity' => 1]], [
                'required_delivery_date' => now()->subDay()->toDateString(),
            ]),
        )->assertUnprocessable()->assertJsonValidationErrors(['required_delivery_date']);

        $this->withToken($token)->postJson(
            '/api/v1/customer/quotation-requests',
            $this->payload([['product_id' => $product->id, 'quantity' => 1]], [
                'required_delivery_date' => 'not-a-date',
            ]),
        )->assertUnprocessable()->assertJsonValidationErrors(['required_delivery_date']);

        $this->assertDatabaseCount('quotation_requests', 0);
    }

    public function test_item_snapshots_stay_immutable_after_source_product_changes(): void
    {
        [$customer, $token] = $this->authenticate();
        $product = $this->publishedProduct(
            ['retail_price' => 10000, 'discount_price' => 9000],
            ['stock_status' => 'IN_STOCK'],
        );
        $originalName = $product->name_en;
        $originalSpecification = $product->specification;

        $response = $this->withToken($token)->postJson(
            '/api/v1/customer/quotation-requests',
            $this->payload([['product_id' => $product->id, 'quantity' => 2]]),
        );

        $response->assertCreated();

        $item = QuotationItem::query()->sole();
        $snapshotAtSubmission = $item->only([
            'product_id', 'supplier_id', 'product_name_snapshot', 'specification_snapshot',
            'quantity', 'display_price', 'stock_status',
        ]);

        // Simulate the catalog changing after the request was submitted.
        $product->update([
            'name_en' => 'Renamed Product',
            'name_mm' => 'Product (Myanmar)',
            'specification' => 'Updated specification',
        ]);
        $product->prices()->update(['retail_price' => 20000, 'discount_price' => 5000]);
        $product->stock()->update(['stock_status' => 'OUT_OF_STOCK']);

        $item->refresh();

        $this->assertSame($snapshotAtSubmission, $item->only(array_keys($snapshotAtSubmission)));
        $this->assertSame($originalName, $item->product_name_snapshot);
        $this->assertSame($originalSpecification, $item->specification_snapshot);
        $this->assertSame(9000, $item->display_price);
        $this->assertSame('IN_STOCK', $item->stock_status->value);
    }

    public function test_quotation_requests_are_scoped_to_their_owner(): void
    {
        [$customer, $token] = $this->authenticate();
        $foreign = Customer::factory()->create()->createToken('customer-token', ['customer'])->plainTextToken;
        $product = $this->publishedProduct();

        $this->withToken($foreign)->postJson(
            '/api/v1/customer/quotation-requests',
            $this->payload([['product_id' => $product->id, 'quantity' => 1]]),
        )->assertCreated();

        $list = $this->withToken($token)->getJson('/api/v1/customer/quotation-requests');

        $list->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.meta.total', 0);
        $this->assertSame([], $list->json('data.quotation_requests'));
    }

    public function test_list_returns_own_requests_newest_first_with_meta(): void
    {
        [$customer, $token] = $this->authenticate();

        QuotationRequest::factory()->count(4)->create([
            'customer_id' => $customer->id,
            'status' => 'NEW',
        ]);

        $response = $this->withToken($token)->getJson(
            '/api/v1/customer/quotation-requests?per_page=2&page=1',
        );

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.meta.current_page', 1)
            ->assertJsonPath('data.meta.per_page', 2)
            ->assertJsonPath('data.meta.total', 4)
            ->assertJsonCount(2, 'data.quotation_requests')
            ->assertJsonStructure(['data' => ['meta' => ['current_page', 'per_page', 'total', 'last_page']]]);

        $ids = collect($response->json('data.quotation_requests'))->pluck('id')->all();
        $this->assertSame([4, 3], $ids);

        $row = $response->json('data.quotation_requests.0');
        $this->assertSame(
            [
                'id',
                'quotation_number',
                'status',
                'customer_name',
                'phone',
                'city',
                'township',
                'item_count',
                'created_at',
                'current_quotation_id',
                'current_version',
                'current_status',
                'valid_until',
                'is_expired',
            ],
            array_keys($row),
        );
        $this->assertNull($row['current_quotation_id']);
        $this->assertNull($row['current_version']);
        $this->assertNull($row['current_status']);
        $this->assertNull($row['valid_until']);
        $this->assertFalse($row['is_expired']);

        $this->withToken($token)->getJson('/api/v1/customer/quotation-requests?per_page=101')
            ->assertUnprocessable();
    }
}
