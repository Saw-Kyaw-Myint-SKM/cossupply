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
 *   POST /admin/orders/{id}/delivery-status
 *   POST /admin/orders/{id}/cash-collection
 *   POST /admin/orders/{id}/payment-confirmation
 *   POST /admin/orders/{id}/customer-refused-payment
 *   GET  /admin/orders/{id}/receipt/download
 *
 * Money and status values are server-owned; this module only transports
 * them. Order types are shared with the customer order API so both sides
 * render the same frozen snapshots.
 */
import { apiRequest, type ApiResponse } from '../../../api/client';
import { downloadAuthorizedFile, type DownloadedFile } from '../../../api/download';
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

/**
 * Order-level delivery steps accepted by the server. `READY_TO_SHIP` and
 * `PREPARING` both keep the delivery record at PREPARING; the remaining
 * steps mirror onto the delivery record.
 */
export type DeliveryWorkflowStatus =
  | 'PREPARING'
  | 'READY_TO_SHIP'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'DELIVERY_FAILED'
  | 'RETURNED';

export interface DeliveryStatusPayload {
  status: DeliveryWorkflowStatus;
  note?: string;
  delivery_partner?: string;
  tracking_number?: string;
  estimated_delivery_date?: string;
  received_by?: string;
}

/** Advance the full delivery workflow or record a failure/return. */
export async function updateDeliveryStatus(
  orderId: number,
  payload: DeliveryStatusPayload,
): Promise<ApiResponse<{ order: OrderDetail }>> {
  return apiRequest<{ order: OrderDetail }>(`/admin/orders/${orderId}/delivery-status`, {
    method: 'POST',
    body: JSON.stringify({
      status: payload.status,
      note: payload.note?.trim() || undefined,
      delivery_partner: payload.delivery_partner?.trim() || undefined,
      tracking_number: payload.tracking_number?.trim() || undefined,
      estimated_delivery_date: payload.estimated_delivery_date || undefined,
      received_by: payload.received_by?.trim() || undefined,
    }),
  });
}

export interface CashCollectionPayload {
  amount_collected: number;
  received_by: string;
  receipt_number?: string;
  collected_at?: string;
  note?: string;
}

/** Record the full COD amount; the server rejects partial payment. */
export async function collectCash(
  orderId: number,
  payload: CashCollectionPayload,
): Promise<ApiResponse<{ order: OrderDetail }>> {
  return apiRequest<{ order: OrderDetail }>(`/admin/orders/${orderId}/cash-collection`, {
    method: 'POST',
    body: JSON.stringify({
      amount_collected: payload.amount_collected,
      received_by: payload.received_by.trim(),
      receipt_number: payload.receipt_number?.trim() || undefined,
      collected_at: payload.collected_at || undefined,
      note: payload.note?.trim() || undefined,
    }),
  });
}

/** Verify collected cash and complete the delivered order. */
export async function confirmCashPayment(
  orderId: number,
  note?: string,
): Promise<ApiResponse<{ order: OrderDetail }>> {
  return apiRequest<{ order: OrderDetail }>(`/admin/orders/${orderId}/payment-confirmation`, {
    method: 'POST',
    body: JSON.stringify({ note: note?.trim() || undefined }),
  });
}

export type RefusalDeliveryOutcome = 'DELIVERY_FAILED' | 'RETURNED';

export interface CustomerRefusalPayload {
  delivery_outcome: RefusalDeliveryOutcome;
  responsible_person: string;
  note: string;
}

/** Record a customer refusing to pay and the resulting delivery outcome. */
export async function recordCustomerRefusal(
  orderId: number,
  payload: CustomerRefusalPayload,
): Promise<ApiResponse<{ order: OrderDetail }>> {
  return apiRequest<{ order: OrderDetail }>(
    `/admin/orders/${orderId}/customer-refused-payment`,
    {
      method: 'POST',
      body: JSON.stringify({
        delivery_outcome: payload.delivery_outcome,
        responsible_person: payload.responsible_person.trim(),
        note: payload.note.trim(),
      }),
    },
  );
}

/** Download the private receipt once cash has been collected. */
export async function downloadOrderReceipt(
  orderId: number,
): Promise<ApiResponse<DownloadedFile>> {
  return downloadAuthorizedFile(
    `/admin/orders/${orderId}/receipt/download`,
    `receipt-${orderId}.pdf`,
  );
}
