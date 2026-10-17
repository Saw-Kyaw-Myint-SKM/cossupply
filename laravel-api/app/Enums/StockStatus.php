<?php

namespace App\Enums;

use App\Enums\Concerns\HasValues;

enum StockStatus: string
{
    use HasValues;

    case IN_STOCK = 'IN_STOCK';
    case LOW_STOCK = 'LOW_STOCK';
    case OUT_OF_STOCK = 'OUT_OF_STOCK';
    case PRE_ORDER = 'PRE_ORDER';
    case SUPPLIER_CONFIRMATION_REQUIRED = 'SUPPLIER_CONFIRMATION_REQUIRED';
}
