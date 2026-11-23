<?php

namespace App\Http\Requests\Api\V1;

use App\Models\Banner;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreBannerRequest extends FormRequest
{
    /**
     * Route access is enforced by the auth:sanctum + admin middleware.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'title_mm' => ['required', 'string', 'max:120'],
            'title_en' => ['required', 'string', 'max:120'],
            'subtitle_mm' => ['nullable', 'string', 'max:255'],
            'subtitle_en' => ['nullable', 'string', 'max:255'],
            'cta_label_mm' => ['nullable', 'string', 'max:60'],
            'cta_label_en' => ['nullable', 'string', 'max:60'],
            'link_url' => ['nullable', 'string', 'max:2048', 'regex:#^(https?://|/)#'],
            'image' => ['nullable', 'file', 'mimes:jpeg,jpg,png,webp', 'max:4096'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'status' => ['nullable', Rule::in(Banner::STATUSES)],
            'background_style' => ['nullable', Rule::in(Banner::BACKGROUND_STYLES)],
        ];
    }

    /**
     * Human-readable field names for validation messages.
     *
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'title_mm' => 'Myanmar title',
            'title_en' => 'English title',
            'subtitle_mm' => 'Myanmar subtitle',
            'subtitle_en' => 'English subtitle',
            'cta_label_mm' => 'Myanmar button label',
            'cta_label_en' => 'English button label',
            'link_url' => 'button link',
            'background_style' => 'background theme',
        ];
    }
}
