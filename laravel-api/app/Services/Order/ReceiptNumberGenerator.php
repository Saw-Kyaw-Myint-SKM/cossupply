<?php

namespace App\Services\Order;

use App\Models\CashPayment;

/**
 * Builds the COD receipt document number from the persisted cash_payments
 * row.
 *
 * Format: `RCP-YYYY-####`. The sequence part is the payment's own id
 * padded to at least four digits, so the number is unique by construction
 * and stable for the lifetime of the payment. Task 10 handles collection
 * and verification; this task only reserves the document number at order
 * creation time.
 */
class ReceiptNumberGenerator
{
    private const PREFIX = 'RCP';

    /**
     * Build the receipt number for a persisted (or about-to-persist)
     * cash payment row.
     */
    public function generate(CashPayment $payment): string
    {
        return sprintf(
            '%s-%s-%s',
            self::PREFIX,
            now()->year,
            str_pad((string) $payment->id, 4, '0', STR_PAD_LEFT),
        );
    }
}
