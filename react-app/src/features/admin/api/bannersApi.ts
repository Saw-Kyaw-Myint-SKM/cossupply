/**
 * Admin banners API.
 *
 * Wraps `/admin/banners` as documented in `laravel-api/api_doc.md`.
 * Create and update payloads are multipart so the banner image can be
 * attached; the update sends `_method=PUT` so PHP parses the uploaded file.
 */
import { apiRequest, type ApiResponse } from '../../../api/client';
import { DEFAULT_BANNER_THEME, type BannerTheme } from '../../../lib/banner-themes';
import { buildFormData, toQueryString, type PaginationMeta } from './catalogApiUtils';

export type BannerStatus = 'ACTIVE' | 'INACTIVE';

export interface Banner {
  id: number;
  title_mm: string;
  title_en: string;
  subtitle_mm: string | null;
  subtitle_en: string | null;
  cta_label_mm: string | null;
  cta_label_en: string | null;
  link_url: string | null;
  image: string | null;
  image_url: string | null;
  sort_order: number;
  status: BannerStatus;
  background_style: BannerTheme;
  created_at: string;
  updated_at: string;
}

export interface BannerListParams {
  page?: number;
  per_page?: number;
  search?: string;
  status?: BannerStatus | '';
  sort_by?: 'created_at';
  sort_direction?: 'asc' | 'desc';
}

export interface BannerListResult {
  banners: Banner[];
  meta: PaginationMeta;
}

/** Form-shaped input; the module turns it into multipart form data. */
export interface BannerInput {
  title_mm: string;
  title_en: string;
  subtitle_mm: string;
  subtitle_en: string;
  cta_label_mm: string;
  cta_label_en: string;
  /** '' means "hide the button". */
  link_url: string;
  /** '' lets the server use its default (0 on create, unchanged on update). */
  sort_order: string;
  status: BannerStatus;
  background_style: BannerTheme;
  /** null means "keep the current image" on update. */
  image: File | null;
}

/** Field keys the create/update endpoints can report 422 errors for. */
export const BANNER_FIELDS = [
  'title_mm',
  'title_en',
  'subtitle_mm',
  'subtitle_en',
  'cta_label_mm',
  'cta_label_en',
  'link_url',
  'image',
  'sort_order',
  'status',
  'background_style',
] as const;

export function buildBannerFormData(input: BannerInput): FormData {
  const sortOrder = input.sort_order.trim();

  return buildFormData({
    title_mm: input.title_mm.trim(),
    title_en: input.title_en.trim(),
    subtitle_mm: input.subtitle_mm.trim(),
    subtitle_en: input.subtitle_en.trim(),
    cta_label_mm: input.cta_label_mm.trim(),
    cta_label_en: input.cta_label_en.trim(),
    link_url: input.link_url.trim(),
    sort_order: sortOrder === '' ? null : sortOrder,
    status: input.status,
    background_style: input.background_style || DEFAULT_BANNER_THEME,
    image: input.image,
  });
}

/** GET /admin/banners */
export async function listBanners(
  params: BannerListParams = {},
): Promise<ApiResponse<BannerListResult>> {
  const query = toQueryString({
    page: params.page,
    per_page: params.per_page,
    search: params.search,
    status: params.status,
    sort_by: params.sort_by,
    sort_direction: params.sort_direction,
  });

  return apiRequest<BannerListResult>(`/admin/banners${query}`);
}

/** GET /admin/banners/{id} */
export async function getBanner(id: number): Promise<ApiResponse<{ banner: Banner }>> {
  return apiRequest<{ banner: Banner }>(`/admin/banners/${id}`);
}

/** POST /admin/banners (multipart) */
export async function createBanner(
  formData: FormData,
): Promise<ApiResponse<{ banner: Banner }>> {
  return apiRequest<{ banner: Banner }>('/admin/banners', {
    method: 'POST',
    body: formData,
  });
}

/**
 * PUT /admin/banners/{id} as multipart.
 *
 * Sent as POST with `_method=PUT` so PHP parses an attached replacement image.
 */
export async function updateBanner(
  id: number,
  formData: FormData,
): Promise<ApiResponse<{ banner: Banner }>> {
  // Copy so adding the method override never mutates the caller's FormData.
  const body = new FormData();
  formData.forEach((value, key) => {
    body.append(key, value);
  });
  body.append('_method', 'PUT');

  return apiRequest<{ banner: Banner }>(`/admin/banners/${id}`, {
    method: 'POST',
    body,
  });
}

/** DELETE /admin/banners/{id} */
export async function deleteBanner(id: number): Promise<ApiResponse<null>> {
  return apiRequest<null>(`/admin/banners/${id}`, { method: 'DELETE' });
}
