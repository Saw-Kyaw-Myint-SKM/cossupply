/**
 * Public catalog API (Task 05).
 *
 * Wraps the unauthenticated browse endpoints documented in
 * `laravel-api/api_doc.md`:
 *
 *   GET /products, GET /products/{id}, GET /categories, GET /suppliers
 *
 * The server only ever returns PUBLISHED products and ACTIVE categories and
 * suppliers, and it strips every internal field (wholesale price, supplier
 * note, supplier contact details, audit timestamps). The types here mirror
 * that public shape — never the admin shape.
 */
import { apiRequest, type ApiResponse } from './client';
import { toQueryString, type PaginationMeta } from './query';

export type { PaginationMeta };

export type StockStatus =
  | 'IN_STOCK'
  | 'LOW_STOCK'
  | 'OUT_OF_STOCK'
  | 'PRE_ORDER'
  | 'SUPPLIER_CONFIRMATION_REQUIRED';

/**
 * Product status as defined by StatusDefinitions §2. The endpoints only ever
 * serve `PUBLISHED`, but the field keeps the full vocabulary so the client-side
 * cart guard can be exercised against every value the server can produce.
 */
export type ProductStatus = 'DRAFT' | 'PUBLISHED' | 'HIDDEN' | 'OUT_OF_STOCK';

export interface PublicProductPrice {
  retail_price: number;
  discount_price: number | null;
  minimum_order_quantity: number;
  price_valid_until: string | null;
  last_updated_at: string | null;
}

export interface PublicProductStock {
  stock_quantity: number | null;
  stock_status: StockStatus;
  last_confirmed_at: string | null;
}

export interface PublicCategory {
  id: number;
  parent_id: number | null;
  name_mm: string;
  name_en: string;
  slug: string;
  description: string | null;
  image: string | null;
  image_url: string | null;
  sort_order: number;
}

export interface PublicSupplier {
  id: number;
  shop_name: string;
  company_name: string | null;
  logo: string | null;
  logo_url: string | null;
  business_description: string | null;
  delivery_area: string | null;
  delivery_time: string | null;
  verified: boolean;
}

export interface PublicProduct {
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
  category?: PublicCategory | null;
  supplier?: PublicSupplier | null;
  price?: PublicProductPrice | null;
  stock?: PublicProductStock | null;
}

export interface CatalogListParams {
  page?: number;
  per_page?: number;
  search?: string;
}

export interface ProductListParams extends CatalogListParams {
  category_id?: number | string;
  supplier_id?: number | string;
  stock_status?: StockStatus | '';
}

export interface CategoryListParams extends CatalogListParams {
  parent_id?: number | string;
}

export interface ProductListResult {
  products: PublicProduct[];
  meta: PaginationMeta;
}

export interface CategoryListResult {
  categories: PublicCategory[];
  meta: PaginationMeta;
}

export interface SupplierListResult {
  suppliers: PublicSupplier[];
  meta: PaginationMeta;
}

/** GET /products — published only, newest first. */
export async function listProducts(
  params: ProductListParams = {},
): Promise<ApiResponse<ProductListResult>> {
  const query = toQueryString({
    page: params.page,
    per_page: params.per_page,
    search: params.search,
    category_id: params.category_id,
    supplier_id: params.supplier_id,
    stock_status: params.stock_status,
  });

  return apiRequest<ProductListResult>(`/products${query}`);
}

/**
 * GET /products/{id} — 404 for anything that is not published, which the
 * caller should render as "product unavailable" rather than as a crash.
 */
export async function getProduct(
  id: number | string,
): Promise<ApiResponse<{ product: PublicProduct }>> {
  return apiRequest<{ product: PublicProduct }>(`/products/${id}`);
}

/** GET /categories — ACTIVE categories only. */
export async function listCategories(
  params: CategoryListParams = {},
): Promise<ApiResponse<CategoryListResult>> {
  const query = toQueryString({
    page: params.page,
    per_page: params.per_page,
    search: params.search,
    parent_id: params.parent_id,
  });

  return apiRequest<CategoryListResult>(`/categories${query}`);
}

/** GET /suppliers — ACTIVE suppliers only, no contact details. */
export async function listSuppliers(
  params: CatalogListParams = {},
): Promise<ApiResponse<SupplierListResult>> {
  const query = toQueryString({
    page: params.page,
    per_page: params.per_page,
    search: params.search,
  });

  return apiRequest<SupplierListResult>(`/suppliers${query}`);
}
