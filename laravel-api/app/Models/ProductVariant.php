<?php

namespace App\Models;

use App\Enums\StockStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductVariant extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'product_id',
        'name',
        'variant_attributes',
        'attributes_key',
        'slug',
        'sku',
        'photo',
        'retail_price',
        'wholesale_price',
        'discount_price',
        'minimum_order_quantity',
        'price_valid_until',
        'price_updated_at',
        'price_updated_by_admin_id',
        'stock_quantity',
        'stock_status',
        'stock_confirmed_at',
        'stock_confirmed_by_admin_id',
        'supplier_note',
        'sort_order',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'variant_attributes' => 'array',
            'retail_price' => 'integer',
            'wholesale_price' => 'integer',
            'discount_price' => 'integer',
            'minimum_order_quantity' => 'integer',
            'price_valid_until' => 'date',
            'price_updated_at' => 'datetime',
            'stock_quantity' => 'integer',
            'stock_status' => StockStatus::class,
            'stock_confirmed_at' => 'datetime',
            'sort_order' => 'integer',
        ];
    }

    /**
     * The product this variant belongs to.
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /**
     * The admin who last updated the price.
     */
    public function priceUpdatedByAdmin(): BelongsTo
    {
        return $this->belongsTo(Admin::class, 'price_updated_by_admin_id');
    }

    /**
     * The admin who last confirmed the stock.
     */
    public function stockConfirmedByAdmin(): BelongsTo
    {
        return $this->belongsTo(Admin::class, 'stock_confirmed_by_admin_id');
    }

    /**
     * Trim the attribute map and drop empty names or values. The display
     * casing is preserved for the stored JSON.
     *
     * @param  array<mixed>  $attributes
     * @return array<string, string>
     */
    public static function normalizeAttributes(array $attributes): array
    {
        $normalized = [];

        foreach ($attributes as $name => $value) {
            if (! is_string($name)) {
                continue;
            }

            $name = trim($name);
            $value = is_scalar($value) ? trim((string) $value) : '';

            if ($name === '' || $value === '') {
                continue;
            }

            $normalized[$name] = $value;
        }

        return $normalized;
    }

    /**
     * Stable identity for one attribute combination, used for the per-product
     * unique constraint so duplicate combinations cannot be persisted.
     *
     * @param  array<mixed>  $attributes
     */
    public static function attributesKey(array $attributes): string
    {
        $normalized = [];

        foreach (static::normalizeAttributes($attributes) as $name => $value) {
            $normalized[mb_strtolower($name)] = mb_strtolower($value);
        }

        ksort($normalized);

        return json_encode($normalized, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '{}';
    }

    /**
     * Stable identity for a variant: the typed name when present, otherwise
     * the legacy attribute combination.
     *
     * @param  array<mixed>  $attributes
     */
    public static function identityKey(?string $name, array $attributes): string
    {
        $name = trim((string) $name);

        return $name !== ''
            ? 'name:'.mb_strtolower($name)
            : 'attrs:'.static::attributesKey($attributes);
    }

    /**
     * Derive a readable name from the legacy attribute map.
     *
     * @param  array<mixed>  $attributes
     */
    public static function nameFromAttributes(array $attributes): string
    {
        return collect(static::normalizeAttributes($attributes))
            ->map(fn ($value, $name): string => "{$name}: {$value}")
            ->implode(', ');
    }

    /**
     * Human-readable option label: the typed name, or the legacy attributes.
     */
    public function attributesLabel(): string
    {
        $name = trim((string) $this->name);

        if ($name !== '') {
            return $name;
        }

        return collect($this->variant_attributes ?? [])
            ->map(fn ($value, $name): string => trim((string) $value) === '' ? '' : (string) $value)
            ->filter()
            ->implode(' / ');
    }
}
