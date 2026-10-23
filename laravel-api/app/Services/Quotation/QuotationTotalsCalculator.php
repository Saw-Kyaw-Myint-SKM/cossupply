<?php

namespace App\Services\Quotation;

use InvalidArgumentException;

/**
 * Server-side money rules for a quotation version.
 *
 * All values are integer MMK. The client never supplies line totals,
 * subtotal, service fee or total amount.
 */
class QuotationTotalsCalculator
{
    /**
     * @param  list<array{quantity: int, unit_price: int, discount?: int}>  $items
     * @return array{
     *     items: list<array{quantity: int, unit_price: int, discount: int, line_total: int}>,
     *     subtotal: int,
     *     service_fee: int,
     *     total_amount: int
     * }
     */
    public function calculate(
        array $items,
        int $discount,
        int $deliveryFee,
        int $serviceFeePercentage,
    ): array {
        if ($items === []) {
            throw new InvalidArgumentException('A quotation version needs at least one item.');
        }

        if ($discount < 0 || $deliveryFee < 0) {
            throw new InvalidArgumentException('Discount and delivery fee must not be negative.');
        }

        if ($serviceFeePercentage < 0 || $serviceFeePercentage > 100) {
            throw new InvalidArgumentException('The service fee percentage must be between 0 and 100.');
        }

        $priced = [];
        $subtotal = 0;

        foreach ($items as $item) {
            $quantity = (int) $item['quantity'];
            $unitPrice = (int) $item['unit_price'];
            $lineDiscount = (int) ($item['discount'] ?? 0);

            if ($quantity < 1 || $unitPrice < 1 || $lineDiscount < 0) {
                throw new InvalidArgumentException('Quotation item quantities and prices must be positive.');
            }

            $gross = $quantity * $unitPrice;

            if ($lineDiscount > $gross) {
                throw new InvalidArgumentException('A line discount cannot exceed its gross line value.');
            }

            $lineTotal = $gross - $lineDiscount;
            $subtotal += $lineTotal;

            $priced[] = [
                'quantity' => $quantity,
                'unit_price' => $unitPrice,
                'discount' => $lineDiscount,
                'line_total' => $lineTotal,
            ];
        }

        if ($discount > $subtotal) {
            throw new InvalidArgumentException('The quotation discount cannot exceed the subtotal.');
        }

        $serviceFee = (int) round($subtotal * $serviceFeePercentage / 100, 0, PHP_ROUND_HALF_UP);
        $total = $subtotal - $discount + $deliveryFee + $serviceFee;

        return [
            'items' => $priced,
            'subtotal' => $subtotal,
            'service_fee' => $serviceFee,
            'total_amount' => $total,
        ];
    }
}
