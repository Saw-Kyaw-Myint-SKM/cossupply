<?php

namespace App\Http\Resources;

use App\Models\EmailLog;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Email delivery attempt shown in the Admin resend panel.
 *
 * @mixin EmailLog
 */
class EmailLogResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'recipient_email' => $this->recipient_email,
            'email_type' => $this->email_type,
            'subject' => $this->subject,
            'status' => $this->status,
            'sent_at' => $this->sent_at?->toIso8601String(),
            'error_message' => $this->error_message,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
