<?php

namespace App\Services\Status;

use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Enums\QuotationRequestStatus;
use App\Enums\QuotationVersionStatus;
use App\Exceptions\InvalidStatusTransitionException;

/**
 * Server-side guard for the valid status transitions defined in
 * specification/StatusDefinitions.md §10.
 *
 * The maps are deliberately explicit so unsupported transitions are
 * rejected instead of silently accepted. Delivery transitions are not
 * defined in §10 and are therefore intentionally absent.
 */
class StatusTransitionService
{
    public const DOMAIN_QUOTATION_REQUEST = 'quotation_request';

    public const DOMAIN_QUOTATION_VERSION = 'quotation_version';

    public const DOMAIN_ORDER = 'order';

    public const DOMAIN_CASH_PAYMENT = 'cash_payment';

    /**
     * Valid transitions per domain: [from => [allowed targets...]].
     *
     * Terminal states are absent from the map, so no transition away
     * from a terminal state is accepted.
     *
     * @var array<string, array<string, array<int, string>>>
     */
    private const TRANSITIONS = [
        self::DOMAIN_QUOTATION_REQUEST => [
            QuotationRequestStatus::NEW->value => [
                QuotationRequestStatus::CONTACTING_SUPPLIER->value,
                QuotationRequestStatus::CANCELLED->value,
            ],
            QuotationRequestStatus::CONTACTING_SUPPLIER->value => [
                QuotationRequestStatus::SUPPLIER_RESPONSE_PENDING->value,
                QuotationRequestStatus::PREPARING_QUOTATION->value,
                QuotationRequestStatus::CANCELLED->value,
            ],
            QuotationRequestStatus::SUPPLIER_RESPONSE_PENDING->value => [
                QuotationRequestStatus::CONTACTING_SUPPLIER->value,
                QuotationRequestStatus::PREPARING_QUOTATION->value,
                QuotationRequestStatus::CANCELLED->value,
            ],
            QuotationRequestStatus::PREPARING_QUOTATION->value => [
                QuotationRequestStatus::QUOTATION_SENT->value,
                QuotationRequestStatus::CANCELLED->value,
            ],
            QuotationRequestStatus::QUOTATION_SENT->value => [
                QuotationRequestStatus::CUSTOMER_REVIEWING->value,
                QuotationRequestStatus::CHANGE_REQUESTED->value,
                QuotationRequestStatus::ACCEPTED->value,
                QuotationRequestStatus::REJECTED->value,
                QuotationRequestStatus::EXPIRED->value,
                QuotationRequestStatus::CANCELLED->value,
            ],
            QuotationRequestStatus::CUSTOMER_REVIEWING->value => [
                QuotationRequestStatus::CHANGE_REQUESTED->value,
                QuotationRequestStatus::ACCEPTED->value,
                QuotationRequestStatus::REJECTED->value,
                QuotationRequestStatus::EXPIRED->value,
                QuotationRequestStatus::CANCELLED->value,
            ],
            QuotationRequestStatus::CHANGE_REQUESTED->value => [
                QuotationRequestStatus::PREPARING_QUOTATION->value,
                QuotationRequestStatus::CANCELLED->value,
            ],
            QuotationRequestStatus::EXPIRED->value => [
                QuotationRequestStatus::PREPARING_QUOTATION->value,
            ],
        ],
        self::DOMAIN_QUOTATION_VERSION => [
            QuotationVersionStatus::DRAFT->value => [
                QuotationVersionStatus::SENT->value,
                QuotationVersionStatus::CANCELLED->value,
            ],
            QuotationVersionStatus::SENT->value => [
                QuotationVersionStatus::VIEWED->value,
                QuotationVersionStatus::CHANGE_REQUESTED->value,
                QuotationVersionStatus::ACCEPTED->value,
                QuotationVersionStatus::REJECTED->value,
                QuotationVersionStatus::EXPIRED->value,
                QuotationVersionStatus::SUPERSEDED->value,
                QuotationVersionStatus::CANCELLED->value,
            ],
            QuotationVersionStatus::VIEWED->value => [
                QuotationVersionStatus::CHANGE_REQUESTED->value,
                QuotationVersionStatus::ACCEPTED->value,
                QuotationVersionStatus::REJECTED->value,
                QuotationVersionStatus::EXPIRED->value,
                QuotationVersionStatus::SUPERSEDED->value,
                QuotationVersionStatus::CANCELLED->value,
            ],
            QuotationVersionStatus::CHANGE_REQUESTED->value => [
                QuotationVersionStatus::SUPERSEDED->value,
                QuotationVersionStatus::CANCELLED->value,
            ],
            QuotationVersionStatus::EXPIRED->value => [
                QuotationVersionStatus::SUPERSEDED->value,
            ],
        ],
        self::DOMAIN_ORDER => [
            OrderStatus::SUPPLIER_CONFIRMATION_REQUIRED->value => [
                OrderStatus::ORDER_CONFIRMED->value,
                OrderStatus::SUPPLIER_UNAVAILABLE->value,
                OrderStatus::CANCELLED->value,
            ],
            OrderStatus::ORDER_CONFIRMED->value => [
                OrderStatus::PREPARING->value,
                OrderStatus::CANCELLED->value,
            ],
            OrderStatus::PREPARING->value => [
                OrderStatus::READY_TO_SHIP->value,
                OrderStatus::CANCELLED->value,
            ],
            OrderStatus::READY_TO_SHIP->value => [
                OrderStatus::OUT_FOR_DELIVERY->value,
                OrderStatus::CANCELLED->value,
            ],
            OrderStatus::OUT_FOR_DELIVERY->value => [
                OrderStatus::DELIVERED->value,
                OrderStatus::DELIVERY_FAILED->value,
                OrderStatus::RETURNED->value,
            ],
            OrderStatus::DELIVERY_FAILED->value => [
                OrderStatus::READY_TO_SHIP->value,
                OrderStatus::RETURNED->value,
                OrderStatus::CANCELLED->value,
            ],
            OrderStatus::DELIVERED->value => [
                OrderStatus::COMPLETED->value,
                OrderStatus::RETURNED->value,
            ],
        ],
        self::DOMAIN_CASH_PAYMENT => [
            PaymentStatus::NOT_PAID->value => [
                PaymentStatus::CASH_COLLECTION_PENDING->value,
            ],
            PaymentStatus::CASH_COLLECTION_PENDING->value => [
                PaymentStatus::CASH_COLLECTED->value,
                PaymentStatus::CUSTOMER_REFUSED_TO_PAY->value,
                PaymentStatus::PAYMENT_FAILED->value,
            ],
            PaymentStatus::CASH_COLLECTED->value => [
                PaymentStatus::PAYMENT_CONFIRMED->value,
            ],
        ],
    ];

