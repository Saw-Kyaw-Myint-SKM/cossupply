<?php

namespace App\Services\Setting;

use App\Models\Admin;
use App\Models\Setting;
use App\Services\Audit\AuditLogService;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Facades\DB;

/**
 * Typed key/value master settings engine.
 *
 * Values are stored as strings in the database and exposed through the
 * declared value_type. Every changed setting is written to audit_logs
 * with the prior value, the new value and the responsible admin.
 */
class SettingService
{
    /**
     * Validation rules for every documented setting key. Keys missing
     * from this map cannot be updated through the API.
     *
     * @var array<string, array<int, string>>
     */
    private const VALUE_RULES = [
        'company_name' => ['string', 'max:255'],
        'company_phone' => ['string', 'max:50'],
        'company_email' => ['string', 'email', 'max:255'],
        'company_address' => ['string', 'max:1000'],
        'default_currency' => ['string', 'in:MMK'],
        'timezone' => ['string', 'timezone'],
        'quotation_number_prefix' => ['string', 'max:10', 'alpha_num'],
        'quotation_validity_days' => ['integer', 'min:1'],
        'quotation_service_fee_percentage' => ['integer', 'min:0', 'max:100'],
        'order_number_prefix' => ['string', 'max:10', 'alpha_num'],
        'default_delivery_fee' => ['integer', 'min:0'],
        'delivery_fee_mode' => ['string', 'in:MANUAL_PER_QUOTATION'],
        'payment_method' => ['string', 'in:CASH_ON_DELIVERY'],
        'require_full_payment' => ['boolean'],
        'require_receipt_number' => ['boolean'],
    ];

    public function __construct(
        private readonly AuditLogService $auditLogs,
    ) {}

    /**
     * Whether the given key is a documented, updatable setting.
     */
    public static function isKnownKey(string $key): bool
    {
        return array_key_exists($key, self::VALUE_RULES);
    }

    /**
     * Get the validation rules for a setting key.
     *
     * @return array<int, string>
     */
    public static function validationRules(string $key): array
    {
        return self::VALUE_RULES[$key] ?? ['string'];
    }

    /**
     * Read a single setting as its typed value.
     */
    public function get(string $key, mixed $default = null): mixed
    {
        $setting = Setting::query()->where('key', $key)->first();

        return $setting?->typedValue() ?? $default;
    }

    /**
     * Get every setting ordered for display.
     *
     * @return Collection<int, Setting>
     */
    public function all(): Collection
    {
        return Setting::query()
            ->orderBy('group_name')
            ->orderBy('key')
            ->get();
    }

    /**
     * Get every setting as key => typed value.
     *
     * @return array<string, mixed>
     */
    public function values(): array
    {
        return $this->all()
            ->mapWithKeys(fn (Setting $setting): array => [$setting->key => $setting->typedValue()])
            ->all();
    }

    /**
     * Get the public settings as key => typed value.
     *
     * Reserved for the public settings capability; no HTTP endpoint is
     * exposed in this task.
     *
     * @return array<string, mixed>
     */
    public function publicValues(): array
    {
        return Setting::query()
            ->public()
            ->orderBy('key')
            ->get()
            ->mapWithKeys(fn (Setting $setting): array => [$setting->key => $setting->typedValue()])
            ->all();
    }

    /**
     * Update a single setting and audit the change.
     *
     * Returns the unchanged setting without writing an audit entry when
     * the value is identical to the stored value.
     *
     * @throws ModelNotFoundException
     */
    public function update(string $key, mixed $value, Admin $admin, ?string $ip = null): Setting
    {
        return DB::transaction(function () use ($key, $value, $admin, $ip): Setting {
            $setting = Setting::query()->where('key', $key)->lockForUpdate()->first();

            if ($setting === null) {
                throw (new ModelNotFoundException)->setModel(Setting::class, [$key]);
            }

            $this->applyUpdate($setting, $value, $admin, $ip);

            return $setting;
        });
    }

    /**
     * Update multiple settings atomically and audit every changed key.
     *
     * All-or-nothing: any failure rolls the whole batch back. Unchanged
     * keys are returned but not audited.
     *
     * @param  array<string, mixed>  $values
     * @return Collection<int, Setting>
     *
     * @throws ModelNotFoundException
     */
    public function bulkUpdate(array $values, Admin $admin, ?string $ip = null): Collection
    {
        return DB::transaction(function () use ($values, $admin, $ip): Collection {
            $settings = Setting::query()
                ->whereIn('key', array_keys($values))
                ->lockForUpdate()
                ->get()
                ->keyBy('key');

            $updated = new Collection;

            foreach ($values as $key => $value) {
                $setting = $settings->get($key);

                if ($setting === null) {
                    throw (new ModelNotFoundException)->setModel(Setting::class, [$key]);
                }

                $this->applyUpdate($setting, $value, $admin, $ip);

                $updated->push($setting);
            }

            return $updated;
        });
    }

    /**
     * Persist one setting value and audit the change when it differs.
     */
    private function applyUpdate(Setting $setting, mixed $value, Admin $admin, ?string $ip): void
    {
        $normalized = $this->normalizeValue($value, $setting->value_type);

        if ($setting->value === $normalized) {
            return;
        }

        $oldData = ['key' => $setting->key, 'value' => $setting->typedValue()];

        $setting->update([
            'value' => $normalized,
            'updated_by_admin_id' => $admin->id,
        ]);

        $this->auditLogs->log(
            $admin,
            'setting.updated',
            'setting',
            (string) $setting->id,
            $oldData,
            ['key' => $setting->key, 'value' => $setting->typedValue()],
            $ip,
        );
    }

    /**
     * Convert an incoming value to the string representation stored in DB.
     */
    private function normalizeValue(mixed $value, string $valueType): string
    {
        return match ($valueType) {
            'integer' => (string) (int) $value,
            'boolean' => filter_var($value, FILTER_VALIDATE_BOOLEAN) ? '1' : '0',
            default => (string) $value,
        };
    }
}
