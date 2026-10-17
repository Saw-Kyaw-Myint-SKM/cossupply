<?php

namespace App\Models;

use App\Enums\PaymentStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CashPayment extends Model
{
    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'order_id',
        'delivery_id',
        'receipt_number',
        'amount_due',
        'amount_collected',
        'amount_remaining',
        'received_by',
        'collected_at',
        'customer_name',
        'customer_signature_path',
        'receipt_file_path',
        'note',
        'status',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'amount_due' => 'integer',
            'amount_collected' => 'integer',
            'amount_remaining' => 'integer',
            'collected_at' => 'datetime',
            'status' => PaymentStatus::class,
        ];
    }

    /**
     * The order this payment belongs to.
     */
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    /**
     * The delivery during which the cash was collected.
     */
    public function delivery(): BelongsTo
    {
        return $this->belongsTo(Delivery::class);
    }
}
