<?php

namespace App\Models;

use App\Enums\QuotationVersionStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\MorphMany;

class Quotation extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'quotation_request_id',
        'quotation_number',
        'version',
        'status',
        'is_current',
        'subtotal',
        'discount',
        'delivery_fee',
        'service_fee_percentage',
        'service_fee',
        'total_amount',
        'payment_method',
        'payment_terms',
        'valid_until',
        'admin_note',
        'sent_at',
        'viewed_at',
        'accepted_at',
        'rejected_at',
        'created_by_admin_id',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'version' => 'integer',
            'status' => QuotationVersionStatus::class,
            'is_current' => 'boolean',
            'subtotal' => 'integer',
            'discount' => 'integer',
            'delivery_fee' => 'integer',
            'service_fee_percentage' => 'integer',
            'service_fee' => 'integer',
            'total_amount' => 'integer',
            'valid_until' => 'date',
            'sent_at' => 'datetime',
            'viewed_at' => 'datetime',
            'accepted_at' => 'datetime',
            'rejected_at' => 'datetime',
        ];
    }

    /**
     * The request this quotation version belongs to.
     */
    public function quotationRequest(): BelongsTo
    {
        return $this->belongsTo(QuotationRequest::class);
    }

    /**
     * The final quotation version item snapshots.
     */
    public function items(): HasMany
    {
        return $this->hasMany(QuotationVersionItem::class);
    }

    /**
     * The generated PDFs for this quotation version.
     */
    public function pdfs(): HasMany
    {
        return $this->hasMany(QuotationPdf::class);
    }

    /**
     * The customer action trail for this quotation version.
     */
    public function actions(): HasMany
    {
        return $this->hasMany(QuotationAction::class);
    }

    /**
     * Synchronous email delivery attempts for this version.
     */
    public function emailLogs(): MorphMany
    {
        return $this->morphMany(EmailLog::class, 'related');
    }

    /**
     * The order produced from this quotation version.
     */
    public function order(): HasOne
    {
        return $this->hasOne(Order::class);
    }

    /**
     * The admin who created this quotation version.
     */
    public function createdByAdmin(): BelongsTo
    {
        return $this->belongsTo(Admin::class, 'created_by_admin_id');
    }
}
