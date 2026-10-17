/**
 * Query-string helpers shared by every API module (admin and public).
 *
 * Extracted from `features/admin/api/catalogApiUtils.ts` so the public
 * catalog endpoints (Task 05) can build URLs without importing from the
 * admin feature folder.
 */

export interface PaginationMeta {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
}

export type QueryValue = string | number | boolean | null | undefined;

/**
 * Build a querystring from the given parameters, skipping empty values.
 * Returns '' when nothing is set, so callers can append it to the endpoint.
 */
export function toQueryString(params: Record<string, QueryValue>): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.append(key, String(value));
  }

  const query = search.toString();
  return query ? `?${query}` : '';
}
