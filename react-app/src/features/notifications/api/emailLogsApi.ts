/**
 * Admin email delivery log and resend API (Task 11).
 *
 *   GET  /admin/email-logs?page&per_page&status&email_type&search
 *   POST /admin/email-logs/{id}/resend
 */
import { apiRequest, type ApiResponse } from '../../../api/client';
import { toQueryString, type PaginationMeta } from '../../../api/query';

export type EmailLogStatus = 'SENT' | 'FAILED';

export type EmailLogType =
  | 'QUOTATION_SENT'
  | 'ORDER_CONFIRMED'
  | 'ORDER_OUT_FOR_DELIVERY'
  | 'PAYMENT_CONFIRMED'
  | 'ORDER_CANCELLED';

export interface EmailLog {
  id: number;
  recipient_email: string;
  related_type: string;
  related_id: number;
  email_type: string;
  subject: string;
  status: EmailLogStatus;
  sent_at: string | null;
  error_message: string | null;
  resendable: boolean;
  created_at: string;
}

export interface EmailLogListResult {
  email_logs: EmailLog[];
  meta: PaginationMeta;
  statuses: EmailLogStatus[];
  email_types: EmailLogType[];
}

export interface EmailLogListParams {
  page?: number;
  per_page?: number;
  status?: EmailLogStatus | '';
  email_type?: EmailLogType | '';
  search?: string;
}

export async function listEmailLogs(
  params: EmailLogListParams = {},
): Promise<ApiResponse<EmailLogListResult>> {
  const query = toQueryString({
    page: params.page,
    per_page: params.per_page,
    status: params.status,
    email_type: params.email_type,
    search: params.search,
  });

  return apiRequest<EmailLogListResult>(`/admin/email-logs${query}`);
}

export async function resendEmailLog(
  id: number,
): Promise<ApiResponse<{ email: EmailLog }>> {
  return apiRequest<{ email: EmailLog }>(`/admin/email-logs/${id}/resend`, {
    method: 'POST',
  });
}
