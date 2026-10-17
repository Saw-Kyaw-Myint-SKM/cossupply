<?php

namespace App\Models;

use App\Enums\DeliveryStatus;
use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Order extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'order_number',
        'quotation_id',
        'quotation_request_id',
        'customer_id',
        'customer_name',
        'company_name',
        'phone',
        'email',
        'delivery_address',
        'city',
        'township',
        'landmark',
        'subtotal',
        'discount',
        'delivery_fee',
        'service_fee_percentage',
        'service_fee',
        'total_amount',
        'payment_method',
        'payment_status',
        'order_status',
        'delivery_status',
        'customer_note',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'subtotal' => 'integer',
            'discount' => 'integer',
            'delivery_fee' => 'integer',
            'service_fee_percentage' => 'integer',
            'service_fee' => 'integer',
            'total_amount' => 'integer',
            'payment_status' => PaymentStatus::class,
            'order_status' => OrderStatus::class,
            'delivery_status' => DeliveryStatus::class,
        ];
    }

    /**
     * The accepted quotation version this order was created from.
     */
    public function quotation(): BelongsTo
    {
        return $this->belongsTo(Quotation::class);
    }

    /**
     * The quotation request this order originated from.
     */
    public function quotationRequest(): BelongsTo
    {
        return $this->belongsTo(QuotationRequest::class);
    }

    /**
     * The customer that owns this order.
     */
    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    /**
     * The immutable order item snapshots.
     */
    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    /**
     * The delivery records for this order.
     */
    public function deliveries(): HasMany
    {
        return $this->hasMany(Delivery::class);
    }

    /**
     * The cash payment record for this order.
     */
    public function cashPayment(): HasOne
    {
        return $this->hasOne(CashPayment::class);
    }

    /**
     * The order status change trail.
     */
    public function statusHistories(): HasMany
    {
        return $this->hasMany(OrderStatusHistory::class);
    }
}
