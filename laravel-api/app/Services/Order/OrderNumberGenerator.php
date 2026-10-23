<?php

namespace App\Services\Order;

use App\Models\Order;
use App\Services\Setting\SettingService;

/**
 * Builds the customer-facing order number from the persisted orders row.
 *
 * Format: `{prefix}-YYYY-####` (LogicFlow §9). The sequence part is the
 * order's own id padded to at least four digits, so the number is unique
 * by construction and never needs a shared counter: `id` 42 becomes
 * `ORD-2026-0042`, `id` 12345 becomes `ORD-2026-12345`. The prefix comes
 * from the `order_number_prefix` master setting (default `ORD`).
 */
class OrderNumberGenerator
{
    private const DEFAULT_PREFIX = 'ORD';

    public function __construct(
        private readonly SettingService $settings,
    ) {}

    /**
     * Build the order number for a persisted (or about-to-persist) order.
     */
    public function generate(Order $order): string
    {
        $prefix = (string) ($this->settings->get('order_number_prefix', self::DEFAULT_PREFIX));

        return sprintf(
            '%s-%s-%s',
            $prefix !== '' ? $prefix : self::DEFAULT_PREFIX,
            now()->year,
            str_pad((string) $order->id, 4, '0', STR_PAD_LEFT),
        );
    }
}
