<?php

namespace App\Http\Resources;

use App\Models\SupplierCommunication;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Append-only supplier contact log entry.
 *
 * @mixin SupplierCommunication
 */
class SupplierCommunicationResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'supplier_id' => $this->supplier_id,
            'contact_method' => $this->contact_method,
            'message_text' => $this->message_text,
            'supplier_response' => $this->supplier_response,
            'attachment_path' => $this->attachment_path,
            'attachment_url' => $this->attachment_path !== null
                ? '/admin/files/'.$this->attachment_path
                : null,
            'contacted_at' => $this->contacted_at?->toIso8601String(),
            'responded_at' => $this->responded_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'admin' => $this->whenLoaded('admin', fn (): array => [
                'id' => $this->admin->id,
                'name' => $this->admin->name,
            ]),
        ];
    }
}
