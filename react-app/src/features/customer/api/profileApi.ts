/**
 * Customer profile API (Task 06).
 *
 * Wraps the `/customer/profile` endpoints from the agreed API contract:
 *
 *   GET /customer/profile
 *   PUT /customer/profile
 *
 * `phone` is READ-ONLY (the server ignores it on update); any form that
 * touches the profile must show it as a disabled input with a hint. The
 * quotation request form only *prefills* contact fields from the profile —
 * the values are sent to quotation-requests as request-time snapshots
 * (LogicFlow §5), never through this module.
 */
import { apiRequest, type ApiResponse } from '../../../api/client';

export type CustomerType = 'individual' | 'business';
export type CustomerStatus = string;

export interface CustomerProfile {
  id: number;
  name: string;
  company_name: string | null;
  email: string | null;
  phone: string;
  customer_type: CustomerType;
  status: CustomerStatus;
  created_at: string;
}

export interface CustomerProfileInput {
  name: string;
  company_name: string | null;
  /** Email may be cleared by sending an empty string on some backends; the
   * contract accepts `email?: string`, so `null` is sent as `undefined`. */
  email: string | null;
}

/** GET /customer/profile — the authenticated customer's own profile. */
export async function getCustomerProfile(): Promise<
  ApiResponse<{ customer: CustomerProfile }>
> {
  return apiRequest<{ customer: CustomerProfile }>('/customer/profile');
}

/**
 * PUT /customer/profile — updates `name`, `company_name`, and `email` only.
 * A body-supplied `phone` is ignored by the server, so this module never
 * sends one.
 */
export async function updateCustomerProfile(
  input: CustomerProfileInput,
): Promise<ApiResponse<{ customer: CustomerProfile }>> {
  return apiRequest<{ customer: CustomerProfile }>('/customer/profile', {
    method: 'PUT',
    body: JSON.stringify({
      name: input.name,
      company_name: input.company_name ?? '',
      ...(input.email !== null ? { email: input.email } : {}),
    }),
  });
}
