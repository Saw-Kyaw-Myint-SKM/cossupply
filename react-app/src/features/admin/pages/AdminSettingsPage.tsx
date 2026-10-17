import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  bulkUpdateSettings,
  fetchSettings,
  type Setting,
  type SettingValue,
} from '../api/settingsApi';
import type { ApiResponse } from '../../../api/client';

/**
 * Admin Master Settings Page
 *
 * Loads every master setting, groups them by `group_name`, and saves all edited
 * values in a single `PATCH /admin/settings` request (all-or-nothing).
 */

type DraftValue = string | boolean;
type Draft = Record<string, DraftValue>;

interface LoadErrorState {
  message: string;
  needsLogin: boolean;
}

interface SelectOption {
  value: string;
  label: string;
}

interface IntegerBounds {
  min?: number;
  max?: number;
}

const GROUP_TITLES: Record<string, string> = {
  company: 'Company',
  localization: 'Localization',
  quotation: 'Quotations',
  order: 'Orders',
  payment: 'Payments',
};

const SELECT_OPTIONS: Record<string, readonly SelectOption[]> = {
  default_currency: [{ value: 'MMK', label: 'MMK (Myanmar Kyat)' }],
  timezone: [{ value: 'Asia/Yangon', label: 'Asia/Yangon (Myanmar Time, UTC+6:30)' }],
  delivery_fee_mode: [{ value: 'MANUAL_PER_QUOTATION', label: 'Manual per quotation' }],
  payment_method: [{ value: 'CASH_ON_DELIVERY', label: 'Cash on delivery' }],
};

const TEXT_FIELD_RULES: Record<
  string,
  { inputType: 'text' | 'email' | 'tel'; maxLength?: number; pattern?: string }
> = {
  company_name: { inputType: 'text', maxLength: 255 },
  company_phone: { inputType: 'tel', maxLength: 50 },
  company_email: { inputType: 'email', maxLength: 255 },
  company_address: { inputType: 'text', maxLength: 1000 },
  quotation_number_prefix: { inputType: 'text', maxLength: 10, pattern: '[A-Za-z0-9]+' },
  order_number_prefix: { inputType: 'text', maxLength: 10, pattern: '[A-Za-z0-9]+' },
};

const INTEGER_BOUNDS: Record<string, IntegerBounds> = {
  quotation_validity_days: { min: 1 },
  quotation_service_fee_percentage: { min: 0, max: 100 },
  default_delivery_fee: { min: 0 },
};

function fieldId(key: string): string {
  return `setting-${key}`;
}

function descriptionId(key: string): string {
  return `setting-${key}-description`;
}

function errorId(key: string): string {
  return `setting-${key}-error`;
}

function buildDraft(settings: Setting[]): Draft {
  const draft: Draft = {};
  for (const setting of settings) {
    draft[setting.key] =
      setting.value_type === 'boolean' ? setting.value === true : String(setting.value);
  }
  return draft;
}

function isDirty(setting: Setting, draftValue: DraftValue | undefined): boolean {
  if (draftValue === undefined) return false;
  if (setting.value_type === 'boolean') {
    return draftValue !== (setting.value === true);
  }
  return draftValue !== String(setting.value);
}

function toSettingValue(setting: Setting, draftValue: DraftValue): SettingValue | null {
  if (setting.value_type === 'boolean') {
    return typeof draftValue === 'boolean' ? draftValue : null;
  }

  if (setting.value_type === 'integer') {
    const raw = String(draftValue).trim();
    if (raw === '') return null;
    const parsed = Number(raw);
    return Number.isInteger(parsed) ? parsed : null;
  }

  return typeof draftValue === 'string' ? draftValue : null;
}

function invalidValueMessage(setting: Setting): string {
  if (setting.value_type === 'integer') {
    return 'Enter a whole number.';
  }
  if (setting.value_type === 'boolean') {
    return 'Choose a value for this setting.';
  }
  return 'Enter a value for this setting.';
}

function mergeSettings(current: Setting[], updated: Setting[]): Setting[] {
  const updatedByKey = new Map(updated.map((setting) => [setting.key, setting]));
  return current.map((setting) => updatedByKey.get(setting.key) ?? setting);
}

