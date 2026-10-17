<?php

namespace App\Models;

use Database\Factories\OrderStatusHistoryFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderStatusHistory extends Model
{
    /** @use HasFactory<OrderStatusHistoryFactory> */
    use HasFactory;

    /**
     * Append-only status trail: rows are never updated.
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
        'order_id',
        'old_status',
        'new_status',
        'changed_by_type',
        'changed_by_id',
        'note',
    ];

    /**
     * The order this status change belongs to.
     */
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
}
