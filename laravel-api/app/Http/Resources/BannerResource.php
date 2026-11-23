<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\ExposesPublicMedia;
use App\Models\Banner;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Banner
 */
class BannerResource extends JsonResource
{
    use ExposesPublicMedia;

    /**
     * Transform the banner into an admin API representation.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title_mm' => $this->title_mm,
            'title_en' => $this->title_en,
            'subtitle_mm' => $this->subtitle_mm,
            'subtitle_en' => $this->subtitle_en,
            'cta_label_mm' => $this->cta_label_mm,
            'cta_label_en' => $this->cta_label_en,
            'link_url' => $this->link_url,
            'image' => $this->image,
            'image_url' => $this->publicMediaUrl($this->image),
            'sort_order' => $this->sort_order,
            'status' => $this->status,
            'background_style' => $this->background_style,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
