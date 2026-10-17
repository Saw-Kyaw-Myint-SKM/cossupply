<?php

namespace App\Http\Resources;

use App\Models\Setting;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Setting
 */
class SettingResource extends JsonResource
{
    /**
     * Transform the setting into a typed API representation.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'key' => $this->key,
            'value' => $this->typedValue(),
            'value_type' => $this->value_type,
            'group_name' => $this->group_name,
            'label' => $this->label,
            'description' => $this->description,
            'is_public' => (bool) $this->is_public,
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
