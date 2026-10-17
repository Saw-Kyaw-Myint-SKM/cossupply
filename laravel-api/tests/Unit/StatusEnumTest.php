<?php

namespace Tests\Unit;

use App\Enums\DeliveryStatus;
use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Enums\ProductStatus;
use App\Enums\QuotationAction;
use App\Enums\QuotationRequestStatus;
use App\Enums\QuotationVersionStatus;
use App\Enums\StockStatus;
use App\Enums\SupplierStatus;
use PHPUnit\Framework\TestCase;

class StatusEnumTest extends TestCase
{
    public function test_supplier_status_values_match_the_specification(): void
    {
        $this->assertSame(['ACTIVE', 'INACTIVE', 'SUSPENDED'], SupplierStatus::values());
    }

    public function test_product_status_values_match_the_specification(): void
    {
        $this->assertSame(['DRAFT', 'PUBLISHED', 'HIDDEN', 'OUT_OF_STOCK'], ProductStatus::values());
    }

    public function test_stock_status_values_match_the_specification(): void
    {
        $this->assertSame([
            'IN_STOCK',
            'LOW_STOCK',
            'OUT_OF_STOCK',
            'PRE_ORDER',
            'SUPPLIER_CONFIRMATION_REQUIRED',
        ], StockStatus::values());
    }

    public function test_quotation_request_status_values_match_the_specification(): void
    {
        $this->assertSame([
            'NEW',
            'CONTACTING_SUPPLIER',
            'SUPPLIER_RESPONSE_PENDING',
            'PREPARING_QUOTATION',
            'QUOTATION_SENT',
            'CUSTOMER_REVIEWING',
            'CHANGE_REQUESTED',
            'ACCEPTED',
            'REJECTED',
            'EXPIRED',
            'CANCELLED',
        ], QuotationRequestStatus::values());
    }

    public function test_quotation_version_status_values_match_the_specification(): void
    {
        $this->assertSame([
            'DRAFT',
            'SENT',
            'VIEWED',
            'CHANGE_REQUESTED',
            'ACCEPTED',
            'REJECTED',
            'EXPIRED',
            'SUPERSEDED',
            'CANCELLED',
        ], QuotationVersionStatus::values());
    }

    public function test_quotation_action_values_match_the_specification(): void
    {
        $this->assertSame([
            'VIEWED',
            'ACCEPTED',
            'REJECTED',
            'REQUESTED_CHANGE',
        ], QuotationAction::values());
    }

    public function test_order_status_values_match_the_specification(): void
    {
        $this->assertSame([
            'SUPPLIER_CONFIRMATION_REQUIRED',
            'ORDER_CONFIRMED',
            'PREPARING',
            'READY_TO_SHIP',
            'OUT_FOR_DELIVERY',
            'DELIVERED',
            'COMPLETED',
            'SUPPLIER_UNAVAILABLE',
            'DELIVERY_FAILED',
            'RETURNED',
            'CANCELLED',
        ], OrderStatus::values());
    }

    public function test_payment_status_values_match_the_specification(): void
    {
        $this->assertSame([
            'NOT_PAID',
            'CASH_COLLECTION_PENDING',
            'CASH_COLLECTED',
            'PAYMENT_CONFIRMED',
            'PAYMENT_FAILED',
            'CUSTOMER_REFUSED_TO_PAY',
        ], PaymentStatus::values());
    }

    public function test_delivery_status_values_match_the_specification(): void
    {
        $this->assertSame([
            'NOT_ASSIGNED',
            'PREPARING',
            'OUT_FOR_DELIVERY',
            'DELIVERED',
            'DELIVERY_FAILED',
            'RETURNED',
        ], DeliveryStatus::values());
    }
}
