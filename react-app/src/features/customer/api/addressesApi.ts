/**
 * Customer address book API (Task 06).
 *
 * Wraps the `/customer/addresses` endpoints from the agreed API contract:
 *
 *   GET    /customer/addresses?page&per_page
 *   POST   /customer/addresses
 *   PUT    /customer/addresses/{id}
 *   DELETE /customer/addresses/{id}
 *
 * The address book feeds the delivery-address picker on the quotation request
 * form. A saved address always carries a composed `full_address` string the
 * form sends verbatim as the request `delivery_address`; the picker never
 * edits a saved address in place (that is a later task's concern).
 */
import { apiRequest, type ApiResponse } from '../../../api/client';
import { toQueryString, type PaginationMeta } from '../../../api/query';

export type { PaginationMeta };

export interface CustomerAddress {
  id: number;
  contact_name: string;
  phone: string;
  city: string;
  township: string | null;
  ward: string | null;
  street: string | null;
  building_no: string | null;
  landmark: string | null;
  full_address: string;
  is_default: boolean;
}

export interface CustomerAddressInput {
  contact_name: string;
  phone: string;
  city: string;
  township: string;
  ward?: string;
  street?: string;
  building_no?: string;
  landmark?: string;
  full_address: string;
  is_default?: boolean;
}

export interface CustomerAddressListParams {
  page?: number;
  per_page?: number;
}

export interface CustomerAddressListResult {
  addresses: CustomerAddress[];
  meta: PaginationMeta;
}

/** GET /customer/addresses — the authenticated customer's own address book. */
export async function listCustomerAddresses(
  params: CustomerAddressListParams = {},
): Promise<ApiResponse<CustomerAddressListResult>> {
  const query = toQueryString({
    page: params.page,
    per_page: params.per_page,
  });

  return apiRequest<CustomerAddressListResult>(`/customer/addresses${query}`);
}

/** POST /customer/addresses — saves a new address; 422 keys mirror the form. */
export async function createCustomerAddress(
  input: CustomerAddressInput,
): Promise<ApiResponse<{ address: CustomerAddress }>> {
  return apiRequest<{ address: CustomerAddress }>('/customer/addresses', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** PUT /customer/addresses/{id} */
export async function updateCustomerAddress(
  id: number,
  input: CustomerAddressInput,
): Promise<ApiResponse<{ address: CustomerAddress }>> {
  return apiRequest<{ address: CustomerAddress }>(`/customer/addresses/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

/** DELETE /customer/addresses/{id} */
export async function deleteCustomerAddress(
  id: number,
): Promise<ApiResponse<unknown>> {
  return apiRequest<unknown>(`/customer/addresses/${id}`, {
    method: 'DELETE',
  });
}
