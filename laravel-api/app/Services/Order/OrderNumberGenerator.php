<?php

namespace App\Services\Order;

use App\Models\Order;
use App\Services\Setting\SettingService;

/**
 * Builds the customer-facing order and receipt numbers.
 *
 * Both numbers are derived from the persisted order id, so they are unique
 * by construction and never need a shared counter. The order prefix comes
 * from the `order_number_prefix` master setting (default `ORD`).
 */
class OrderNumberGenerator
{
    private const DEFAULT_PREFIX = 'ORD';

    public function __construct(
        private readonly SettingService $settings,
    ) {}

    /**
     * Build the order number for a persisted order row.
     */
    public function orderNumber(Order $order): string
    {
        $prefix = (string) ($this->settings->get('order_number_prefix', self::DEFAULT_PREFIX));

        return sprintf(
            '%s-%s-%s',
            $prefix !== '' ? $prefix : self::DEFAULT_PREFIX,
            now()->year,
            str_pad((string) $order->id, 6, '0', STR_PAD_LEFT),
        );
    }

    /**
     * Build the COD receipt number for a persisted order row.
     *
     * MVP creates exactly one cash payment per order, so the order id is a
     * safe receipt sequence.
     */
    public function receiptNumber(Order $order): string
    {
        return sprintf(
            'RCP-%s-%s',
            now()->year,
            str_pad((string) $order->id, 6, '0', STR_PAD_LEFT),
        );
    }
}
