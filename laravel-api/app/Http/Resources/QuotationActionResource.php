<?php

namespace App\Http\Resources;

use App\Models\QuotationAction;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * One customer action in the quotation trail.
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
            'id' => $this->id,
            'action' => $this->action->value,
            'customer_note' => $this->customer_note,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
