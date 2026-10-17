/**
 * Master settings API
 *
 * Wraps the admin settings endpoints (`GET/PUT/PATCH /admin/settings`).
 * Request and response envelopes match the documented contract in
 * `laravel-api/api_doc.md` (Task 03 — Master Settings).
 */
import { apiRequest, type ApiResponse } from '../../../api/client';

export type SettingValueType = 'string' | 'integer' | 'boolean';

export type SettingValue = string | number | boolean;

export interface Setting {
  key: string;
  value: SettingValue;
  value_type: SettingValueType;
  group_name: string;
  label: string;
  description: string | null;
  is_public: boolean;
  updated_at: string | null;
}

/**
 * GET /admin/settings
 *
 * Returns every master setting ordered by `group_name` then `key`.
 */
export async function fetchSettings(): Promise<ApiResponse<{ settings: Setting[] }>> {
  return apiRequest<{ settings: Setting[] }>('/admin/settings');
}

/**
 * PUT /admin/settings/{key}
 *
 * Updates a single setting. 404 for an unknown key, 422 with
 * `errors.value` when the value fails the key's typed rules.
 */
export async function updateSetting(
  key: string,
  value: SettingValue,
): Promise<ApiResponse<{ setting: Setting }>> {
  return apiRequest<{ setting: Setting }>(`/admin/settings/${encodeURIComponent(key)}`, {
    method: 'PUT',
    body: JSON.stringify({ value }),
  });
}

/**
 * PATCH /admin/settings
 *
 * Updates several settings in one transaction (all-or-nothing). 422 errors are
 * keyed as `settings.<key>`. The response contains the requested settings with
 * their current values.
 */
export async function bulkUpdateSettings(
  values: Record<string, SettingValue>,
): Promise<ApiResponse<{ settings: Setting[] }>> {
  return apiRequest<{ settings: Setting[] }>('/admin/settings', {
    method: 'PATCH',
    body: JSON.stringify({ settings: values }),
  });
}
