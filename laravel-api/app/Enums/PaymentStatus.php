<?php

namespace App\Enums;

use App\Enums\Concerns\HasValues;

enum PaymentStatus: string
{
    use HasValues;

    case NOT_PAID = 'NOT_PAID';
    case CASH_COLLECTION_PENDING = 'CASH_COLLECTION_PENDING';
    case CASH_COLLECTED = 'CASH_COLLECTED';
    case PAYMENT_CONFIRMED = 'PAYMENT_CONFIRMED';
    case PAYMENT_FAILED = 'PAYMENT_FAILED';
    case CUSTOMER_REFUSED_TO_PAY = 'CUSTOMER_REFUSED_TO_PAY';
}