function groupTitle(groupName: string): string {
  const known = GROUP_TITLES[groupName];
  if (known) return known;

  const spaced = groupName.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function optionsFor(setting: Setting): readonly SelectOption[] | null {
  const configured = SELECT_OPTIONS[setting.key];
  if (!configured) return null;

  const currentValue = String(setting.value);
  if (configured.some((option) => option.value === currentValue)) {
    return configured;
  }

  // Keep an unexpected stored value selectable instead of silently replacing it.
  return [...configured, { value: currentValue, label: `${currentValue} (current)` }];
}

function describeLoadError(response: ApiResponse<unknown>): LoadErrorState {
  if (response.status === 401) {
    return {
      message: 'Your admin session has expired. Sign in again to view master settings.',
      needsLogin: true,
    };
  }
  if (response.status === 403) {
    return {
      message:
        response.message ?? 'Your account does not have permission to view master settings.',
      needsLogin: false,
    };
  }
  if (response.status === undefined) {
    return {
      message: 'Could not reach the server. Check that the API is running and try again.',
      needsLogin: false,
    };
  }
  return {
    message: response.message ?? 'Unable to load master settings.',
    needsLogin: false,
  };
}

function describeSaveError(response: ApiResponse<unknown>): string {
  if (response.status === 401) {
    return 'Your admin session has expired. Sign in again, then save your changes.';
  }
  if (response.status === 403) {
    return (
      response.message ?? 'Your account does not have permission to change master settings.'
    );
  }
  if (response.status === undefined) {
    return 'Could not reach the server, so nothing was saved. Try again.';
  }
  return response.message ?? 'The settings could not be saved.';
}

const inputBaseClass =
  'block w-full rounded-md border px-3 py-2 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500';
const inputNormalClass = 'border-gray-300 focus:border-blue-500 focus:ring-blue-500';
const inputErrorClass = 'border-red-300 focus:border-red-500 focus:ring-red-500';

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Setting[] | null>(null);
  const [draft, setDraft] = useState<Draft>({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<LoadErrorState | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const formAlertRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setLoadError(null);
      setSuccessMessage(null);

      const response = await fetchSettings();

      if (cancelled) return;

      if (response.success && response.data) {
        const loaded = response.data.settings;
        setSettings(loaded);
        setDraft(buildDraft(loaded));
        setFieldErrors({});
      } else {
        setLoadError(describeLoadError(response));
      }

      setIsLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const groups = useMemo<{ name: string; items: Setting[] }[]>(() => {
    if (!settings) return [];

    const grouped = new Map<string, Setting[]>();
    for (const setting of settings) {
      const existing = grouped.get(setting.group_name);
      if (existing) {
        existing.push(setting);
      } else {
        grouped.set(setting.group_name, [setting]);
      }
    }

    return Array.from(grouped, ([name, items]) => ({ name, items }));
  }, [settings]);

  const dirtyKeys = useMemo<string[]>(() => {
    if (!settings) return [];
    return settings
      .filter((setting) => isDirty(setting, draft[setting.key]))
      .map((setting) => setting.key);
  }, [settings, draft]);

  const dirtyKeySet = useMemo(() => new Set(dirtyKeys), [dirtyKeys]);
  const hasChanges = dirtyKeys.length > 0;

  const handleValueChange = (key: string, value: DraftValue) => {
    setDraft((previous) => ({ ...previous, [key]: value }));
    setSuccessMessage(null);
    setFormError(null);
    setFieldErrors((previous) => {
      if (!previous[key]) return previous;
      const next = { ...previous };
      delete next[key];
      return next;
    });
  };

  const focusFirstError = (errors: Record<string, string[]>) => {
    const firstKey = Object.keys(errors)[0];

    requestAnimationFrame(() => {
      if (firstKey) {
        document.getElementById(fieldId(firstKey))?.focus();
        return;
      }
      formAlertRef.current?.focus();
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!settings || isSaving || !hasChanges) return;

    const payload: Record<string, SettingValue> = {};
    const localErrors: Record<string, string[]> = {};

    for (const setting of settings) {
      if (!dirtyKeySet.has(setting.key)) continue;

      const draftValue = draft[setting.key];
      const value = draftValue === undefined ? null : toSettingValue(setting, draftValue);

      if (value === null) {
        localErrors[setting.key] = [invalidValueMessage(setting)];
      } else {
        payload[setting.key] = value;
      }
    }

    if (Object.keys(localErrors).length > 0) {
      setSuccessMessage(null);
      setFieldErrors(localErrors);
      setFormError('Some values need attention before saving.');
      focusFirstError(localErrors);
      return;
    }

    setIsSaving(true);
    setFormError(null);
    setFieldErrors({});
    setSuccessMessage(null);

    const response = await bulkUpdateSettings(payload);

    setIsSaving(false);

    if (response.success && response.data) {
      const merged = mergeSettings(settings, response.data.settings);
      setSettings(merged);
      setDraft(buildDraft(merged));
      setSuccessMessage(response.message ?? 'Settings updated.');
      return;
    }

    const mappedErrors: Record<string, string[]> = {};
    let formMessage = describeSaveError(response);

    for (const [errorKey, messages] of Object.entries(response.errors ?? {})) {
      if (errorKey.startsWith('settings.')) {
        mappedErrors[errorKey.slice('settings.'.length)] = messages;
      } else if (messages.length > 0) {
        // `settings` (or any other unexpected key) is shown at form level.
        formMessage = messages[0];
      }
    }

    setFieldErrors(mappedErrors);
    setFormError(formMessage);
    focusFirstError(mappedErrors);
  };

  const renderControl = (setting: Setting) => {
    const id = fieldId(setting.key);
    const draftValue = draft[setting.key];
    const hasError = Boolean(fieldErrors[setting.key]);
    const controlClass = `${inputBaseClass} ${hasError ? inputErrorClass : inputNormalClass}`;
    const describedBy =
      [
        setting.description ? descriptionId(setting.key) : null,
        hasError ? errorId(setting.key) : null,
      ]
        .filter(Boolean)
        .join(' ') || undefined;

    if (setting.value_type === 'boolean') {
      const checked = draftValue === true;
      return (
        <div className="flex items-center gap-2">
          <input
            id={id}
            type="checkbox"
            checked={checked}
            disabled={isSaving}
            aria-invalid={hasError || undefined}
            aria-describedby={describedBy}
            onChange={(event) => handleValueChange(setting.key, event.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          />
          <span className="text-sm text-gray-600" aria-hidden="true">
            {checked ? 'Enabled' : 'Disabled'}
          </span>
        </div>
      );
    }

    if (setting.value_type === 'integer') {
      const bounds = INTEGER_BOUNDS[setting.key];
      return (
        <input
          id={id}
          type="number"
          step={1}
          min={bounds?.min}
          max={bounds?.max}
          inputMode="numeric"
          required
          value={typeof draftValue === 'string' ? draftValue : ''}
          disabled={isSaving}
          aria-invalid={hasError || undefined}
          aria-describedby={describedBy}
          onChange={(event) => handleValueChange(setting.key, event.target.value)}
          className={`${controlClass} max-w-xs`}
        />
      );
    }

    const selectOptions = optionsFor(setting);
    if (selectOptions) {
      return (
        <select
          id={id}
          required
          value={typeof draftValue === 'string' ? draftValue : ''}
          disabled={isSaving}
          aria-invalid={hasError || undefined}
          aria-describedby={describedBy}
          onChange={(event) => handleValueChange(setting.key, event.target.value)}
          className={`${controlClass} max-w-md`}
        >
          {selectOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }

    const rules = TEXT_FIELD_RULES[setting.key];
    return (
      <input
        id={id}
        type={rules?.inputType ?? 'text'}
        required
        maxLength={rules?.maxLength}
        pattern={rules?.pattern}
        title={rules?.pattern ? 'Use letters and numbers only.' : undefined}
        value={typeof draftValue === 'string' ? draftValue : ''}
        disabled={isSaving}
        aria-invalid={hasError || undefined}
        aria-describedby={describedBy}
        onChange={(event) => handleValueChange(setting.key, event.target.value)}
        className={controlClass}
      />
    );
  };

  if (isLoading) {
    return (
      <div
        className="flex min-h-[60vh] items-center justify-center"
        role="status"
        aria-live="polite"
      >
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600 motion-reduce:animate-none" />
        <span className="sr-only">Loading master settings…</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg bg-white p-6 shadow">
          <h1 className="text-2xl font-bold text-gray-900">Master Settings</h1>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-6" role="alert">
          <h2 className="text-lg font-semibold text-red-800">Settings are unavailable</h2>
          <p className="mt-1 text-sm text-red-700">{loadError.message}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setReloadToken((token) => token + 1)}
              className="rounded-md bg-gray-800 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              Try again
            </button>
            {loadError.needsLogin ? (
              <Link
                to="/admin/login"
                className="text-sm font-medium text-gray-700 underline hover:text-gray-900"
              >
                Go to admin login
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  if (!settings || settings.length === 0) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg bg-white p-6 shadow">
          <h1 className="text-2xl font-bold text-gray-900">Master Settings</h1>
          <p className="mt-1 text-gray-600">
            Operational defaults for quotations, orders, and payments.
          </p>
        </div>
        <div className="rounded-lg bg-white p-6 text-center shadow">
          <h2 className="text-lg font-semibold text-gray-900">No settings found</h2>
          <p className="mt-1 text-sm text-gray-500">
            The settings catalog is empty. Refresh to check again.
          </p>
          <button
            type="button"
            onClick={() => setReloadToken((token) => token + 1)}
            className="mt-4 rounded-md bg-gray-800 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-white p-6 shadow">
        <h1 className="text-2xl font-bold text-gray-900">Master Settings</h1>
        <p className="mt-1 text-gray-600">
          Company details, numbering, quotation defaults, and payment rules used across CoSupply.
        </p>
        <p className="mt-2 text-sm text-gray-500">
          {settings.length} settings across {groups.length} groups. Edited values are saved
          together or not at all.
        </p>
      </div>

      {successMessage ? (
        <div role="status" className="rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="text-sm font-medium text-green-800">{successMessage}</p>
        </div>
      ) : null}

      {formError ? (
        <div
          ref={formAlertRef}
          tabIndex={-1}
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          <p className="text-sm font-medium text-red-700">{formError}</p>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-6">
        {groups.map((group) => (
          <section key={group.name} className="rounded-lg bg-white shadow">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">{groupTitle(group.name)}</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {group.items.map((setting) => {
                const fieldMessages = fieldErrors[setting.key];
                return (
                  <div key={setting.key} className="px-6 py-5 sm:grid sm:grid-cols-3 sm:gap-6">
                    <div className="mb-2 sm:mb-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <label
                          htmlFor={fieldId(setting.key)}
                          className="text-sm font-medium text-gray-900"
                        >
                          {setting.label}
                        </label>
                        {setting.is_public ? (
                          <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                            Public
                          </span>
                        ) : null}
                      </div>
                      {setting.description ? (
                        <p
                          id={descriptionId(setting.key)}
                          className="mt-1 text-sm text-gray-500"
                        >
                          {setting.description}
                        </p>
                      ) : null}
                    </div>

                    <div className="sm:col-span-2">
                      {renderControl(setting)}
                      {fieldMessages && fieldMessages.length > 0 ? (
                        <p id={errorId(setting.key)} className="mt-1.5 text-sm text-red-600">
                          {fieldMessages[0]}
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow">
          <p className="text-sm text-gray-600" aria-live="polite">
            {isSaving
              ? 'Saving changes…'
              : hasChanges
                ? `${dirtyKeys.length} unsaved ${dirtyKeys.length === 1 ? 'change' : 'changes'}`
                : 'All changes saved'}
          </p>
          <button
            type="submit"
            disabled={!hasChanges || isSaving}
            className="rounded-md border border-transparent bg-gray-800 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
