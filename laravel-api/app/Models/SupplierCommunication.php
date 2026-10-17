<?php

namespace App\Models;

use Database\Factories\SupplierCommunicationFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SupplierCommunication extends Model
{
    /** @use HasFactory<SupplierCommunicationFactory> */
    use HasFactory;

    /**
     * Append-only log: rows are never updated.
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
        'quotation_request_id',
        'supplier_id',
        'admin_id',
        'contact_method',
        'message_text',
        'supplier_response',
        'attachment_path',
        'contacted_at',
        'responded_at',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'contacted_at' => 'datetime',
            'responded_at' => 'datetime',
        ];
    }

    /**
     * The quotation request this contact was about.
     */
    public function quotationRequest(): BelongsTo
    {
        return $this->belongsTo(QuotationRequest::class);
    }

    /**
     * The contacted supplier.
     */
    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    /**
     * The admin who logged the communication.
     */
    public function admin(): BelongsTo
    {
        return $this->belongsTo(Admin::class);
    }
}
