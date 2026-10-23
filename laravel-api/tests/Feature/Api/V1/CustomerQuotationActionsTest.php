<?php

namespace Tests\Feature\Api\V1;

use App\Models\Admin;
use App\Models\Category;
use App\Models\Customer;
use App\Models\Product;
use App\Models\Quotation;
use App\Models\QuotationAction;
use App\Models\QuotationItem;
use App\Models\QuotationRequest;
use App\Models\QuotationVersionItem;
use App\Models\Supplier;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CustomerQuotationActionsTest extends TestCase
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

    private function adminToken(Admin $admin): string
    {
        return $admin->createToken('admin-token', ['admin'])->plainTextToken;
    }

    /**
     * A customer-owned request with one priced quotation version.
     *
     * @return array{
     *     admin: Admin,
     *     customer: Customer,
     *     product: Product,
     *     request: QuotationRequest,
     *     quotation: Quotation
     * }
     */
    private function makeQuotation(
        string $requestStatus = 'QUOTATION_SENT',
        string $versionStatus = 'SENT',
        bool $isCurrent = true,
        ?string $validUntil = null,
        ?string $deliveryDate = null,
        ?Customer $customer = null,
    ): array {
        $admin = Admin::factory()->create();
        $customer ??= Customer::factory()->create();

        $supplier = Supplier::factory()->create();
        $product = Product::factory()
            ->for($supplier)
            ->for(Category::factory())
            ->published()
            ->withPrice(['retail_price' => 10000])
            ->create();

        $request = QuotationRequest::factory()
            ->for($customer)
            ->create(['status' => $requestStatus]);

        QuotationItem::factory()
            ->forRequest($request)
            ->forProduct($product)
            ->create(['quantity' => 2, 'display_price' => 10000]);

        $quotation = Quotation::factory()
            ->for($request)
            ->priced(20000)
            ->create([
                'version' => 1,
                'status' => $versionStatus,
                'is_current' => $isCurrent,
                'valid_until' => $validUntil ?? now()->addDays(5)->toDateString(),
                'sent_at' => $versionStatus === 'DRAFT' ? null : now(),
                'created_by_admin_id' => $admin->id,
            ]);

        QuotationVersionItem::factory()
            ->forQuotation($quotation)
            ->forProduct($product)
            ->create([
                'quantity' => 2,
                'unit_price' => 10000,
                'discount' => 0,
                'line_total' => 20000,
                'delivery_date' => $deliveryDate,
            ]);

        return compact('admin', 'customer', 'product', 'request', 'quotation');
    }

    /**
     * Add an additional quotation version to an existing fixture.
     *
     * @param  array{product: Product, request: QuotationRequest, admin: Admin}  $fixture
     */
    private function addVersion(
        array $fixture,
        int $version,
        string $status = 'SENT',
        bool $isCurrent = true,
        ?string $validUntil = null,
        ?string $deliveryDate = null,
    ): Quotation {
        $quotation = Quotation::factory()
            ->for($fixture['request'])
            ->priced(20000)
            ->create([
                'version' => $version,
                'status' => $status,
                'is_current' => $isCurrent,
                'valid_until' => $validUntil ?? now()->addDays(5)->toDateString(),
                'sent_at' => now(),
                'created_by_admin_id' => $fixture['admin']->id,
            ]);

        QuotationVersionItem::factory()
            ->forQuotation($quotation)
            ->forProduct($fixture['product'])
            ->create([
                'quantity' => 2,
                'unit_price' => 10000,
                'discount' => 0,
                'line_total' => 20000,
                'delivery_date' => $deliveryDate,
            ]);

        return $quotation;
    }

    public function test_guest_cannot_access_any_customer_quotation_action_endpoint(): void
    {
        $fixture = $this->makeQuotation();
        $requestId = $fixture['request']->id;
        $quotationId = $fixture['quotation']->id;

        $this->getJson("/api/v1/customer/quotation-requests/{$requestId}")->assertUnauthorized();
        $this->postJson("/api/v1/customer/quotation-requests/{$requestId}/view")->assertUnauthorized();
        $this->postJson("/api/v1/customer/quotations/{$quotationId}/accept", [
            'cod_terms_accepted' => true,
        ])->assertUnauthorized();
        $this->postJson("/api/v1/customer/quotations/{$quotationId}/reject")->assertUnauthorized();
        $this->postJson("/api/v1/customer/quotations/{$quotationId}/change-request", [
            'customer_note' => 'Please revise.',
        ])->assertUnauthorized();
    }

    public function test_admin_token_cannot_access_customer_quotation_action_endpoints(): void
    {
        $fixture = $this->makeQuotation();
        $token = $this->adminToken($fixture['admin']);
        $requestId = $fixture['request']->id;
        $quotationId = $fixture['quotation']->id;

        $this->withToken($token)
            ->getJson("/api/v1/customer/quotation-requests/{$requestId}")
            ->assertForbidden();
        $this->withToken($token)
            ->postJson("/api/v1/customer/quotation-requests/{$requestId}/view")
            ->assertForbidden();
        $this->withToken($token)
            ->postJson("/api/v1/customer/quotations/{$quotationId}/accept", [
                'cod_terms_accepted' => true,
            ])
            ->assertForbidden();
        $this->withToken($token)
            ->postJson("/api/v1/customer/quotations/{$quotationId}/reject")
            ->assertForbidden();
        $this->withToken($token)
            ->postJson("/api/v1/customer/quotations/{$quotationId}/change-request", [
                'customer_note' => 'Please revise.',
            ])
            ->assertForbidden();
    }

    public function test_customer_cannot_access_another_customers_request_or_quotation(): void
    {
        $fixture = $this->makeQuotation();
        [$intruder, $token] = $this->authenticate();
        $requestId = $fixture['request']->id;
        $quotationId = $fixture['quotation']->id;

        $this->withToken($token)
            ->getJson("/api/v1/customer/quotation-requests/{$requestId}")
            ->assertNotFound();
        $this->withToken($token)
            ->postJson("/api/v1/customer/quotation-requests/{$requestId}/view")
            ->assertNotFound();
        $this->withToken($token)
            ->postJson("/api/v1/customer/quotations/{$quotationId}/accept", [
                'cod_terms_accepted' => true,
            ])
            ->assertNotFound();
        $this->withToken($token)
            ->postJson("/api/v1/customer/quotations/{$quotationId}/reject")
            ->assertNotFound();
        $this->withToken($token)
            ->postJson("/api/v1/customer/quotations/{$quotationId}/change-request", [
                'customer_note' => 'Please revise.',
            ])
            ->assertNotFound();

        $this->assertDatabaseCount('quotation_actions', 0);
    }

    public function test_detail_returns_versions_newest_first_with_items_and_flags_without_writing_actions(): void
    {
        $fixture = $this->makeQuotation(
            requestStatus: 'QUOTATION_SENT',
            versionStatus: 'SUPERSEDED',
            isCurrent: false,
            deliveryDate: now()->addDays(3)->toDateString(),
        );
        $current = $this->addVersion(
            $fixture,
            2,
            'SENT',
            true,
            deliveryDate: now()->addDays(3)->toDateString(),
        );
        [, $token] = $this->authenticate($fixture['customer']);

        $response = $this->withToken($token)
            ->getJson("/api/v1/customer/quotation-requests/{$fixture['request']->id}")
            ->assertOk()
            ->assertJsonPath('data.quotation_request.status', 'QUOTATION_SENT')
            ->assertJsonPath('data.quotation_request.customer_name', $fixture['request']->customer_name)
            ->assertJsonPath('data.quotation_request.city', $fixture['request']->city)
            ->assertJsonPath('data.quotation_request.current_quotation_id', $current->id)
            ->assertJsonPath('data.quotation_request.is_expired', false)
            ->assertJsonPath('data.quotation_request.can_accept', true)
            ->assertJsonPath('data.quotation_request.can_reject', true)
            ->assertJsonPath('data.quotation_request.can_request_change', true)
            ->assertJsonPath('data.quotation_request.items.0.quantity', 2)
            ->assertJsonPath('data.quotation_request.items.0.display_price', 10000)
            ->assertJsonPath('data.quotation_request.versions.0.id', $current->id)
            ->assertJsonPath('data.quotation_request.versions.0.version', 2)
            ->assertJsonPath('data.quotation_request.versions.0.status', 'SENT')
            ->assertJsonPath('data.quotation_request.versions.0.subtotal', 20000)
            ->assertJsonPath('data.quotation_request.versions.0.total_amount', 20000)
            ->assertJsonPath('data.quotation_request.versions.0.delivery_date', now()->addDays(3)->toDateString())
            ->assertJsonPath('data.quotation_request.versions.0.cod_terms', 'Full payment on delivery (COD).')
            ->assertJsonPath('data.quotation_request.versions.0.items.0.line_total', 20000)
            ->assertJsonPath('data.quotation_request.versions.1.version', 1)
            ->assertJsonPath('data.quotation_request.versions.1.status', 'SUPERSEDED');

        $this->assertArrayHasKey('actions', $response->json('data.quotation_request.versions.0'));
        $this->assertDatabaseCount('quotation_actions', 0);
    }

    public function test_detail_exposes_the_created_order_after_accept_to_the_owner_only(): void
    {
        $fixture = $this->makeQuotation();
        [$customer, $token] = $this->authenticate($fixture['customer']);
        $detailUrl = "/api/v1/customer/quotation-requests/{$fixture['request']->id}";

        $this->withToken($token)
            ->getJson($detailUrl)
            ->assertOk()
            ->assertJsonPath('data.quotation_request.order', null);

        $accepted = $this->withToken($token)
            ->postJson("/api/v1/customer/quotations/{$fixture['quotation']->id}/accept", [
                'cod_terms_accepted' => true,
            ])
            ->assertOk();

        $order = $accepted->json('data.order');
        $this->assertNotNull($order['id']);

        $this->withToken($token)
            ->getJson($detailUrl)
            ->assertOk()
            ->assertJsonPath('data.quotation_request.order.id', $order['id'])
            ->assertJsonPath('data.quotation_request.order.order_number', $order['order_number'])
            ->assertJsonPath('data.quotation_request.order.order_status', $order['order_status'])
            ->assertJsonPath('data.quotation_request.order.payment_status', $order['payment_status'])
            ->assertJsonPath('data.quotation_request.order.delivery_status', $order['delivery_status'])
            ->assertJsonPath('data.quotation_request.order.total_amount', $order['total_amount'])
            ->assertJsonPath('data.quotation_request.order.created_at', $order['created_at']);

        $this->assertDatabaseHas('orders', [
            'id' => $order['id'],
            'customer_id' => $customer->id,
            'quotation_id' => $fixture['quotation']->id,
        ]);

        // Another customer still gets the ownership 404 and no order data.
        [, $intruderToken] = $this->authenticate();

        $this->withToken($intruderToken)
            ->getJson($detailUrl)
            ->assertNotFound()
            ->assertJsonPath('success', false)
            ->assertJsonMissingPath('data.quotation_request.order');
    }

    public function test_detail_order_is_null_for_a_request_without_a_current_quotation(): void
    {
        $customer = Customer::factory()->create();
        $request = QuotationRequest::factory()->for($customer)->create();
        [, $token] = $this->authenticate($customer);

        $this->withToken($token)
            ->getJson("/api/v1/customer/quotation-requests/{$request->id}")
            ->assertOk()
            ->assertJsonPath('data.quotation_request.order', null)
            ->assertJsonCount(0, 'data.quotation_request.versions');
    }

    public function test_view_moves_sent_to_viewed_and_records_exactly_one_action(): void
    {
        $fixture = $this->makeQuotation();
        [, $token] = $this->authenticate($fixture['customer']);

        $this->withToken($token)
            ->postJson("/api/v1/customer/quotation-requests/{$fixture['request']->id}/view")
            ->assertOk()
            ->assertJsonPath('data.quotation_request.status', 'CUSTOMER_REVIEWING')
            ->assertJsonPath('data.quotation_request.versions.0.status', 'VIEWED')
            ->assertJsonPath('data.quotation_request.versions.0.actions.0.action', 'VIEWED')
            ->assertJsonPath('data.quotation_request.versions.0.actions.0.actor_type', 'CUSTOMER')
            ->assertJsonPath('data.quotation_request.versions.0.actions.0.actor_id', $fixture['customer']->id);

        $this->assertDatabaseHas('quotations', [
            'id' => $fixture['quotation']->id,
            'status' => 'VIEWED',
        ]);
        $this->assertDatabaseHas('quotation_requests', [
            'id' => $fixture['request']->id,
            'status' => 'CUSTOMER_REVIEWING',
        ]);
        $this->assertDatabaseCount('quotation_actions', 1);

        $action = QuotationAction::query()->sole();
        $this->assertNotNull($action->created_at);

        // Repeat calls are idempotent and never duplicate the VIEWED row.
        $this->withToken($token)
            ->postJson("/api/v1/customer/quotation-requests/{$fixture['request']->id}/view")
            ->assertOk();

        $this->assertDatabaseCount('quotation_actions', 1);
    }

    public function test_view_does_not_regress_an_already_newer_request_status(): void
    {
        $fixture = $this->makeQuotation(
            requestStatus: 'CUSTOMER_REVIEWING',
            versionStatus: 'SENT',
        );
        [, $token] = $this->authenticate($fixture['customer']);

        $this->withToken($token)
            ->postJson("/api/v1/customer/quotation-requests/{$fixture['request']->id}/view")
            ->assertOk()
            ->assertJsonPath('data.quotation_request.status', 'CUSTOMER_REVIEWING')
            ->assertJsonPath('data.quotation_request.versions.0.status', 'VIEWED');

        $this->assertDatabaseHas('quotation_requests', [
            'id' => $fixture['request']->id,
            'status' => 'CUSTOMER_REVIEWING',
        ]);
    }

    public function test_expired_quotation_is_persisted_on_view_and_actions_return_conflict(): void
    {
        $fixture = $this->makeQuotation(
            requestStatus: 'QUOTATION_SENT',
            versionStatus: 'SENT',
            isCurrent: true,
            validUntil: now()->subDay()->toDateString(),
        );
        [, $token] = $this->authenticate($fixture['customer']);
        $requestId = $fixture['request']->id;
        $quotationId = $fixture['quotation']->id;

        // GET is side-effect free but reports the effective expiry.
        $this->withToken($token)
            ->getJson("/api/v1/customer/quotation-requests/{$requestId}")
            ->assertOk()
            ->assertJsonPath('data.quotation_request.is_expired', true)
            ->assertJsonPath('data.quotation_request.can_accept', false)
            ->assertJsonPath('data.quotation_request.can_reject', false)
            ->assertJsonPath('data.quotation_request.can_request_change', false)
            ->assertJsonPath('data.quotation_request.status', 'QUOTATION_SENT')
            ->assertJsonPath('data.quotation_request.versions.0.status', 'SENT');

        $this->assertDatabaseHas('quotation_requests', ['id' => $requestId, 'status' => 'QUOTATION_SENT']);

        // The explicit view lazily persists EXPIRED for version and request.
        $this->withToken($token)
            ->postJson("/api/v1/customer/quotation-requests/{$requestId}/view")
            ->assertOk()
            ->assertJsonPath('data.quotation_request.status', 'EXPIRED')
            ->assertJsonPath('data.quotation_request.is_expired', true)
            ->assertJsonPath('data.quotation_request.can_accept', false)
            ->assertJsonPath('data.quotation_request.versions.0.status', 'EXPIRED');

        $this->assertDatabaseHas('quotations', ['id' => $quotationId, 'status' => 'EXPIRED']);
        $this->assertDatabaseHas('quotation_requests', ['id' => $requestId, 'status' => 'EXPIRED']);
        $this->assertDatabaseCount('quotation_actions', 0);

        $this->withToken($token)
            ->postJson("/api/v1/customer/quotations/{$quotationId}/accept", [
                'cod_terms_accepted' => true,
            ])
            ->assertStatus(409)
            ->assertJsonPath('success', false)
            ->assertJsonPath('message', 'This quotation has expired.');

        $this->withToken($token)
            ->postJson("/api/v1/customer/quotations/{$quotationId}/reject")
            ->assertStatus(409)
            ->assertJsonPath('message', 'This quotation has expired.');

        $this->withToken($token)
            ->postJson("/api/v1/customer/quotations/{$quotationId}/change-request", [
                'customer_note' => 'Please revise.',
            ])
            ->assertStatus(409)
            ->assertJsonPath('message', 'This quotation has expired.');

        $this->assertDatabaseCount('quotation_actions', 0);
    }

    public function test_accept_requires_cod_acknowledgement_and_records_one_action(): void
    {
        $fixture = $this->makeQuotation();
        [, $token] = $this->authenticate($fixture['customer']);
        $quotationId = $fixture['quotation']->id;

        $this->withToken($token)
            ->postJson("/api/v1/customer/quotations/{$quotationId}/accept")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['cod_terms_accepted']);

        $this->withToken($token)
            ->postJson("/api/v1/customer/quotations/{$quotationId}/accept", [
                'cod_terms_accepted' => false,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['cod_terms_accepted']);

        $response = $this->withToken($token)
            ->postJson("/api/v1/customer/quotations/{$quotationId}/accept", [
                'cod_terms_accepted' => true,
            ])
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('message', 'Quotation accepted.')
            ->assertJsonPath('data.quotation.id', $quotationId)
            ->assertJsonPath('data.quotation.version', 1)
            ->assertJsonPath('data.quotation.status', 'ACCEPTED')
            ->assertJsonPath('data.quotation.total_amount', 20000)
            ->assertJsonPath('data.quotation.valid_until', $fixture['quotation']->valid_until->toDateString())
            ->assertJsonPath('data.request.id', $fixture['request']->id)
            ->assertJsonPath('data.request.quotation_number', $fixture['request']->quotation_number)
            ->assertJsonPath('data.request.status', 'ACCEPTED')
            ->assertJsonPath('data.order.order_status', 'SUPPLIER_CONFIRMATION_REQUIRED')
            ->assertJsonPath('data.order.payment_status', 'NOT_PAID')
            ->assertJsonPath('data.order.delivery_status', 'NOT_ASSIGNED')
            ->assertJsonPath('data.order.total_amount', 20000);

        $this->assertArrayHasKey('order', $response->json('data'));
        $this->assertNotNull($response->json('data.order.id'));
        $this->assertStringStartsWith('ORD-', $response->json('data.order.order_number'));

        $this->assertDatabaseHas('quotations', [
            'id' => $quotationId,
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
        $this->assertSame($fixture['customer']->id, $action->actor_id);
        $this->assertNotNull($action->ip_address);

        // Task 09 converts the accepted version into one order with its
        // delivery, COD payment and opening status history.
        $this->assertDatabaseHas('orders', [
            'id' => $response->json('data.order.id'),
            'quotation_id' => $quotationId,
            'customer_id' => $fixture['customer']->id,
            'order_status' => 'SUPPLIER_CONFIRMATION_REQUIRED',
            'payment_status' => 'NOT_PAID',
            'delivery_status' => 'NOT_ASSIGNED',
        ]);
        $this->assertDatabaseCount('orders', 1);
        $this->assertDatabaseCount('order_items', 1);
        $this->assertDatabaseCount('deliveries', 1);
        $this->assertDatabaseCount('cash_payments', 1);
        $this->assertDatabaseCount('order_status_histories', 1);
    }

    public function test_accept_rejects_non_current_superseded_settled_and_non_review_quotations(): void
    {
        $scenarios = [
            ['isCurrent' => false, 'versionStatus' => 'SENT', 'requestStatus' => 'QUOTATION_SENT'],
            ['isCurrent' => true, 'versionStatus' => 'SUPERSEDED', 'requestStatus' => 'QUOTATION_SENT'],
            ['isCurrent' => true, 'versionStatus' => 'REJECTED', 'requestStatus' => 'QUOTATION_SENT'],
            ['isCurrent' => true, 'versionStatus' => 'CANCELLED', 'requestStatus' => 'QUOTATION_SENT'],
            ['isCurrent' => true, 'versionStatus' => 'SENT', 'requestStatus' => 'PREPARING_QUOTATION'],
        ];

        foreach ($scenarios as $scenario) {
            $fixture = $this->makeQuotation(
                requestStatus: $scenario['requestStatus'],
                versionStatus: $scenario['versionStatus'],
                isCurrent: $scenario['isCurrent'],
            );
            [, $token] = $this->authenticate($fixture['customer']);

            $this->withToken($token)
                ->postJson("/api/v1/customer/quotations/{$fixture['quotation']->id}/accept", [
                    'cod_terms_accepted' => true,
                ])
                ->assertStatus(409)
                ->assertJsonPath('success', false);

            $this->assertDatabaseHas('quotations', [
                'id' => $fixture['quotation']->id,
                'status' => $scenario['versionStatus'],
                'is_current' => $scenario['isCurrent'],
            ]);
            $this->assertDatabaseHas('quotation_requests', [
                'id' => $fixture['request']->id,
                'status' => $scenario['requestStatus'],
            ]);
        }

        $this->assertDatabaseCount('quotation_actions', 0);
    }

    public function test_reject_stores_optional_note_and_makes_the_request_terminal(): void
    {
        $fixture = $this->makeQuotation();
        [, $token] = $this->authenticate($fixture['customer']);
        $quotationId = $fixture['quotation']->id;

        $this->withToken($token)
            ->postJson("/api/v1/customer/quotations/{$quotationId}/reject", [
                'customer_note' => 'Price is too high for this quantity.',
            ])
            ->assertOk()
            ->assertJsonPath('message', 'Quotation rejected.')
            ->assertJsonPath('data.quotation.status', 'REJECTED')
            ->assertJsonPath('data.request.status', 'REJECTED');

        $this->assertDatabaseHas('quotation_actions', [
            'quotation_id' => $quotationId,
            'action' => 'REJECTED',
            'customer_note' => 'Price is too high for this quantity.',
            'actor_type' => 'CUSTOMER',
            'actor_id' => $fixture['customer']->id,
        ]);

        // A terminal request cannot be accepted afterwards.
        $this->withToken($token)
            ->postJson("/api/v1/customer/quotations/{$quotationId}/accept", [
                'cod_terms_accepted' => true,
            ])
            ->assertStatus(409);

        $this->assertDatabaseCount('quotation_actions', 1);
    }

    public function test_reject_note_is_optional(): void
    {
        $fixture = $this->makeQuotation();
        [, $token] = $this->authenticate($fixture['customer']);

        $this->withToken($token)
            ->postJson("/api/v1/customer/quotations/{$fixture['quotation']->id}/reject")
            ->assertOk()
            ->assertJsonPath('data.quotation.status', 'REJECTED');

        $this->assertDatabaseHas('quotation_actions', [
            'quotation_id' => $fixture['quotation']->id,
            'action' => 'REJECTED',
            'customer_note' => null,
        ]);
    }

    public function test_change_request_requires_a_note_and_allows_admin_to_create_a_new_version(): void
    {
        $fixture = $this->makeQuotation();
        [, $token] = $this->authenticate($fixture['customer']);
        $quotationId = $fixture['quotation']->id;

        $this->withToken($token)
            ->postJson("/api/v1/customer/quotations/{$quotationId}/change-request")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['customer_note']);

        $this->withToken($token)
            ->postJson("/api/v1/customer/quotations/{$quotationId}/change-request", [
                'customer_note' => 'Please reduce the quantity to one unit.',
            ])
            ->assertOk()
            ->assertJsonPath('message', 'Quotation change requested.')
            ->assertJsonPath('data.quotation.status', 'CHANGE_REQUESTED')
            ->assertJsonPath('data.request.status', 'CHANGE_REQUESTED');

        $this->assertDatabaseHas('quotation_actions', [
            'quotation_id' => $quotationId,
            'action' => 'REQUESTED_CHANGE',
            'customer_note' => 'Please reduce the quantity to one unit.',
            'actor_type' => 'CUSTOMER',
        ]);

        $this->withToken($this->adminToken($fixture['admin']))
            ->postJson("/api/v1/admin/quotation-requests/{$fixture['request']->id}/quotations", [
                'items' => [[
                    'product_id' => $fixture['product']->id,
                    'quantity' => 1,
                    'unit_price' => 10000,
                ]],
            ])
            ->assertCreated()
            ->assertJsonPath('data.quotation.status', 'DRAFT')
            ->assertJsonPath('data.quotation.version', 2);

        $this->assertDatabaseHas('quotation_requests', [
            'id' => $fixture['request']->id,
            'status' => 'PREPARING_QUOTATION',
        ]);

        // The new admin draft is not visible to the customer until it is sent.
        $this->withToken($token)
            ->getJson("/api/v1/customer/quotation-requests/{$fixture['request']->id}")
            ->assertOk()
            ->assertJsonCount(1, 'data.quotation_request.versions')
            ->assertJsonPath('data.quotation_request.versions.0.version', 1)
            ->assertJsonPath('data.quotation_request.versions.0.status', 'CHANGE_REQUESTED');
    }

    public function test_list_exposes_current_version_fields_for_sent_accepted_and_expired_requests(): void
    {
        $sent = $this->makeQuotation(requestStatus: 'QUOTATION_SENT', versionStatus: 'SENT');
        $accepted = $this->makeQuotation(requestStatus: 'ACCEPTED', versionStatus: 'ACCEPTED');
        $expired = $this->makeQuotation(
            requestStatus: 'QUOTATION_SENT',
            versionStatus: 'SENT',
            validUntil: now()->subDay()->toDateString(),
        );

        [, $token] = $this->authenticate($sent['customer']);
        $accepted['request']->update(['customer_id' => $sent['customer']->id]);
        $expired['request']->update(['customer_id' => $sent['customer']->id]);

        $response = $this->withToken($token)
            ->getJson('/api/v1/customer/quotation-requests')
            ->assertOk()
            ->assertJsonStructure([
                'success',
                'data' => [
                    'quotation_requests',
                    'meta' => ['current_page', 'per_page', 'total', 'last_page'],
                ],
            ]);

        $rows = collect($response->json('data.quotation_requests'))->keyBy('id');

        $this->assertSame($sent['quotation']->id, $rows[$sent['request']->id]['current_quotation_id']);
        $this->assertSame(1, $rows[$sent['request']->id]['current_version']);
        $this->assertSame('SENT', $rows[$sent['request']->id]['current_status']);
        $this->assertSame($sent['quotation']->valid_until->toDateString(), $rows[$sent['request']->id]['valid_until']);
        $this->assertFalse($rows[$sent['request']->id]['is_expired']);

        $this->assertSame('ACCEPTED', $rows[$accepted['request']->id]['current_status']);
        $this->assertFalse($rows[$accepted['request']->id]['is_expired']);

        $this->assertSame('SENT', $rows[$expired['request']->id]['current_status']);
        $this->assertTrue($rows[$expired['request']->id]['is_expired']);

        $this->assertSame(15, $response->json('data.meta.per_page'));
        $this->assertSame(3, $response->json('data.meta.total'));
    }

    public function test_two_sequential_accepts_produce_one_action_and_the_second_conflicts(): void
    {
        $fixture = $this->makeQuotation();
        [, $token] = $this->authenticate($fixture['customer']);
        $quotationId = $fixture['quotation']->id;

        $this->withToken($token)
            ->postJson("/api/v1/customer/quotations/{$quotationId}/accept", [
                'cod_terms_accepted' => true,
            ])
            ->assertOk();

        $this->withToken($token)
            ->postJson("/api/v1/customer/quotations/{$quotationId}/accept", [
                'cod_terms_accepted' => true,
            ])
            ->assertStatus(409);

        $this->assertDatabaseCount('quotation_actions', 1);
        $this->assertDatabaseHas('quotations', ['id' => $quotationId, 'status' => 'ACCEPTED']);
        $this->assertDatabaseHas('quotation_requests', [
            'id' => $fixture['request']->id,
            'status' => 'ACCEPTED',
        ]);
    }
}
