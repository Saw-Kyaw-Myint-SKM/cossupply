/**
 * Admin categories API (Task 04).
 *
 * Wraps `/admin/categories` as documented in `laravel-api/api_doc.md`.
 * Create and update payloads are multipart so an image can be attached; the
 * update sends `_method=PUT` so PHP parses the uploaded file.
 */
import { apiRequest, type ApiResponse } from '../../../api/client';
import { buildFormData, toQueryString, type PaginationMeta } from './catalogApiUtils';

export type CategoryStatus = 'ACTIVE' | 'INACTIVE';

export interface Category {
  id: number;
  parent_id: number | null;
  name_mm: string;
  name_en: string;
  slug: string;
  description: string | null;
  image: string | null;
  image_url: string | null;
  sort_order: number;
  status: CategoryStatus;
  created_at: string;
  updated_at: string;
}

export interface CategoryListParams {
  page?: number;
  per_page?: number;
  search?: string;
  status?: CategoryStatus | '';
  parent_id?: number | string;
}

export interface CategoryListResult {
  categories: Category[];
  meta: PaginationMeta;
}

/** Form-shaped input; the module turns it into multipart form data. */
export interface CategoryInput {
  /** '' means "no parent" (top level). */
  parent_id: string;
  name_mm: string;
  name_en: string;
  /** '' means "let the server derive/keep the slug". */
  slug: string;
  /** '' clears the description (converted to null by the API). */
  description: string;
  /** '' lets the server use its default (0 on create, unchanged on update). */
  sort_order: string;
  status: CategoryStatus;
  /** null means "keep the current image". */
  image: File | null;
}

/** Field keys the create/update endpoints can report 422 errors for. */
export const CATEGORY_FIELDS = [
  'name_mm',
  'name_en',
  'parent_id',
  'slug',
  'description',
  'image',
  'sort_order',
  'status',
] as const;

export function buildCategoryFormData(input: CategoryInput): FormData {
  const sortOrder = input.sort_order.trim();

  return buildFormData({
    parent_id: input.parent_id,
    name_mm: input.name_mm.trim(),
    name_en: input.name_en.trim(),
    slug: input.slug.trim() || null,
    description: input.description.trim(),
    sort_order: sortOrder === '' ? null : sortOrder,
    status: input.status,
    image: input.image,
  });
}

/**
 * GET /admin/categories
 *
 * Paginated list ordered by `sort_order`, then `name_en`, then `id`.
 */
export async function listCategories(
  params: CategoryListParams = {},
): Promise<ApiResponse<CategoryListResult>> {
  const query = toQueryString({
    page: params.page,
    per_page: params.per_page,
    search: params.search,
    status: params.status,
    parent_id: params.parent_id,
  });

  return apiRequest<CategoryListResult>(`/admin/categories${query}`);
}

/** GET /admin/categories/{id} */
export async function getCategory(id: number): Promise<ApiResponse<{ category: Category }>> {
  return apiRequest<{ category: Category }>(`/admin/categories/${id}`);
}

/** POST /admin/categories (multipart) */
export async function createCategory(
  formData: FormData,
): Promise<ApiResponse<{ category: Category }>> {
  return apiRequest<{ category: Category }>('/admin/categories', {
    method: 'POST',
    body: formData,
  });
}

/**
 * PATCH /admin/categories/{id} as multipart.
 *
 * Sent as POST with `_method=PUT` so PHP parses an attached replacement image.
 */
export async function updateCategory(
  id: number,
  formData: FormData,
): Promise<ApiResponse<{ category: Category }>> {
  // Copy so adding the method override never mutates the caller's FormData.
  const body = new FormData();
  formData.forEach((value, key) => {
    body.append(key, value);
  });
  body.append('_method', 'PUT');

  return apiRequest<{ category: Category }>(`/admin/categories/${id}`, {
    method: 'POST',
    body,
  });
}

/** DELETE /admin/categories/{id} (409 when it has children/products). */
export async function deleteCategory(id: number): Promise<ApiResponse<null>> {
  return apiRequest<null>(`/admin/categories/${id}`, { method: 'DELETE' });
}
