<?php

namespace App\Http\Requests\Api\V1;

use App\Models\Setting;
use App\Services\Setting\SettingService;
use Illuminate\Contracts\Validation\Validator as ValidatorContract;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Validator;

class BulkUpdateSettingRequest extends FormRequest
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
            'settings' => ['required', 'array', 'min:1'],
        ];
    }

    /**
     * Validate every requested key against its typed rules.
     *
     * Unknown keys and values that do not match the setting's declared
     * type are reported per key so the whole batch is rejected.
     *
     * @return array<int, callable>
     */
    public function after(): array
    {
        return [
            function (ValidatorContract $validator): void {
                $settings = $this->input('settings');

                if (! is_array($settings)) {
                    return;
                }

                $knownKeys = Setting::query()
                    ->whereIn('key', array_keys($settings))
                    ->pluck('key')
                    ->all();

                foreach ($settings as $key => $value) {
                    if (! in_array($key, $knownKeys, true)) {
                        $validator->errors()->add("settings.{$key}", "Unknown setting key [{$key}].");

                        continue;
                    }

                    $valueValidator = Validator::make(
                        ['value' => $value],
                        ['value' => array_merge(['required'], SettingService::validationRules($key))],
                    );

                    foreach ($valueValidator->errors()->all() as $message) {
                        $validator->errors()->add("settings.{$key}", $message);
                    }
                }
            },
        ];
    }
}
