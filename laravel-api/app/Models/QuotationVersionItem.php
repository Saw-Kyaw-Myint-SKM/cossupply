<?php

namespace App\Models;

use Database\Factories\QuotationVersionItemFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class QuotationVersionItem extends Model
{
    /** @use HasFactory<QuotationVersionItemFactory> */
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'quotation_id',
        'product_id',
        'supplier_id',
        'product_name_snapshot',
        'sku_snapshot',
        'specification_snapshot',
        'quantity',
        'unit_price',
        'discount',
        'line_total',
        'delivery_date',
        'warranty_note',
        'supplier_note',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'unit_price' => 'integer',
            'discount' => 'integer',
            'line_total' => 'integer',
            'delivery_date' => 'date',
        ];
    }

    /**
     * The quotation version this item belongs to.
     */
    public function quotation(): BelongsTo
    {
        return $this->belongsTo(Quotation::class);
    }

    /**
     * The snapshotted product.
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /**
     * The snapshotted supplier.
     */
    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }
}
