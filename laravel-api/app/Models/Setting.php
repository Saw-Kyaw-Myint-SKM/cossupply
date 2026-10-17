<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Setting extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'key',
        'value',
        'value_type',
        'group_name',
        'label',
        'description',
        'is_public',
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
            'is_public' => 'boolean',
        ];
    }

    /**
     * Resolve settings by their key in route model binding.
     */
    public function getRouteKeyName(): string
    {
        return 'key';
    }

    /**
     * Only settings that may be exposed publicly.
     */
    #[Scope]
    protected function public(Builder $query): void
    {
        $query->where('is_public', true);
    }

    /**
     * Get the stored string value converted to its declared type.
     */
    public function typedValue(): mixed
    {
        return match ($this->value_type) {
            'integer' => (int) $this->value,
            'boolean' => filter_var($this->value, FILTER_VALIDATE_BOOLEAN),
            default => $this->value,
        };
    }

    /**
     * The admin who last updated the setting.
     */
    public function updatedByAdmin(): BelongsTo
    {
        return $this->belongsTo(Admin::class, 'updated_by_admin_id');
    }
}
