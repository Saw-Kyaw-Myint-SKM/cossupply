<?php

namespace App\Http\Resources;

use App\Models\QuotationAction;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * One append-only customer action row for a quotation version.
 *
 * @mixin QuotationAction
 */
class QuotationActionResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'action' => $this->action->value,
            'customer_note' => $this->customer_note,
            'actor_type' => $this->actor_type,
            'actor_id' => $this->actor_id,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