    /**
     * Determine whether the given status transition is allowed.
     */
    public function canTransition(string $domain, string $from, string $to): bool
    {
        $transitions = self::TRANSITIONS[strtolower($domain)] ?? null;

        if ($transitions === null) {
            return false;
        }

        return in_array($to, $transitions[$from] ?? [], true);
    }

    /**
     * Assert that the given status transition is allowed.
     *
     * @throws InvalidStatusTransitionException
     */
    public function assertTransition(string $domain, string $from, string $to): void
    {
        if (! $this->canTransition($domain, $from, $to)) {
            throw new InvalidStatusTransitionException($domain, $from, $to);
        }
    }

    /**
     * Find the shortest valid status path from one status to another.
     *
     * Admin workflow steps (for example NEW -> PREPARING_QUOTATION) may need
     * to pass through intermediate statuses; this returns every hop so the
     * caller can keep the declared transition graph intact.
     *
     * @return list<string>|null Null when no valid path exists.
     */
    public function path(string $domain, string $from, string $to): ?array
    {
        $transitions = self::TRANSITIONS[strtolower($domain)] ?? null;

        if ($transitions === null) {
            return null;
        }

        if ($from === $to) {
            return [$from];
        }

        $queue = [[$from]];
        $visited = [$from => true];

        while ($queue !== []) {
            $currentPath = array_shift($queue);
            $current = $currentPath[count($currentPath) - 1];

            foreach ($transitions[$current] ?? [] as $next) {
                if (isset($visited[$next])) {
                    continue;
                }

                $nextPath = [...$currentPath, $next];

                if ($next === $to) {
                    return $nextPath;
                }

                $visited[$next] = true;
                $queue[] = $nextPath;
            }
        }

        return null;
    }
}
