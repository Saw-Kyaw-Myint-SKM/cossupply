<?php

namespace App\Enums;

use App\Enums\Concerns\HasValues;

enum ProductStatus: string
{
    use HasValues;

    case DRAFT = 'DRAFT';
    case PUBLISHED = 'PUBLISHED';
    case HIDDEN = 'HIDDEN';
    case OUT_OF_STOCK = 'OUT_OF_STOCK';
}
