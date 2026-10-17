<?php

namespace App\Enums;

use App\Enums\Concerns\HasValues;

enum QuotationRequestStatus: string
{
    use HasValues;

    case NEW = 'NEW';
    case CONTACTING_SUPPLIER = 'CONTACTING_SUPPLIER';
    case SUPPLIER_RESPONSE_PENDING = 'SUPPLIER_RESPONSE_PENDING';
    case PREPARING_QUOTATION = 'PREPARING_QUOTATION';
    case QUOTATION_SENT = 'QUOTATION_SENT';
    case CUSTOMER_REVIEWING = 'CUSTOMER_REVIEWING';
    case CHANGE_REQUESTED = 'CHANGE_REQUESTED';
    case ACCEPTED = 'ACCEPTED';
    case REJECTED = 'REJECTED';
    case EXPIRED = 'EXPIRED';
    case CANCELLED = 'CANCELLED';
}
