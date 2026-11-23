<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * A home-page hero slide managed from the admin panel.
 *
 * Banners are fully bilingual: the storefront picks the matching *_mm or
 * *_en column for the active locale, with a fallback to the other language.
 */
class Banner extends Model
{
    use HasFactory;

    public const STATUS_ACTIVE = 'ACTIVE';

    public const STATUS_INACTIVE = 'INACTIVE';

    /**
     * The banner statuses.
     *
     * @var list<string>
     */
    public const STATUSES = [self::STATUS_ACTIVE, self::STATUS_INACTIVE];

    public const DEFAULT_BACKGROUND_STYLE = 'ink';

    /**
     * Background palettes available to the text-only hero.
     *
     * @var list<string>
     */
    public const BACKGROUND_STYLES = ['ink', 'ocean', 'violet', 'ember', 'paper'];

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'title_mm',
        'title_en',
        'subtitle_mm',
        'subtitle_en',
        'cta_label_mm',
        'cta_label_en',
        'link_url',
        'image',
        'sort_order',
        'status',
        'background_style',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'sort_order' => 'integer',
        ];
    }

    /**
     * Limit the query to banners that may be shown on the storefront.
     *
     * @param  Builder<Banner>  $query
     * @return Builder<Banner>
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_ACTIVE);
    }
}
