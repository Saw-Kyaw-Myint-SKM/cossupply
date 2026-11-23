/**
 * Admin account management API (super admin only).
 *
 *   GET    /admin/admin-users
 *   POST   /admin/admin-users
 *   GET    /admin/admin-users/{id}
 *   PATCH  /admin/admin-users/{id}
 *   PATCH  /admin/admin-users/{id}/password
 *   DELETE /admin/admin-users/{id}
 *
 * Passwords are write-only: they are sent on create and on the dedicated
 * reset endpoint, and are never returned by the backend resource. A regular
 * admin receives 403 on every route.
 */
import { apiRequest, type ApiResponse } from '../../../api/client';
import { toQueryString, type PaginationMeta } from '../../../api/query';

export type AdminUserRole = 'admin' | 'super_admin';

export type AdminUserStatus = 'active' | 'inactive';

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: AdminUserRole;
  status: AdminUserStatus;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminUserListParams {
  page?: number;
  per_page?: number;
  search?: string;
  role?: AdminUserRole | '';
  status?: AdminUserStatus | '';
  sort_by?: 'created_at';
  sort_direction?: 'asc' | 'desc';
}

export interface AdminUserListResult {
  admin_users: AdminUser[];
  meta: PaginationMeta;
}

/** Create payload; every field except `phone` is required by the API. */
export interface AdminUserInput {
  name: string;
  email: string;
  /** '' means "no phone number". */
  phone: string;
  role: AdminUserRole;
  status: AdminUserStatus;
  /** Required on create, never sent by `updateAdminUser`. */
  password: string;
}

/** Field keys the create/update/reset endpoints can report 422 errors for. */
export const ADMIN_USER_FIELDS = ['name', 'email', 'phone', 'role', 'status', 'password'] as const;

/**
 * GET /admin/admin-users
 *
 * Ordered by name by default; pass `sort_by: 'created_at'` with
 * `sort_direction` for newest/oldest first.
 */
export async function listAdminUsers(
  params: AdminUserListParams = {},
): Promise<ApiResponse<AdminUserListResult>> {
  const query = toQueryString({
    page: params.page,
    per_page: params.per_page,
    search: params.search,
    role: params.role,
    status: params.status,
    sort_by: params.sort_by,
    sort_direction: params.sort_direction,
  });

  return apiRequest<AdminUserListResult>(`/admin/admin-users${query}`);
}

/** GET /admin/admin-users/{id} */
export async function getAdminUser(id: number): Promise<ApiResponse<{ admin_user: AdminUser }>> {
  return apiRequest<{ admin_user: AdminUser }>(`/admin/admin-users/${id}`);
}

/** POST /admin/admin-users */
export async function createAdminUser(
  input: AdminUserInput,
): Promise<ApiResponse<{ admin_user: AdminUser }>> {
  return apiRequest<{ admin_user: AdminUser }>('/admin/admin-users', {
    method: 'POST',
    body: JSON.stringify(buildPayload(input)),
  });
}

/**
 * PATCH /admin/admin-users/{id}
 *
 * The password is deliberately stripped here as well as in the type: it is
 * only ever changed through `resetAdminUserPassword`.
 */
export async function updateAdminUser(
  id: number,
  input: Partial<AdminUserInput>,
): Promise<ApiResponse<{ admin_user: AdminUser }>> {
  const { password: _password, ...editable } = input;

  return apiRequest<{ admin_user: AdminUser }>(`/admin/admin-users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(buildPayload(editable)),
  });
}

/** PATCH /admin/admin-users/{id}/password */
export async function resetAdminUserPassword(
  id: number,
  password: string,
): Promise<ApiResponse<{ admin_user: AdminUser }>> {
  return apiRequest<{ admin_user: AdminUser }>(`/admin/admin-users/${id}/password`, {
    method: 'PATCH',
    body: JSON.stringify({ password }),
  });
}

/** DELETE /admin/admin-users/{id} (409 when the account is still referenced). */
export async function deleteAdminUser(id: number): Promise<ApiResponse<null>> {
  return apiRequest<null>(`/admin/admin-users/${id}`, { method: 'DELETE' });
}

/** Trim strings and drop empty optional values before sending. */
function buildPayload(input: Partial<AdminUserInput>): Record<string, string> {
  const payload: Record<string, string> = {};

  if (input.name !== undefined) payload.name = input.name.trim();
  if (input.email !== undefined) payload.email = input.email.trim();
  if (input.phone !== undefined) payload.phone = input.phone.trim();
  if (input.role !== undefined) payload.role = input.role;
  if (input.status !== undefined) payload.status = input.status;
  if (input.password !== undefined) payload.password = input.password;

  return payload;
}
