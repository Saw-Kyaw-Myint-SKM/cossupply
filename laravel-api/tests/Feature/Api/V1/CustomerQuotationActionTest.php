<?php

namespace Tests\Feature\Api\V1;

use App\Enums\QuotationRequestStatus;
use App\Models\Admin;
use App\Models\Customer;
use App\Models\Product;
use App\Models\Quotation;
use App\Models\QuotationAction;
use App\Models\QuotationRequest;
use App\Models\QuotationVersionItem;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CustomerQuotationActionTest extends TestCase
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
     * A request with one sent current version and a matching line item.
     *
     * @param  array<string, mixed>  $requestAttributes
     * @param  array<string, mixed>  $quotationAttributes
     * @return array{0: QuotationRequest, 1: Quotation}
     */
    private function requestWithQuotation(
        Customer $customer,
        array $requestAttributes = [],
        array $quotationAttributes = [],
    ): array {
        $request = QuotationRequest::factory()->create(array_merge([
            'customer_id' => $customer->id,
            'status' => QuotationRequestStatus::QUOTATION_SENT->value,
        ], $requestAttributes));

        $quotation = Quotation::factory()
            ->sent()
            ->priced(20000, 1000, 500, 5)
            ->create(array_merge([
                'quotation_request_id' => $request->id,
                'quotation_number' => $request->quotation_number,
                'valid_until' => now()->addDays(7)->toDateString(),
            ], $quotationAttributes));

        $product = Product::factory()->create();

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

    public function test_guest_cannot_access_quotation_review_routes(): void
    {
        $this->getJson('/api/v1/customer/quotation-requests/1')->assertUnauthorized();
        $this->postJson('/api/v1/customer/quotations/1/accept')->assertUnauthorized();
        $this->postJson('/api/v1/customer/quotations/1/reject')->assertUnauthorized();
        $this->postJson('/api/v1/customer/quotations/1/request-change', ['customer_note' => 'Please revise.'])
            ->assertUnauthorized();
    }

    public function test_admin_token_cannot_access_quotation_review_routes(): void
    {
        $admin = Admin::factory()->create();
        $token = $admin->createToken('admin-token', ['admin'])->plainTextToken;

        $this->withToken($token)->getJson('/api/v1/customer/quotation-requests/1')->assertForbidden();
        $this->withToken($token)->postJson('/api/v1/customer/quotations/1/accept')->assertForbidden();
        $this->withToken($token)->postJson('/api/v1/customer/quotations/1/reject')->assertForbidden();
        $this->withToken($token)
            ->postJson('/api/v1/customer/quotations/1/request-change', ['customer_note' => 'Please revise.'])
            ->assertForbidden();
    }

    public function test_owner_can_open_detail_and_the_first_view_is_recorded(): void
    {
        [$customer, $token] = $this->authenticate();
        [$request, $quotation] = $this->requestWithQuotation($customer);

        $response = $this->withToken($token)->getJson(
            "/api/v1/customer/quotation-requests/{$request->id}",
        );

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.quotation_request.id', $request->id)
            ->assertJsonPath('data.quotation_request.status', 'CUSTOMER_REVIEWING')
            ->assertJsonPath('data.quotation_request.current_quotation.id', $quotation->id)
            ->assertJsonPath('data.quotation_request.current_quotation.status', 'VIEWED')
            ->assertJsonPath('data.quotation_request.current_quotation.is_current', true)
            ->assertJsonPath('data.quotation_request.current_quotation.version', 1)
            ->assertJsonPath('data.quotation_request.current_quotation.subtotal', 20000)
            ->assertJsonPath('data.quotation_request.current_quotation.discount', 1000)
            ->assertJsonPath('data.quotation_request.current_quotation.delivery_fee', 500)
            ->assertJsonPath('data.quotation_request.current_quotation.service_fee_percentage', 5)
            ->assertJsonPath('data.quotation_request.current_quotation.service_fee', 1000)
            ->assertJsonPath('data.quotation_request.current_quotation.total_amount', 20500)
            ->assertJsonPath('data.quotation_request.current_quotation.payment_method', 'CASH_ON_DELIVERY')
            ->assertJsonPath('data.quotation_request.current_quotation.items.0.quantity', 2)
            ->assertJsonPath('data.quotation_request.current_quotation.items.0.unit_price', 10000)
            ->assertJsonPath('data.quotation_request.current_quotation.items.0.line_total', 20000)
            ->assertJsonPath('data.quotation_request.can_accept', true)
            ->assertJsonPath('data.quotation_request.can_reject', true)
            ->assertJsonPath('data.quotation_request.can_request_change', true)
            ->assertJsonPath('data.quotation_request.is_expired', false)
            ->assertJsonCount(1, 'data.quotation_request.quotation_history')
            ->assertJsonPath('data.quotation_request.actions.0.action', 'VIEWED');

        $this->assertDatabaseHas('quotations', [
            'id' => $quotation->id,
            'status' => 'VIEWED',
            'is_current' => true,
        ]);
        $this->assertNotNull($quotation->refresh()->viewed_at);
        $this->assertSame('CUSTOMER_REVIEWING', $request->refresh()->status->value);

        $this->assertDatabaseHas('quotation_actions', [
            'quotation_id' => $quotation->id,
            'action' => 'VIEWED',
            'actor_type' => 'CUSTOMER',
            'actor_id' => $customer->id,
        ]);
        $this->assertSame(1, QuotationAction::query()->count());
    }

    public function test_repeat_views_do_not_duplicate_the_viewed_action(): void
    {
        [$customer, $token] = $this->authenticate();
        [$request, $quotation] = $this->requestWithQuotation($customer);

        $this->withToken($token)->getJson("/api/v1/customer/quotation-requests/{$request->id}")
            ->assertOk();
        $this->withToken($token)->getJson("/api/v1/customer/quotation-requests/{$request->id}")
            ->assertOk()
            ->assertJsonPath('data.quotation_request.current_quotation.status', 'VIEWED');

        $this->assertSame(1, QuotationAction::query()->where('quotation_id', $quotation->id)->count());
        $this->assertSame('VIEWED', $quotation->refresh()->status->value);
    }

    public function test_other_customers_cannot_read_or_act_on_a_quotation(): void
    {
        [$owner] = $this->authenticate();
        [$request, $quotation] = $this->requestWithQuotation($owner);

        [, $intruderToken] = $this->authenticate();

        $this->withToken($intruderToken)
            ->getJson("/api/v1/customer/quotation-requests/{$request->id}")
            ->assertNotFound();
        $this->withToken($intruderToken)
            ->postJson("/api/v1/customer/quotations/{$quotation->id}/accept")
            ->assertNotFound();
        $this->withToken($intruderToken)
            ->postJson("/api/v1/customer/quotations/{$quotation->id}/reject")
            ->assertNotFound();
        $this->withToken($intruderToken)
            ->postJson("/api/v1/customer/quotations/{$quotation->id}/request-change", [
                'customer_note' => 'I want to change this quotation.',
            ])
            ->assertNotFound();

        $this->assertSame('SENT', $quotation->refresh()->status->value);
        $this->assertSame(0, QuotationAction::query()->count());
    }

    public function test_unknown_quotation_ids_answer_404(): void
    {
        [, $token] = $this->authenticate();

        $this->withToken($token)
            ->getJson('/api/v1/customer/quotation-requests/999999')
            ->assertNotFound();
        $this->withToken($token)
            ->postJson('/api/v1/customer/quotations/999999/accept')
            ->assertNotFound();
        $this->withToken($token)
            ->getJson('/api/v1/customer/quotation-requests/not-a-number')
            ->assertNotFound();
    }

    public function test_detail_shows_an_empty_current_quotation_before_admin_sends_one(): void
    {
        [$customer, $token] = $this->authenticate();
        $request = QuotationRequest::factory()->create([
            'customer_id' => $customer->id,
            'status' => QuotationRequestStatus::PREPARING_QUOTATION->value,
        ]);

        $this->withToken($token)->getJson("/api/v1/customer/quotation-requests/{$request->id}")
            ->assertOk()
            ->assertJsonPath('data.quotation_request.current_quotation', null)
            ->assertJsonPath('data.quotation_request.can_accept', false)
            ->assertJsonPath('data.quotation_request.can_reject', false)
            ->assertJsonPath('data.quotation_request.can_request_change', false)
            ->assertJsonPath('data.quotation_request.is_expired', false)
            ->assertJsonCount(0, 'data.quotation_request.quotation_history');

        $this->assertSame(0, QuotationAction::query()->count());
    }

    public function test_customer_can_accept_the_current_quotation(): void
    {
        [$customer, $token] = $this->authenticate();
        [$request, $quotation] = $this->requestWithQuotation($customer);

        $response = $this->withToken($token)
            ->postJson("/api/v1/customer/quotations/{$quotation->id}/accept");

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.quotation.id', $quotation->id)
            ->assertJsonPath('data.quotation.status', 'ACCEPTED')
            ->assertJsonPath('data.quotation_request.id', $request->id)
            ->assertJsonPath('data.quotation_request.status', 'ACCEPTED');

        $this->assertSame('ACCEPTED', $quotation->refresh()->status->value);
        $this->assertNotNull($quotation->accepted_at);
        $this->assertSame('ACCEPTED', $request->refresh()->status->value);

        $this->assertDatabaseHas('quotation_actions', [
            'quotation_id' => $quotation->id,
            'action' => 'ACCEPTED',
            'actor_type' => 'CUSTOMER',
            'actor_id' => $customer->id,
        ]);
    }

    public function test_quotation_cannot_be_accepted_twice(): void
    {
        [$customer, $token] = $this->authenticate();
        [, $quotation] = $this->requestWithQuotation($customer);

        $this->withToken($token)
            ->postJson("/api/v1/customer/quotations/{$quotation->id}/accept")
            ->assertOk();

        $this->withToken($token)
            ->postJson("/api/v1/customer/quotations/{$quotation->id}/accept")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['quotation']);

        $this->assertSame(1, QuotationAction::query()->where('action', 'ACCEPTED')->count());
    }

    public function test_superseded_quotation_cannot_be_accepted(): void
    {
        [$customer, $token] = $this->authenticate();
        [, $superseded] = $this->requestWithQuotation($customer, [], [
            'status' => 'SUPERSEDED',
            'is_current' => false,
        ]);

        $this->withToken($token)
            ->postJson("/api/v1/customer/quotations/{$superseded->id}/accept")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['quotation']);

        $this->assertSame('SUPERSEDED', $superseded->refresh()->status->value);
        $this->assertSame(0, QuotationAction::query()->count());
    }

    public function test_expired_quotation_cannot_be_accepted_and_is_marked_expired(): void
    {
        [$customer, $token] = $this->authenticate();
        [$request, $quotation] = $this->requestWithQuotation($customer, [], [
            'valid_until' => now()->subDay()->toDateString(),
        ]);

        $this->withToken($token)
            ->postJson("/api/v1/customer/quotations/{$quotation->id}/accept")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['quotation']);

        $this->assertSame('EXPIRED', $quotation->refresh()->status->value);
        $this->assertSame('EXPIRED', $request->refresh()->status->value);

        $detail = $this->withToken($token)
            ->getJson("/api/v1/customer/quotation-requests/{$request->id}");

        $detail->assertOk()
            ->assertJsonPath('data.quotation_request.is_expired', true)
            ->assertJsonPath('data.quotation_request.can_accept', false)
            ->assertJsonPath('data.quotation_request.current_quotation.status', 'EXPIRED');
    }

    public function test_customer_can_reject_with_an_optional_note(): void
    {
        [$customer, $token] = $this->authenticate();
        [$request, $quotation] = $this->requestWithQuotation($customer);

        $this->withToken($token)
            ->postJson("/api/v1/customer/quotations/{$quotation->id}/reject", [
                'customer_note' => 'The price is above our budget.',
            ])
            ->assertOk()
            ->assertJsonPath('data.quotation.status', 'REJECTED')
            ->assertJsonPath('data.quotation_request.status', 'REJECTED');

        $this->assertSame('REJECTED', $request->refresh()->status->value);
        $this->assertNotNull($quotation->refresh()->rejected_at);

        $this->assertDatabaseHas('quotation_actions', [
            'quotation_id' => $quotation->id,
            'action' => 'REJECTED',
            'customer_note' => 'The price is above our budget.',
            'actor_id' => $customer->id,
        ]);
    }

    public function test_change_request_requires_a_meaningful_note(): void
    {
        [$customer, $token] = $this->authenticate();
        [, $quotation] = $this->requestWithQuotation($customer);

        $this->withToken($token)
            ->postJson("/api/v1/customer/quotations/{$quotation->id}/request-change", [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['customer_note']);

        $this->withToken($token)
            ->postJson("/api/v1/customer/quotations/{$quotation->id}/request-change", [
                'customer_note' => 'abc',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['customer_note']);

        $this->assertSame('SENT', $quotation->refresh()->status->value);
    }

    public function test_change_request_moves_quotation_and_request_to_change_requested(): void
    {
        [$customer, $token] = $this->authenticate();
        [$request, $quotation] = $this->requestWithQuotation($customer);

        $note = '  Please reduce the delivery fee and confirm the warranty.  ';

        $this->withToken($token)
            ->postJson("/api/v1/customer/quotations/{$quotation->id}/request-change", [
                'customer_note' => $note,
            ])
            ->assertOk()
            ->assertJsonPath('data.quotation.status', 'CHANGE_REQUESTED')
            ->assertJsonPath('data.quotation_request.status', 'CHANGE_REQUESTED');

        $this->assertSame('CHANGE_REQUESTED', $quotation->refresh()->status->value);
        $this->assertSame('CHANGE_REQUESTED', $request->refresh()->status->value);

        $this->assertDatabaseHas('quotation_actions', [
            'quotation_id' => $quotation->id,
            'action' => 'REQUESTED_CHANGE',
            'customer_note' => 'Please reduce the delivery fee and confirm the warranty.',
            'actor_id' => $customer->id,
        ]);
    }

    public function test_accepted_quotation_no_longer_accepts_a_change_request(): void
    {
        [$customer, $token] = $this->authenticate();
        [, $quotation] = $this->requestWithQuotation($customer);

        $this->withToken($token)
            ->postJson("/api/v1/customer/quotations/{$quotation->id}/accept")
            ->assertOk();

        $this->withToken($token)
            ->postJson("/api/v1/customer/quotations/{$quotation->id}/request-change", [
                'customer_note' => 'Please add another chair to the order.',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['quotation']);

        $this->assertSame('ACCEPTED', $quotation->refresh()->status->value);
    }

    public function test_list_includes_the_current_quotation_summary(): void
    {
        [$customer, $token] = $this->authenticate();
        [$request, $quotation] = $this->requestWithQuotation($customer);

        $response = $this->withToken($token)->getJson('/api/v1/customer/quotation-requests');

        $response->assertOk()
            ->assertJsonPath('data.quotation_requests.0.id', $request->id)
            ->assertJsonPath('data.quotation_requests.0.current_quotation.id', $quotation->id)
            ->assertJsonPath('data.quotation_requests.0.current_quotation.version', 1)
            ->assertJsonPath('data.quotation_requests.0.current_quotation.status', 'SENT')
            ->assertJsonPath('data.quotation_requests.0.current_quotation.total_amount', 20500)
            ->assertJsonPath(
                'data.quotation_requests.0.current_quotation.valid_until',
                now()->addDays(7)->toDateString(),
            );
    }
}
