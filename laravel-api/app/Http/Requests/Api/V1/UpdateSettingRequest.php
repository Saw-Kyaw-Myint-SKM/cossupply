<?php

namespace App\Http\Requests\Api\V1;

use App\Models\Setting;
use App\Services\Setting\SettingService;
use Illuminate\Foundation\Http\FormRequest;

class UpdateSettingRequest extends FormRequest
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
     * The value rules depend on the requested setting key; unknown keys
     * are rejected by route model binding before validation runs.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $setting = $this->route('setting');

        if (! $setting instanceof Setting) {
            $setting = Setting::query()->where('key', $setting)->first();
        }

        return [
            'value' => array_merge(
                ['required'],
                $setting instanceof Setting
                    ? SettingService::validationRules($setting->key)
                    : ['string'],
            ),
        ];
    }
}
