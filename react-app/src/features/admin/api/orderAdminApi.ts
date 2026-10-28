/**
 * Admin order workflow API (Task 09).
 *
 * Wraps the `/admin/orders/*` endpoints documented in
 * `laravel-api/api_doc.md`:
 *
 *   GET  /admin/orders?page&per_page&status&payment_status&search
 *   GET  /admin/orders/{id}
 *   POST /admin/orders/{id}/supplier-confirmation
 *   POST /admin/orders/{id}/cancel
 *
 * Money and status values are server-owned; this module only transports
 * them. Order types are shared with the customer order API so both sides
 * render the same frozen snapshots.
 */
import { apiRequest, type ApiResponse } from '../../../api/client';
import { toQueryString, type PaginationMeta } from '../../../api/query';
import type {
  OrderDetail,
  OrderStatus,
  OrderSummary,
  PaymentStatus,
} from '../../orders/api/ordersApi';

export type { OrderDetail, OrderStatus, OrderSummary, PaymentStatus };

export interface AdminOrderListParams {
  page?: number;
  per_page?: number;
  status?: OrderStatus | '';
  payment_status?: PaymentStatus | '';
  search?: string;
}

export interface AdminOrderListResult {
  orders: OrderSummary[];
  meta: PaginationMeta;
  statuses: OrderStatus[];
  payment_statuses: PaymentStatus[];
}

export async function listAdminOrders(
  params: AdminOrderListParams = {},
): Promise<ApiResponse<AdminOrderListResult>> {
  const query = toQueryString({
    page: params.page,
    per_page: params.per_page,
    status: params.status,
    payment_status: params.payment_status,
    search: params.search,
  });

  return apiRequest<AdminOrderListResult>(`/admin/orders${query}`);
}

export async function getAdminOrder(
  id: number,
): Promise<ApiResponse<{ order: OrderDetail }>> {
  return apiRequest<{ order: OrderDetail }>(`/admin/orders/${id}`);
}

export type SupplierConfirmationResult = 'CONFIRMED' | 'UNAVAILABLE';

/**
 * Record the supplier's answer. Confirming walks the order through
 * ORDER_CONFIRMED to PREPARING in one server transaction.
 */
export async function confirmSupplier(
  orderId: number,
  result: SupplierConfirmationResult,
  note?: string,
): Promise<ApiResponse<{ order: OrderDetail }>> {
  return apiRequest<{ order: OrderDetail }>(
    `/admin/orders/${orderId}/supplier-confirmation`,
    {
      method: 'POST',
      body: JSON.stringify({ result, note: note?.trim() || undefined }),
    },
  );
}

export async function cancelOrder(
  orderId: number,
  note: string,
): Promise<ApiResponse<{ order: OrderDetail }>> {
  return apiRequest<{ order: OrderDetail }>(`/admin/orders/${orderId}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ note: note.trim() }),
  });
}
