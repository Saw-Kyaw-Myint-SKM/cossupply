<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\ExposesPublicMedia;
use App\Models\Category;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Public category representation exposed to guest browsing.
 *
 * @mixin Category
 */
class PublicCategoryResource extends JsonResource
{
    use ExposesPublicMedia;

    /**
     * Transform the category into an API representation.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'parent_id' => $this->parent_id,
            'name_mm' => $this->name_mm,
            'name_en' => $this->name_en,
            'slug' => $this->slug,
            'description' => $this->description,
            'image' => $this->image,
            'image_url' => $this->publicMediaUrl($this->image),
            'sort_order' => $this->sort_order,
        ];
    }
}
