<?php

namespace App\Enums;

use App\Enums\Concerns\HasValues;

enum QuotationVersionStatus: string
{
    use HasValues;

    case DRAFT = 'DRAFT';
    case SENT = 'SENT';
    case VIEWED = 'VIEWED';
    case CHANGE_REQUESTED = 'CHANGE_REQUESTED';
    case ACCEPTED = 'ACCEPTED';
    case REJECTED = 'REJECTED';
    case EXPIRED = 'EXPIRED';
    case SUPERSEDED = 'SUPERSEDED';
    case CANCELLED = 'CANCELLED';
}
