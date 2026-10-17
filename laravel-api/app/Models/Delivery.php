<?php

namespace App\Models;

use App\Enums\DeliveryStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Delivery extends Model
{
    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'order_id',
        'supplier_id',
        'delivery_contact_name',
        'delivery_phone',
        'delivery_address',
        'city',
        'township',
        'landmark',
        'delivery_fee',
        'delivery_partner',
        'tracking_number',
        'estimated_delivery_date',
        'shipped_at',
        'delivered_at',
        'received_by',
        'customer_note',
        'delivery_status',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'delivery_fee' => 'integer',
            'estimated_delivery_date' => 'date',
            'shipped_at' => 'datetime',
            'delivered_at' => 'datetime',
            'delivery_status' => DeliveryStatus::class,
        ];
    }

    /**
     * The order this delivery belongs to.
     */
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    /**
     * The supplier fulfilling the delivery, when assigned.
     */
    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }
}
