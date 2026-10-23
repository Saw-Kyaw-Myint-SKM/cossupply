<?php

namespace App\Services\Quotation;

use App\Models\QuotationRequest;
use App\Services\Setting\SettingService;

/**
 * Builds the customer-facing quotation number from the persisted
 * quotation_requests row.
 *
 * Format: `{prefix}-YYYY-####` (LogicFlow §5). The sequence part is the
 * quotation request's own id padded to at least four digits, so the
 * number is unique by construction and never needs a shared counter:
 * `id` 42 becomes `QT-2026-0042`, `id` 12345 becomes `QT-2026-12345`.
 * The prefix comes from the `quotation_number_prefix` master setting
 * (default `QT`).
 */
class QuotationNumberGenerator
{
    private const DEFAULT_PREFIX = 'QT';

    public function __construct(
        private readonly SettingService $settings,
    ) {}

    /**
     * Build the quotation number for a persisted (or about-to-persist)
     * quotation request row.
     */
    public function generate(QuotationRequest $request): string
    {
        $prefix = (string) ($this->settings->get('quotation_number_prefix', self::DEFAULT_PREFIX));

        return sprintf(
            '%s-%s-%s',
            $prefix !== '' ? $prefix : self::DEFAULT_PREFIX,
            now()->year,
            str_pad((string) $request->id, 4, '0', STR_PAD_LEFT),
        );
    }
}
