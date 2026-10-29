<?php

namespace App\Models;

use App\Enums\QuotationRequestStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class QuotationRequest extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'quotation_number',
        'customer_id',
        'customer_name',
        'company_name',
        'phone',
        'email',
        'delivery_address',
        'city',
        'township',
        'landmark',
        'required_delivery_date',
        'customer_note',
        'status',
        'assigned_admin_id',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'required_delivery_date' => 'date',
            'status' => QuotationRequestStatus::class,
        ];
    }

    /**
     * The authenticated customer that owns this request.
     */
    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    /**
     * The admin assigned to handle this request.
     */
    public function assignedAdmin(): BelongsTo
    {
        return $this->belongsTo(Admin::class, 'assigned_admin_id');
    }

    /**
     * The original requested item snapshots.
     */
    public function items(): HasMany
    {
        return $this->hasMany(QuotationItem::class);
    }

    /**
     * The supplier communication log entries.
     */
    public function communications(): HasMany
    {
        return $this->hasMany(SupplierCommunication::class);
    }

    /**
     * The quotation versions produced from this request.
     */
    public function quotations(): HasMany
    {
        return $this->hasMany(Quotation::class);
    }

    /**
     * The single current Final Quotation version, when one has been sent.
     */
    public function currentQuotation(): HasOne
    {
        return $this->hasOne(Quotation::class)->where('is_current', true);
    }

    /**
     * The orders created from this request.
     */
    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }
}
