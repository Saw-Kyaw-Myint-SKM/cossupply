<?php

namespace App\Enums;

use App\Enums\Concerns\HasValues;

enum QuotationAction: string
{
    use HasValues;

    case VIEWED = 'VIEWED';
    case ACCEPTED = 'ACCEPTED';
    case REJECTED = 'REJECTED';
    case REQUESTED_CHANGE = 'REQUESTED_CHANGE';
}
