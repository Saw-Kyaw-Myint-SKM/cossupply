<?php

namespace App\Models;

use Database\Factories\AuditLogFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditLog extends Model
{
    /** @use HasFactory<AuditLogFactory> */
    use HasFactory;

    /**
     * Append-only audit trail: rows are never updated.
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
        'admin_id',
        'action',
        'entity_type',
        'entity_id',
        'old_data',
        'new_data',
        'ip_address',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'old_data' => 'array',
            'new_data' => 'array',
        ];
    }

    /**
     * The admin that performed the action.
     */
    public function admin(): BelongsTo
    {
        return $this->belongsTo(Admin::class);
    }
}
