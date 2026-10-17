<?php

namespace App\Models;

use App\Enums\ProductStatus;
use App\Enums\StockStatus;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Product extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'supplier_id',
        'category_id',
        'name_mm',
        'name_en',
        'slug',
        'sku',
        'brand',
        'model',
        'description',
        'specification',
        'size',
        'color',
        'unit',
        'package_size',
        'photo',
        'status',
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
            'status' => ProductStatus::class,
        ];
    }

    /**
     * The supplier of this product.
     */
    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    /**
     * The category of this product.
     */
    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    /**
     * The admin who created the product.
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(Admin::class, 'created_by_admin_id');
    }

    /**
     * Price records for this product.
     */
    public function prices(): HasMany
    {
        return $this->hasMany(ProductPrice::class);
    }

    /**
     * The current stock record for this product.
     */
    public function stock(): HasOne
    {
        return $this->hasOne(ProductStock::class);
    }

    /**
     * The original quotation request items that reference this product.
     */
    public function quotationItems(): HasMany
    {
        return $this->hasMany(QuotationItem::class);
    }

    /**
     * The final quotation version items that reference this product.
     */
    public function quotationVersionItems(): HasMany
    {
        return $this->hasMany(QuotationVersionItem::class);
    }

    /**
     * The order item snapshots that reference this product.
     */
    public function orderItems(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    /**
     * Products that may be added to a cart: published products whose stock
     * record is missing or not OUT_OF_STOCK. SUPPLIER_CONFIRMATION_REQUIRED
     * stays cart-eligible per LogicFlow §4.
     */
    #[Scope]
    protected function availableForCart(Builder $query): void
    {
        $query->where('status', ProductStatus::PUBLISHED->value)
            ->where(function (Builder $query): void {
                $query->whereDoesntHave('stock')
                    ->orWhereHas('stock', fn (Builder $stock): Builder => $stock->where('stock_status', '!=', StockStatus::OUT_OF_STOCK->value));
            });
    }
}
