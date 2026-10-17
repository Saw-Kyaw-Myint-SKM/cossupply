<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Quotation;
use App\Models\QuotationRequest;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DatabaseConstraintsTest extends TestCase
{
    use RefreshDatabase;

    public function test_quotation_requests_cannot_be_created_without_a_customer(): void
    {
        $this->expectException(QueryException::class);

        QuotationRequest::factory()->create(['customer_id' => null]);
    }

    public function test_orders_cannot_be_created_without_a_customer(): void
    {
        $this->expectException(QueryException::class);

        Order::factory()->create(['customer_id' => null]);
    }

    public function test_orders_quotation_id_must_be_unique(): void
    {
        $order = Order::factory()->create();

        $this->expectException(QueryException::class);

        Order::factory()->create([
            'quotation_id' => $order->quotation_id,
        ]);
    }

    public function test_quotation_version_is_unique_per_quotation_request(): void
    {
        $quotationRequest = QuotationRequest::factory()->create();

        Quotation::factory()->create([
            'quotation_request_id' => $quotationRequest->id,
            'version' => 1,
        ]);

        $this->expectException(QueryException::class);

        Quotation::factory()->create([
            'quotation_request_id' => $quotationRequest->id,
            'version' => 1,
        ]);
    }

    public function test_different_quotation_versions_are_allowed_for_the_same_request(): void
    {
        $quotationRequest = QuotationRequest::factory()->create();

        Quotation::factory()->create([
            'quotation_request_id' => $quotationRequest->id,
            'version' => 1,
        ]);

        $second = Quotation::factory()->create([
            'quotation_request_id' => $quotationRequest->id,
            'version' => 2,
        ]);

        $this->assertDatabaseHas('quotations', [
            'id' => $second->id,
            'quotation_request_id' => $quotationRequest->id,
            'version' => 2,
        ]);
    }
}
