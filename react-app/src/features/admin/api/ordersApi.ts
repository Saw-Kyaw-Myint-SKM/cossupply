/**
 * Admin order API (Task 09).
 *
 * Wraps the approved order endpoints:
 *
 *   GET   /admin/orders?order_status=&search=&page=&per_page=
 *   GET   /admin/orders/{id}
 *   PATCH /admin/orders/{id}/status
 *
 * The server owns order totals, lifecycle transitions, and `available_statuses`.
 * This module never derives a transition locally: the detail page turns the
 * server's list into buttons and refreshes the detail after every mutation.
 *
 * The PATCH response body is not part of the approved contract, so it is typed
 * as unknown; callers reload GET /admin/orders/{id} for canonical state.
 */
import { apiRequest, type ApiResponse } from '../../../api/client';
import { toQueryString, type PaginationMeta } from '../../../api/query';

export type { PaginationMeta };

export type OrderStatus =
  | 'SUPPLIER_CONFIRMATION_REQUIRED'
  | 'ORDER_CONFIRMED'
  | 'PREPARING'
  | 'READY_TO_SHIP'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'SUPPLIER_UNAVAILABLE'
  | 'DELIVERY_FAILED'
  | 'RETURNED'
  | 'CANCELLED';

/** Targets the supplier-confirmation screen may offer (Task 09). */
export type OrderStatusActionTarget =
  | 'ORDER_CONFIRMED'
  | 'PREPARING'
  | 'SUPPLIER_UNAVAILABLE'
  | 'CANCELLED';

export type PaymentStatus =
  | 'NOT_PAID'
  | 'CASH_COLLECTION_PENDING'
  | 'CASH_COLLECTED'
  | 'PAYMENT_CONFIRMED'
  | 'PAYMENT_FAILED'
  | 'CUSTOMER_REFUSED_TO_PAY';

export type DeliveryStatus =
  | 'NOT_ASSIGNED'
  | 'PREPARING'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'DELIVERY_FAILED'
  | 'RETURNED';

/** One row of GET /admin/orders. */
export interface AdminOrderSummary {
  id: number;
  order_number: string;
  quotation_number: string;
  customer_name: string;
  phone: string;
  order_status: OrderStatus | string;
  payment_status: PaymentStatus | string;
  delivery_status: DeliveryStatus | string;
  total_amount: number;
  created_at: string;
}

export interface AdminOrderListParams {
  order_status?: string;
  search?: string;
  page?: number;
  per_page?: number;
}

export interface AdminOrderListResult {
  orders: AdminOrderSummary[];
  meta: PaginationMeta;
}

export interface AdminOrderItem {
  id: number;
  product_name_snapshot: string;
  sku_snapshot: string | null;
  specification_snapshot: string | null;
  quantity: number;
  unit_price: number;
  discount: number;
  line_total: number;
  supplier_id: number;
  supplier?: { id: number; shop_name: string } | null;
}

export interface AdminOrderCashPayment {
  id: number;
  receipt_number: string | null;
  amount_due: number;
  amount_collected: number;
  amount_remaining: number;
  status: PaymentStatus | string;
  collected_at: string | null;
}

export interface AdminOrderStatusHistory {
  old_status: string | null;
  new_status: string;
  changed_by_type: string | null;
  changed_by_id: number | null;
  note: string | null;
  created_at: string;
}

/**
 * The approved contract leaves the delivery object's fields open (`{...}`).
 * The detail page only reads `status` when present and otherwise relies on the
 * order-level address snapshot; Task 10 owns delivery screens and can tighten
 * this type when that contract lands.
 */
export interface AdminOrderDelivery {
  id?: number;
  status?: string;
  [key: string]: unknown;
}

export interface AdminOrderQuotationRequest {
  id: number;
  quotation_number: string;
  status: string;
}

export interface AdminOrderDetail {
  id: number;
  order_number: string;
  quotation_number: string;
  quotation_request_id: number;
  quotation_id: number;
  customer_name: string;
  company_name: string | null;
  phone: string;
  email: string | null;
  delivery_address: string;
  city: string;
  township: string | null;
  landmark: string | null;
  subtotal: number;
  discount: number;
  delivery_fee: number;
  service_fee_percentage: number;
  service_fee: number;
  total_amount: number;
  payment_method: string;
  payment_status: PaymentStatus | string;
  order_status: OrderStatus | string;
  delivery_status: DeliveryStatus | string;
  customer_note: string | null;
  created_at: string;
  items: AdminOrderItem[];
  delivery: AdminOrderDelivery | null;
  cash_payment: AdminOrderCashPayment | null;
  status_histories: AdminOrderStatusHistory[];
  quotation_request: AdminOrderQuotationRequest;
  available_statuses: string[];
}

export interface AdminOrderDetailResult {
  order: AdminOrderDetail;
}

export interface AdminOrderStatusInput {
  status: OrderStatusActionTarget | string;
  note?: string;
}

/** GET /admin/orders — server-side status/search filters, newest first. */
export async function listAdminOrders(
  params: AdminOrderListParams = {},
): Promise<ApiResponse<AdminOrderListResult>> {
  const query = toQueryString({
    order_status: params.order_status,
    search: params.search,
    page: params.page,
    per_page: params.per_page,
  });

  return apiRequest<AdminOrderListResult>(`/admin/orders${query}`);
}

/** GET /admin/orders/{id} — canonical order detail including available actions. */
export async function getAdminOrder(
  id: number,
): Promise<ApiResponse<AdminOrderDetailResult>> {
  return apiRequest<AdminOrderDetailResult>(`/admin/orders/${id}`);
}

/**
 * PATCH /admin/orders/{id}/status. The page validates the reason with
 * `buildOrderStatusPayload`; this wrapper trims again and omits a blank note so
 * an empty string is never sent.
 *
 * 409 means another admin or the customer moved the order first; 422 carries
 * Laravel field errors (usually `status` or `note`).
 */
export async function updateAdminOrderStatus(
  id: number,
  input: AdminOrderStatusInput,
): Promise<ApiResponse<unknown>> {
  const note = input.note?.trim() ?? '';

  return apiRequest<unknown>(`/admin/orders/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify(note !== '' ? { status: input.status, note } : { status: input.status }),
  });
}
