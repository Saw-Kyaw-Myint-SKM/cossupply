/**
 * Authenticated notification API (Task 11).
 *
 * Both Customers and Admins use the same `/notifications` endpoints; the
 * server resolves the recipient from the bearer token.
 *
 *   GET   /notifications?page&per_page&unread
 *   GET   /notifications/unread-count
 *   POST  /notifications/read-all
 *   PATCH /notifications/{id}/read
 */
import { apiRequest, type ApiResponse } from '../../../api/client';
import { toQueryString, type PaginationMeta } from '../../../api/query';

/** The documented 60-second polling cadence while the user is signed in. */
export const NOTIFICATION_POLL_MS = 60_000;

export interface AppNotification {
  id: number;
  type: string;
  title: string;
  message: string;
  data: Record<string, unknown> | null;
  quotation_id: number | null;
  order_id: number | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface NotificationListResult {
  notifications: AppNotification[];
  unread_count: number;
  meta: PaginationMeta;
}

export interface NotificationListParams {
  page?: number;
  per_page?: number;
  unread?: boolean;
}

export async function listNotifications(
  params: NotificationListParams = {},
): Promise<ApiResponse<NotificationListResult>> {
  const query = toQueryString({
    page: params.page,
    per_page: params.per_page,
    unread: params.unread ? 1 : undefined,
  });

  return apiRequest<NotificationListResult>(`/notifications${query}`);
}

export async function getNotificationUnreadCount(): Promise<ApiResponse<{ unread_count: number }>> {
  return apiRequest<{ unread_count: number }>('/notifications/unread-count');
}

export async function markNotificationRead(
  id: number,
): Promise<ApiResponse<{ notification: AppNotification; unread_count: number }>> {
  return apiRequest<{ notification: AppNotification; unread_count: number }>(
    `/notifications/${id}/read`,
    { method: 'PATCH' },
  );
}

export async function markAllNotificationsRead(): Promise<
  ApiResponse<{ marked: number; unread_count: number }>
> {
  return apiRequest<{ marked: number; unread_count: number }>('/notifications/read-all', {
    method: 'POST',
  });
}

/**
 * Where a notification points, using the current role's route namespace.
 */
export function notificationHref(
  notification: AppNotification,
  userType: 'customer' | 'admin' | null,
): string | null {
  const data = notification.data ?? {};
  const orderId = notification.order_id ?? (typeof data.order_id === 'number' ? data.order_id : null);
  const requestId =
    typeof data.quotation_request_id === 'number' ? data.quotation_request_id : null;

  if (userType === 'admin') {
    if (orderId !== null) return `/admin/orders/${orderId}`;
    if (requestId !== null) return `/admin/quotation-requests/${requestId}`;
    return null;
  }

  if (orderId !== null) return `/orders/${orderId}`;
  if (requestId !== null) return `/quotations/${requestId}`;

  return null;
}
