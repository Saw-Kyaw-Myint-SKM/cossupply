<?php

namespace App\Enums;

use App\Enums\Concerns\HasValues;

enum DeliveryStatus: string
{
    use HasValues;

    case NOT_ASSIGNED = 'NOT_ASSIGNED';
    case PREPARING = 'PREPARING';
    case OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY';
    case DELIVERED = 'DELIVERED';
    case DELIVERY_FAILED = 'DELIVERY_FAILED';
    case RETURNED = 'RETURNED';
}
