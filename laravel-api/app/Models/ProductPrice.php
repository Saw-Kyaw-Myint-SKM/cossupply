<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductPrice extends Model
{
    use HasFactory;

    /**
     * product_prices tracks its own last_updated_at column instead of the
     * default Eloquent timestamp pair.
     *
     * @var bool
     */
    public $timestamps = false;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'product_id',
        'retail_price',
        'wholesale_price',
        'discount_price',
        'minimum_order_quantity',
        'price_valid_until',
        'last_updated_at',
        'updated_by_admin_id',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'retail_price' => 'integer',
            'wholesale_price' => 'integer',
            'discount_price' => 'integer',
            'minimum_order_quantity' => 'integer',
            'price_valid_until' => 'date',
            'last_updated_at' => 'datetime',
        ];
    }

    /**
     * The product this price belongs to.
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /**
     * The admin who last updated the price.
     */
    public function updatedByAdmin(): BelongsTo
    {
        return $this->belongsTo(Admin::class, 'updated_by_admin_id');
    }
}
