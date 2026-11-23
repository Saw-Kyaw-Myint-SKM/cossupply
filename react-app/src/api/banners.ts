/**
 * Public banner API.
 *
 * The storefront hero is driven entirely by the admin-managed banners
 * endpoint (`GET /banners`). Only ACTIVE banners are returned, already in
 * display order, so the client never needs to filter or sort them.
 */
import { apiRequest, type ApiResponse } from './client';
import type { BannerTheme } from '../lib/banner-themes';

export interface PublicBanner {
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
  background_style: BannerTheme;
}

export interface BannerListResult {
  banners: PublicBanner[];
}

/** GET /banners — ACTIVE banners in display order. */
export async function listBanners(): Promise<ApiResponse<BannerListResult>> {
  return apiRequest<BannerListResult>('/banners');
}
