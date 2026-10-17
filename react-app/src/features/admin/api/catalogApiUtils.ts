/**
 * Shared helpers for the admin catalog API modules (Task 04).
 *
 * Categories, suppliers, and products use the same paginated list envelope
 * (`data.<collection>` + `meta`) and the same multipart upload rules, so these
 * helpers live here instead of being duplicated per module.
 *
 * The URL/meta helpers are re-exported from `src/api/query.ts`, which is the
 * neutral home shared with the public catalog endpoints.
 */
export { toQueryString } from '../../../api/query';
export type { PaginationMeta, QueryValue } from '../../../api/query';

export type FormFieldValue = string | number | boolean | File | null | undefined;

/**
 * Build multipart form data for the catalog endpoints.
 *
 * - `undefined` and `null` values are omitted (for example "no new file").
 * - Empty file inputs are omitted.
 * - Booleans are sent as '1'/'0' (Laravel accepts both).
 * - Empty strings are kept: Laravel's `ConvertEmptyStringsToNull` middleware
 *   turns them into `null`, which is how nullable fields get cleared.
 */
export function buildFormData(fields: Record<string, FormFieldValue>): FormData {
  const form = new FormData();

  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;

    if (typeof File !== 'undefined' && value instanceof File) {
      if (value.size === 0 || value.name === '') continue;
      form.append(key, value);
      continue;
    }

    if (typeof value === 'boolean') {
      form.append(key, value ? '1' : '0');
      continue;
    }

    form.append(key, String(value));
  }

  return form;
}

/**
 * Split Laravel 422 errors into errors that belong to a form field and errors
 * that should be shown at form level. Unknown keys are treated as form-level.
 */
export function mapValidationErrors(
  raw: Record<string, string[]> | undefined,
  knownFields: readonly string[],
): { fieldErrors: Record<string, string[]>; formErrors: string[] } {
  const known = new Set(knownFields);
  const fieldErrors: Record<string, string[]> = {};
  const formErrors: string[] = [];

  for (const [key, messages] of Object.entries(raw ?? {})) {
    if (known.has(key)) {
      fieldErrors[key] = messages;
    } else {
      formErrors.push(...messages);
    }
  }

  return { fieldErrors, formErrors };
}
