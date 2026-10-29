/**
 * Admin customer directory API (Task 12).
 *
 *   GET /admin/customers?status&customer_type&search&page&per_page
 *
 * Read-only: customer registration and profile edits stay customer-owned, so
 * this module deliberately exposes no write helper. Password hashes and
 * remember tokens are never returned by the backend resource.
 */
import { apiRequest, type ApiResponse } from '../../../api/client';
import { toQueryString, type PaginationMeta } from '../../../api/query';

export type CustomerStatus = 'active' | 'inactive' | 'suspended';

export type CustomerType = 'individual' | 'business';

export interface DirectoryCustomer {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  company_name: string | null;
  customer_type: CustomerType;
  status: CustomerStatus;
  quotation_requests_count: number;
  orders_count: number;
  created_at: string;
}

export interface CustomerListResult {
  customers: DirectoryCustomer[];
  meta: PaginationMeta;
  statuses: CustomerStatus[];
  customer_types: CustomerType[];
}

export interface CustomerListParams {
  page?: number;
  per_page?: number;
  status?: CustomerStatus | '';
  customer_type?: CustomerType | '';
  search?: string;
}

export async function listCustomers(
  params: CustomerListParams = {},
): Promise<ApiResponse<CustomerListResult>> {
  const query = toQueryString({
    page: params.page,
    per_page: params.per_page,
    status: params.status,
    customer_type: params.customer_type,
    search: params.search,
  });

  return apiRequest<CustomerListResult>(`/admin/customers${query}`);
}
