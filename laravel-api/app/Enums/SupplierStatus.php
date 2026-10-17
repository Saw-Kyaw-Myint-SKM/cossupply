<?php

namespace App\Enums;

use App\Enums\Concerns\HasValues;

enum SupplierStatus: string
{
    use HasValues;

    case ACTIVE = 'ACTIVE';
    case INACTIVE = 'INACTIVE';
    case SUSPENDED = 'SUSPENDED';
}
