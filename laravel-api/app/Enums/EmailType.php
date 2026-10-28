<?php

namespace App\Enums;

use App\Enums\Concerns\HasValues;

/**
 * Synchronous email event types recorded in `email_logs`.
 */
enum EmailType: string
{
    use HasValues;

    case QUOTATION_SENT = 'QUOTATION_SENT';
    case ORDER_CONFIRMED = 'ORDER_CONFIRMED';
    case ORDER_OUT_FOR_DELIVERY = 'ORDER_OUT_FOR_DELIVERY';
    case PAYMENT_CONFIRMED = 'PAYMENT_CONFIRMED';
    case ORDER_CANCELLED = 'ORDER_CANCELLED';
}
