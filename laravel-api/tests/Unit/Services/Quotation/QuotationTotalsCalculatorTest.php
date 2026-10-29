<?php

namespace Tests\Unit\Services\Quotation;

use App\Services\Quotation\QuotationTotalsCalculator;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

/**
 * Task 12: the client never supplies totals; every money value below is
 * derived from quantity, unit price, discount, delivery fee and the
 * server-owned service fee percentage.
 */
class QuotationTotalsCalculatorTest extends TestCase
{
    private QuotationTotalsCalculator $calculator;

    protected function setUp(): void
    {
        parent::setUp();

        $this->calculator = new QuotationTotalsCalculator;
    }

    public function test_line_totals_subtotal_service_fee_and_total_are_derived(): void
    {
        $result = $this->calculator->calculate(
            [
                ['quantity' => 2, 'unit_price' => 10000, 'discount' => 500],
                ['quantity' => 1, 'unit_price' => 2500],
            ],
            discount: 1000,
            deliveryFee: 500,
            serviceFeePercentage: 5,
        );

        // Lines: 19500 + 2500 = 22000.
        $this->assertSame(22000, $result['subtotal']);
        $this->assertSame(1100, $result['service_fee']);
        // 22000 - 1000 + 500 + 1100.
        $this->assertSame(22600, $result['total_amount']);
        $this->assertSame(19500, $result['items'][0]['line_total']);
        $this->assertSame(0, $result['items'][1]['discount']);
    }

    public function test_service_fee_rounds_half_up_to_whole_kyat(): void
    {
        // 3333 * 5% = 166.65 → 167.
        $result = $this->calculator->calculate(
            [['quantity' => 1, 'unit_price' => 3333]],
            discount: 0,
            deliveryFee: 0,
            serviceFeePercentage: 5,
        );

        $this->assertSame(167, $result['service_fee']);
        $this->assertSame(3500, $result['total_amount']);
    }

    public function test_zero_service_fee_keeps_the_total_equal_to_subtotal_plus_delivery(): void
    {
        $result = $this->calculator->calculate(
            [['quantity' => 3, 'unit_price' => 1000]],
            discount: 500,
            deliveryFee: 1000,
            serviceFeePercentage: 0,
        );

        $this->assertSame(0, $result['service_fee']);
        $this->assertSame(3500, $result['total_amount']);
    }

    public function test_empty_items_are_rejected(): void
    {
        $this->expectException(InvalidArgumentException::class);

        $this->calculator->calculate([], 0, 0, 5);
    }

    public function test_discount_cannot_exceed_the_subtotal(): void
    {
        $this->expectException(InvalidArgumentException::class);

        $this->calculator->calculate(
            [['quantity' => 1, 'unit_price' => 1000]],
            discount: 1001,
            deliveryFee: 0,
            serviceFeePercentage: 0,
        );
    }

    public function test_line_discount_cannot_exceed_its_gross_value(): void
    {
        $this->expectException(InvalidArgumentException::class);

        $this->calculator->calculate(
            [['quantity' => 1, 'unit_price' => 1000, 'discount' => 1001]],
            discount: 0,
            deliveryFee: 0,
            serviceFeePercentage: 0,
        );
    }

    public function test_negative_unit_price_is_rejected(): void
    {
        $this->expectException(InvalidArgumentException::class);

        $this->calculator->calculate(
            [['quantity' => 1, 'unit_price' => -1]],
            discount: 0,
            deliveryFee: 0,
            serviceFeePercentage: 0,
        );
    }

    public function test_negative_delivery_fee_is_rejected(): void
    {
        $this->expectException(InvalidArgumentException::class);

        $this->calculator->calculate(
            [['quantity' => 1, 'unit_price' => 1000]],
            discount: 0,
            deliveryFee: -1,
            serviceFeePercentage: 0,
        );
    }

    public function test_service_fee_percentage_must_be_between_zero_and_one_hundred(): void
    {
        $this->expectException(InvalidArgumentException::class);

        $this->calculator->calculate(
            [['quantity' => 1, 'unit_price' => 1000]],
            discount: 0,
            deliveryFee: 0,
            serviceFeePercentage: 101,
        );
    }

    public function test_zero_unit_price_is_allowed(): void
    {
        $result = $this->calculator->calculate(
            [['quantity' => 2, 'unit_price' => 0]],
            discount: 0,
            deliveryFee: 1500,
            serviceFeePercentage: 5,
        );

        $this->assertSame(0, $result['subtotal']);
        $this->assertSame(0, $result['service_fee']);
        $this->assertSame(1500, $result['total_amount']);
        $this->assertSame(0, $result['items'][0]['line_total']);
    }

    public function test_zero_quantity_is_rejected(): void
    {
        $this->expectException(InvalidArgumentException::class);

        $this->calculator->calculate(
            [['quantity' => 0, 'unit_price' => 5000]],
            discount: 0,
            deliveryFee: 0,
            serviceFeePercentage: 0,
        );
    }
}
