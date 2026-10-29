/**
 * Admin audit trail API (Task 12).
 *
 *   GET /admin/audit-logs?action&entity_type&admin_id&search&from&to&page&per_page
 *
 * Rows are append-only; this module only reads them. The old/new snapshots
 * are opaque JSON written by the backend services.
 */
import { apiRequest, type ApiResponse } from '../../../api/client';
import { toQueryString, type PaginationMeta } from '../../../api/query';

export interface AuditLogAdmin {
  id: number;
  name: string;
  email: string;
}

export interface AuditLogEntry {
  id: number;
  action: string;
  entity_type: string;
  entity_id: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
  admin: AuditLogAdmin | null;
}

export interface AuditLogListResult {
  audit_logs: AuditLogEntry[];
  meta: PaginationMeta;
  actions: string[];
  entity_types: string[];
  admins: AuditLogAdmin[];
}

export interface AuditLogListParams {
  page?: number;
  per_page?: number;
  action?: string;
  entity_type?: string;
  admin_id?: number | '';
  search?: string;
  from?: string;
  to?: string;
}

export async function listAuditLogs(
  params: AuditLogListParams = {},
): Promise<ApiResponse<AuditLogListResult>> {
  const query = toQueryString({
    page: params.page,
    per_page: params.per_page,
    action: params.action,
    entity_type: params.entity_type,
    admin_id: params.admin_id,
    search: params.search,
    from: params.from,
    to: params.to,
  });

  return apiRequest<AuditLogListResult>(`/admin/audit-logs${query}`);
}

/** Keys whose value changed between the old and new snapshot. */
export function changedFields(entry: AuditLogEntry): string[] {
  const oldData = entry.old_data ?? {};
  const newData = entry.new_data ?? {};

  return Array.from(new Set([...Object.keys(oldData), ...Object.keys(newData)])).filter(
    (key) => JSON.stringify(oldData[key]) !== JSON.stringify(newData[key]),
  );
}
