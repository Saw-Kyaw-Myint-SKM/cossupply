<?php

namespace App\Models;

use App\Enums\QuotationAction as QuotationActionEnum;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class QuotationAction extends Model
{
    /**
     * Append-only action trail: rows are never updated.
     *
     * @var null
     */
    public const UPDATED_AT = null;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'quotation_id',
        'action',
        'customer_note',
        'actor_type',
        'actor_id',
        'ip_address',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'action' => QuotationActionEnum::class,
        ];
    }

    /**
     * The quotation version this action was performed on.
     */
    public function quotation(): BelongsTo
    {
        return $this->belongsTo(Quotation::class);
    }
}
