/**
 * Admin suppliers API (Task 04).
 *
 * Wraps `/admin/suppliers` as documented in `laravel-api/api_doc.md`.
 * Create and update payloads are multipart so a logo can be attached; the
 * update sends `_method=PUT` so PHP parses the uploaded file.
 *
 * There is no delete endpoint: suppliers are never deleted, they are
 * deactivated by setting `status` to `INACTIVE` or `SUSPENDED`.
 */
import { apiRequest, type ApiResponse } from '../../../api/client';
import { buildFormData, toQueryString, type PaginationMeta } from './catalogApiUtils';

export type SupplierStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export interface Supplier {
  id: number;
  shop_name: string;
  company_name: string | null;
  contact_person: string;
  phone: string;
  viber_phone: string | null;
  email: string | null;
  logo: string | null;
  logo_url: string | null;
  address: string;
  city: string;
  township: string | null;
  business_description: string | null;
  delivery_area: string | null;
  delivery_time: string | null;
  warranty_policy: string | null;
  return_policy: string | null;
  status: SupplierStatus;
  verified: boolean;
  /** Included by the list endpoint only (`withCount('products')`). */
  products_count?: number;
  created_by_admin_id: number;
  created_at: string;
  updated_at: string;
}

export interface SupplierListParams {
  page?: number;
  per_page?: number;
  search?: string;
  status?: SupplierStatus | '';
}

export interface SupplierListResult {
  suppliers: Supplier[];
  meta: PaginationMeta;
}

/** Form-shaped input; the module turns it into multipart form data. */
export interface SupplierInput {
  shop_name: string;
  company_name: string;
  contact_person: string;
  phone: string;
  viber_phone: string;
  email: string;
  /** null means "keep the current logo". */
  logo: File | null;
  address: string;
  city: string;
  township: string;
  business_description: string;
  delivery_area: string;
  delivery_time: string;
  warranty_policy: string;
  return_policy: string;
  status: SupplierStatus;
  verified: boolean;
}

/** Field keys the create/update endpoints can report 422 errors for. */
export const SUPPLIER_FIELDS = [
  'shop_name',
  'company_name',
  'contact_person',
  'phone',
  'viber_phone',
  'email',
  'logo',
  'address',
  'city',
  'township',
  'business_description',
  'delivery_area',
  'delivery_time',
  'warranty_policy',
  'return_policy',
  'status',
  'verified',
] as const;

export function buildSupplierFormData(input: SupplierInput): FormData {
  return buildFormData({
    shop_name: input.shop_name.trim(),
    company_name: input.company_name.trim(),
    contact_person: input.contact_person.trim(),
    phone: input.phone.trim(),
    viber_phone: input.viber_phone.trim(),
    email: input.email.trim(),
    logo: input.logo,
    address: input.address.trim(),
    city: input.city.trim(),
    township: input.township.trim(),
    business_description: input.business_description.trim(),
    delivery_area: input.delivery_area.trim(),
    delivery_time: input.delivery_time.trim(),
    warranty_policy: input.warranty_policy.trim(),
    return_policy: input.return_policy.trim(),
    status: input.status,
    verified: input.verified,
  });
}

/**
 * GET /admin/suppliers
 *
 * Paginated list ordered by `shop_name`, then `id`.
 */
export async function listSuppliers(
  params: SupplierListParams = {},
): Promise<ApiResponse<SupplierListResult>> {
  const query = toQueryString({
    page: params.page,
    per_page: params.per_page,
    search: params.search,
    status: params.status,
  });

  return apiRequest<SupplierListResult>(`/admin/suppliers${query}`);
}

/** GET /admin/suppliers/{id} */
export async function getSupplier(id: number): Promise<ApiResponse<{ supplier: Supplier }>> {
  return apiRequest<{ supplier: Supplier }>(`/admin/suppliers/${id}`);
}

/** POST /admin/suppliers (multipart) */
export async function createSupplier(
  formData: FormData,
): Promise<ApiResponse<{ supplier: Supplier }>> {
  return apiRequest<{ supplier: Supplier }>('/admin/suppliers', {
    method: 'POST',
    body: formData,
  });
}

/**
 * PATCH /admin/suppliers/{id} as multipart.
 *
 * Sent as POST with `_method=PUT` so PHP parses an attached replacement logo.
 */
export async function updateSupplier(
  id: number,
  formData: FormData,
): Promise<ApiResponse<{ supplier: Supplier }>> {
  // Copy so adding the method override never mutates the caller's FormData.
  const body = new FormData();
  formData.forEach((value, key) => {
    body.append(key, value);
  });
  body.append('_method', 'PUT');

  return apiRequest<{ supplier: Supplier }>(`/admin/suppliers/${id}`, {
    method: 'POST',
    body,
  });
}

// Suppliers have no DELETE endpoint (api_doc.md, PATCH notes): deactivate by
// setting `status` to INACTIVE or SUSPENDED through `updateSupplier`.
