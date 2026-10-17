<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class EmailLog extends Model
{
    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'recipient_email',
        'related_type',
        'related_id',
        'email_type',
        'subject',
        'status',
        'sent_at',
        'error_message',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'sent_at' => 'datetime',
        ];
    }

    /**
     * The record the email relates to (quotation, order, ...).
     */
    public function related(): MorphTo
    {
        return $this->morphTo();
    }
}
