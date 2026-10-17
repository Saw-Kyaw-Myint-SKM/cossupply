<?php

namespace App\Models;

use Database\Factories\QuotationPdfFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class QuotationPdf extends Model
{
    /** @use HasFactory<QuotationPdfFactory> */
    use HasFactory;

    /**
     * Append-only: generated PDFs are never updated.
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
        'file_path',
        'file_name',
        'generated_by_admin_id',
        'generated_at',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'generated_at' => 'datetime',
        ];
    }

    /**
     * The quotation version this PDF was generated from.
     */
    public function quotation(): BelongsTo
    {
        return $this->belongsTo(Quotation::class);
    }

    /**
     * The admin who generated the PDF.
     */
    public function generatedByAdmin(): BelongsTo
    {
        return $this->belongsTo(Admin::class, 'generated_by_admin_id');
    }
}
