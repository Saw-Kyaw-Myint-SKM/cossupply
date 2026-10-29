<?php

namespace Tests\Unit;

use App\Enums\DeliveryStatus;
use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Enums\QuotationRequestStatus;
use App\Enums\QuotationVersionStatus;
use App\Exceptions\InvalidStatusTransitionException;
use App\Services\Status\StatusTransitionService;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class StatusTransitionServiceTest extends TestCase
{
    private StatusTransitionService $service;

    protected function setUp(): void
    {
        parent::setUp();

        $this->service = new StatusTransitionService;
    }

    /**
     * Every valid transition defined in StatusDefinitions.md §10.
     *
     * @return array<string, array{0: string, 1: string, 2: string}>
     */
    public static function validTransitionsProvider(): array
    {
        $cases = [];

        $add = static function (string $domain, array $map) use (&$cases): void {
            foreach ($map as $from => $targets) {
                foreach ($targets as $to) {
                    $cases["{$domain}: {$from} -> {$to}"] = [$domain, $from, $to];
                }
            }
        };

        $add(StatusTransitionService::DOMAIN_QUOTATION_REQUEST, [
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
        ]);

        $add(StatusTransitionService::DOMAIN_QUOTATION_VERSION, [
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
        ]);

        $add(StatusTransitionService::DOMAIN_ORDER, [
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
        ]);

        $add(StatusTransitionService::DOMAIN_DELIVERY, [
            DeliveryStatus::NOT_ASSIGNED->value => [
                DeliveryStatus::PREPARING->value,
            ],
            DeliveryStatus::PREPARING->value => [
                DeliveryStatus::OUT_FOR_DELIVERY->value,
                DeliveryStatus::DELIVERY_FAILED->value,
                DeliveryStatus::RETURNED->value,
            ],
            DeliveryStatus::OUT_FOR_DELIVERY->value => [
                DeliveryStatus::DELIVERED->value,
                DeliveryStatus::DELIVERY_FAILED->value,
                DeliveryStatus::RETURNED->value,
            ],
            DeliveryStatus::DELIVERY_FAILED->value => [
                DeliveryStatus::PREPARING->value,
                DeliveryStatus::OUT_FOR_DELIVERY->value,
                DeliveryStatus::RETURNED->value,
            ],
            DeliveryStatus::DELIVERED->value => [
                DeliveryStatus::RETURNED->value,
            ],
        ]);

        $add(StatusTransitionService::DOMAIN_CASH_PAYMENT, [
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
        ]);

        return $cases;
    }

    /**
     * Representative unsupported transitions, including terminal states.
     *
     * @return array<string, array{0: string, 1: string, 2: string}>
     */
    public static function invalidTransitionsProvider(): array
    {
        return [
            'request NEW -> ACCEPTED skips workflow' => [
                StatusTransitionService::DOMAIN_QUOTATION_REQUEST,
                QuotationRequestStatus::NEW->value,
                QuotationRequestStatus::ACCEPTED->value,
            ],
            'request NEW -> NEW self transition' => [
                StatusTransitionService::DOMAIN_QUOTATION_REQUEST,
                QuotationRequestStatus::NEW->value,
                QuotationRequestStatus::NEW->value,
            ],
            'request CONTACTING_SUPPLIER -> QUOTATION_SENT skips steps' => [
                StatusTransitionService::DOMAIN_QUOTATION_REQUEST,
                QuotationRequestStatus::CONTACTING_SUPPLIER->value,
                QuotationRequestStatus::QUOTATION_SENT->value,
            ],
            'request ACCEPTED is terminal' => [
                StatusTransitionService::DOMAIN_QUOTATION_REQUEST,
                QuotationRequestStatus::ACCEPTED->value,
                QuotationRequestStatus::CANCELLED->value,
            ],
            'request REJECTED is terminal' => [
                StatusTransitionService::DOMAIN_QUOTATION_REQUEST,
                QuotationRequestStatus::REJECTED->value,
                QuotationRequestStatus::NEW->value,
            ],
            'request CANCELLED is terminal' => [
                StatusTransitionService::DOMAIN_QUOTATION_REQUEST,
                QuotationRequestStatus::CANCELLED->value,
                QuotationRequestStatus::NEW->value,
            ],
            'version DRAFT -> ACCEPTED skips SENT' => [
                StatusTransitionService::DOMAIN_QUOTATION_VERSION,
                QuotationVersionStatus::DRAFT->value,
                QuotationVersionStatus::ACCEPTED->value,
            ],
            'version SENT -> DRAFT goes backwards' => [
                StatusTransitionService::DOMAIN_QUOTATION_VERSION,
                QuotationVersionStatus::SENT->value,
                QuotationVersionStatus::DRAFT->value,
            ],
            'version SUPERSEDED is terminal' => [
                StatusTransitionService::DOMAIN_QUOTATION_VERSION,
                QuotationVersionStatus::SUPERSEDED->value,
                QuotationVersionStatus::SENT->value,
            ],
            'order SUPPLIER_CONFIRMATION_REQUIRED -> DELIVERED skips steps' => [
                StatusTransitionService::DOMAIN_ORDER,
                OrderStatus::SUPPLIER_CONFIRMATION_REQUIRED->value,
                OrderStatus::DELIVERED->value,
            ],
            'order COMPLETED is terminal' => [
                StatusTransitionService::DOMAIN_ORDER,
                OrderStatus::COMPLETED->value,
                OrderStatus::PREPARING->value,
            ],
            'order RETURNED is terminal' => [
                StatusTransitionService::DOMAIN_ORDER,
                OrderStatus::RETURNED->value,
                OrderStatus::READY_TO_SHIP->value,
            ],
            'order CANCELLED is terminal' => [
                StatusTransitionService::DOMAIN_ORDER,
                OrderStatus::CANCELLED->value,
                OrderStatus::ORDER_CONFIRMED->value,
            ],
            'payment NOT_PAID -> CASH_COLLECTED skips pending' => [
                StatusTransitionService::DOMAIN_CASH_PAYMENT,
                PaymentStatus::NOT_PAID->value,
                PaymentStatus::CASH_COLLECTED->value,
            ],
            'payment CASH_COLLECTED -> PAYMENT_FAILED' => [
                StatusTransitionService::DOMAIN_CASH_PAYMENT,
                PaymentStatus::CASH_COLLECTED->value,
                PaymentStatus::PAYMENT_FAILED->value,
            ],
            'payment PAYMENT_CONFIRMED is terminal' => [
                StatusTransitionService::DOMAIN_CASH_PAYMENT,
                PaymentStatus::PAYMENT_CONFIRMED->value,
                PaymentStatus::NOT_PAID->value,
            ],
            'delivery NOT_ASSIGNED -> DELIVERED skips preparation' => [
                StatusTransitionService::DOMAIN_DELIVERY,
                DeliveryStatus::NOT_ASSIGNED->value,
                DeliveryStatus::DELIVERED->value,
            ],
            'delivery PREPARING -> DELIVERED skips dispatch' => [
                StatusTransitionService::DOMAIN_DELIVERY,
                DeliveryStatus::PREPARING->value,
                DeliveryStatus::DELIVERED->value,
            ],
            'delivery RETURNED is terminal' => [
                StatusTransitionService::DOMAIN_DELIVERY,
                DeliveryStatus::RETURNED->value,
                DeliveryStatus::PREPARING->value,
            ],
            'unknown domain' => [
                'not_a_domain',
                'NOT_ASSIGNED',
                'PREPARING',
            ],
            'unknown source status' => [
                StatusTransitionService::DOMAIN_ORDER,
                'NOT_A_REAL_STATUS',
                OrderStatus::PREPARING->value,
            ],
            'unknown target status' => [
                StatusTransitionService::DOMAIN_ORDER,
                OrderStatus::PREPARING->value,
                'NOT_A_REAL_STATUS',
            ],
        ];
    }

    #[DataProvider('validTransitionsProvider')]
    public function test_valid_transitions_are_allowed(string $domain, string $from, string $to): void
    {
        $this->assertTrue($this->service->canTransition($domain, $from, $to));

        $this->service->assertTransition($domain, $from, $to);

        $this->addToAssertionCount(1);
    }

    #[DataProvider('invalidTransitionsProvider')]
    public function test_invalid_transitions_are_rejected(string $domain, string $from, string $to): void
    {
        $this->assertFalse($this->service->canTransition($domain, $from, $to));

        $this->expectException(InvalidStatusTransitionException::class);

        $this->service->assertTransition($domain, $from, $to);
    }

    public function test_terminal_states_reject_every_possible_transition(): void
    {
        $cases = [
            [
                StatusTransitionService::DOMAIN_QUOTATION_REQUEST,
                QuotationRequestStatus::values(),
                [
                    QuotationRequestStatus::ACCEPTED->value,
                    QuotationRequestStatus::REJECTED->value,
                    QuotationRequestStatus::CANCELLED->value,
                ],
            ],
            [
                StatusTransitionService::DOMAIN_QUOTATION_VERSION,
                QuotationVersionStatus::values(),
                [
                    QuotationVersionStatus::ACCEPTED->value,
                    QuotationVersionStatus::REJECTED->value,
                    QuotationVersionStatus::SUPERSEDED->value,
                    QuotationVersionStatus::CANCELLED->value,
                ],
            ],
            [
                StatusTransitionService::DOMAIN_ORDER,
                OrderStatus::values(),
                [
                    OrderStatus::SUPPLIER_UNAVAILABLE->value,
                    OrderStatus::RETURNED->value,
                    OrderStatus::CANCELLED->value,
                    OrderStatus::COMPLETED->value,
                ],
            ],
            [
                StatusTransitionService::DOMAIN_CASH_PAYMENT,
                PaymentStatus::values(),
                [
                    PaymentStatus::PAYMENT_CONFIRMED->value,
                    PaymentStatus::CUSTOMER_REFUSED_TO_PAY->value,
                    PaymentStatus::PAYMENT_FAILED->value,
                ],
            ],
        ];

        foreach ($cases as [$domain, $allStatuses, $terminals]) {
            foreach ($terminals as $terminal) {
                foreach ($allStatuses as $target) {
                    $this->assertFalse(
                        $this->service->canTransition($domain, $terminal, $target),
                        "Expected terminal transition [{$domain}] {$terminal} -> {$target} to be rejected.",
                    );
                }
            }
        }
    }

    public function test_assert_transition_throws_with_transition_details(): void
    {
        try {
            $this->service->assertTransition(
                StatusTransitionService::DOMAIN_QUOTATION_VERSION,
                QuotationVersionStatus::ACCEPTED->value,
                QuotationVersionStatus::SENT->value,
            );

            $this->fail('Expected InvalidStatusTransitionException to be thrown.');
        } catch (InvalidStatusTransitionException $exception) {
            $this->assertSame(StatusTransitionService::DOMAIN_QUOTATION_VERSION, $exception->domain);
            $this->assertSame(QuotationVersionStatus::ACCEPTED->value, $exception->from);
            $this->assertSame(QuotationVersionStatus::SENT->value, $exception->to);
            $this->assertStringContainsString('quotation_version', $exception->getMessage());
        }
    }

    public function test_domain_matching_is_case_insensitive(): void
    {
        $this->assertTrue($this->service->canTransition(
            'ORDER',
            OrderStatus::ORDER_CONFIRMED->value,
            OrderStatus::PREPARING->value,
        ));
    }
}
