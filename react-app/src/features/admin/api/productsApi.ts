/**
 * Admin products API (Task 04).
 *
 * Wraps `/admin/products` as documented in `laravel-api/api_doc.md`.
 * Create and update payloads are multipart because the photo is required on
 * create; the update sends `_method=PUT` so PHP parses the uploaded file.
 * Status changes always go through `PATCH /admin/products/{id}/status`.
 */
import { apiRequest, type ApiResponse } from '../../../api/client';
import { buildFormData, toQueryString, type PaginationMeta } from './catalogApiUtils';

export type ProductStatus = 'DRAFT' | 'PUBLISHED' | 'HIDDEN' | 'OUT_OF_STOCK';

export type StockStatus =
  | 'IN_STOCK'
  | 'LOW_STOCK'
  | 'OUT_OF_STOCK'
  | 'PRE_ORDER'
  | 'SUPPLIER_CONFIRMATION_REQUIRED';

export interface ProductPrice {
  id: number;
  retail_price: number;
  wholesale_price: number | null;
  discount_price: number | null;
  minimum_order_quantity: number;
  price_valid_until: string | null;
  last_updated_at: string | null;
}

export interface ProductStock {
  id: number;
  stock_quantity: number | null;
  stock_status: StockStatus;
  last_confirmed_at: string | null;
  supplier_note: string | null;
}

export interface Product {
  id: number;
  supplier_id: number;
  category_id: number;
  name_mm: string;
  name_en: string | null;
  slug: string;
  sku: string | null;
  brand: string | null;
  model: string | null;
  description: string | null;
  specification: string | null;
  size: string | null;
  color: string | null;
  unit: string;
  package_size: string | null;
  photo: string | null;
  photo_url: string | null;
  status: ProductStatus;
  category?: { id: number; name_mm: string; name_en: string } | null;
  supplier?: { id: number; shop_name: string } | null;
  price?: ProductPrice | null;
  stock?: ProductStock | null;
  created_by_admin_id: number;
  created_at: string;
  updated_at: string;
}

export interface ProductListParams {
  page?: number;
  per_page?: number;
  search?: string;
  status?: ProductStatus | '';
  category_id?: number | string;
  supplier_id?: number | string;
}

export interface ProductListResult {
  products: Product[];
  meta: PaginationMeta;
}

/** Form-shaped input; the module turns it into multipart form data. */
export interface ProductInput {
  supplier_id: string;
  category_id: string;
  name_mm: string;
  name_en: string;
  /** '' means "let the server derive/keep the slug". */
  slug: string;
  sku: string;
  brand: string;
  model: string;
  description: string;
  specification: string;
  size: string;
  color: string;
  unit: string;
  package_size: string;
  /** null means "keep the current photo". */
  photo: File | null;
  /** Accepted on create only (DRAFT/PUBLISHED); ignored on update. */
  status?: ProductStatus;
  retail_price: string;
  wholesale_price: string;
  discount_price: string;
  minimum_order_quantity: string;
  price_valid_until: string;
  stock_quantity: string;
  stock_status: '' | StockStatus;
  supplier_note: string;
}

/** Field keys the create/update endpoints can report 422 errors for. */
export const PRODUCT_FIELDS = [
  'supplier_id',
  'category_id',
  'name_mm',
  'name_en',
  'slug',
  'sku',
  'brand',
  'model',
  'description',
  'specification',
  'size',
  'color',
  'unit',
  'package_size',
  'photo',
  'status',
  'retail_price',
  'wholesale_price',
  'discount_price',
  'minimum_order_quantity',
  'price_valid_until',
  'stock_quantity',
  'stock_status',
  'supplier_note',
] as const;

/**
 * Build the multipart payload for create/update.
 *
 * - Empty `slug` is omitted (derived from `name_en` on create, kept on update).
 * - Optional price fields keep empty strings so they can be cleared.
 * - `minimum_order_quantity`, `price_valid_until`, and the stock fields are
 *   omitted when blank (their update rules are not all nullable, and an
 *   untouched stock row should not be rewritten).
 * - `status` is only appended when `includeStatus` is set (create).
 */
export function buildProductFormData(
  input: ProductInput,
  opts: { includeStatus?: boolean } = {},
): FormData {
  const slug = input.slug.trim();
  const priceValidUntil = input.price_valid_until.trim();
  const stockQuantity = input.stock_quantity.trim();
  const supplierNote = input.supplier_note.trim();

  return buildFormData({
    supplier_id: input.supplier_id.trim(),
    category_id: input.category_id.trim(),
    name_mm: input.name_mm.trim(),
    name_en: input.name_en.trim(),
    slug: slug || null,
    sku: input.sku.trim(),
    brand: input.brand.trim(),
    model: input.model.trim(),
    description: input.description.trim(),
    specification: input.specification.trim(),
    size: input.size.trim(),
    color: input.color.trim(),
    unit: input.unit.trim(),
    package_size: input.package_size.trim(),
    photo: input.photo,
    ...(opts.includeStatus && input.status ? { status: input.status } : {}),
    retail_price: input.retail_price.trim(),
    wholesale_price: input.wholesale_price.trim(),
    discount_price: input.discount_price.trim(),
    minimum_order_quantity: input.minimum_order_quantity.trim() || null,
    price_valid_until: priceValidUntil || null,
    stock_quantity: stockQuantity || null,
    stock_status: input.stock_status || null,
    supplier_note: supplierNote || null,
  });
}

/**
 * GET /admin/products
 *
 * Paginated list ordered newest first, each item embedding its category,
 * supplier, price, and stock rows.
 */
export async function listProducts(
  params: ProductListParams = {},
): Promise<ApiResponse<ProductListResult>> {
  const query = toQueryString({
    page: params.page,
    per_page: params.per_page,
    search: params.search,
    status: params.status,
    category_id: params.category_id,
    supplier_id: params.supplier_id,
  });

  return apiRequest<ProductListResult>(`/admin/products${query}`);
}

/** GET /admin/products/{id} */
export async function getProduct(id: number): Promise<ApiResponse<{ product: Product }>> {
  return apiRequest<{ product: Product }>(`/admin/products/${id}`);
}

/** POST /admin/products (multipart) */
export async function createProduct(
  formData: FormData,
): Promise<ApiResponse<{ product: Product }>> {
  return apiRequest<{ product: Product }>('/admin/products', {
    method: 'POST',
    body: formData,
  });
}

/**
 * PATCH /admin/products/{id} as multipart.
 *
 * Sent as POST with `_method=PUT` so PHP parses an attached replacement photo.
 */
export async function updateProduct(
  id: number,
  formData: FormData,
): Promise<ApiResponse<{ product: Product }>> {
  // Copy so adding the method override never mutates the caller's FormData.
  const body = new FormData();
  formData.forEach((value, key) => {
    body.append(key, value);
  });
  body.append('_method', 'PUT');

  return apiRequest<{ product: Product }>(`/admin/products/${id}`, {
    method: 'POST',
    body,
  });
}

/**
 * PATCH /admin/products/{id}/status
 *
 * Publishing violations return 422 keyed by `supplier_id`, `category_id`,
 * `photo`, and/or `retail_price`.
 */
export async function updateProductStatus(
  id: number,
  status: ProductStatus,
): Promise<ApiResponse<{ product: Product }>> {
  return apiRequest<{ product: Product }>(`/admin/products/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

/** DELETE /admin/products/{id} (409 when referenced by quotations/orders). */
export async function deleteProduct(id: number): Promise<ApiResponse<null>> {
  return apiRequest<null>(`/admin/products/${id}`, { method: 'DELETE' });
}
