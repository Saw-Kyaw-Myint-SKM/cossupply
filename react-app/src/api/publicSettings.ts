/**
 * Public (guest-readable) master settings.
 *
 * The storefront only needs the display preferences flagged `is_public` on the
 * server, such as how much supplier identity may appear on the catalog.
 */
import { apiRequest, type ApiResponse } from './client';

export type SupplierDisplay = 'CARD' | 'NAME' | 'HIDDEN';

export type PublicSettingValues = Record<string, string | number | boolean>;

/**
 * GET /settings/public
 *
 * Returns the public settings as a typed key => value map.
 */
export async function fetchPublicSettings(): Promise<
  ApiResponse<{ settings: PublicSettingValues }>
> {
  return apiRequest<{ settings: PublicSettingValues }>('/settings/public');
}
