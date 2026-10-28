/**
 * Customer order API (Task 09).
 *
 * Orders are created server-side by accepting a quotation; these endpoints
 * only read them:
 *
 *   GET /customer/orders?page&per_page&status
 *   GET /customer/orders/{id}
 *
 * Every read is scoped to the authenticated customer on the server. A
 * foreign order id answers 404.
 */
import { apiRequest, type ApiResponse } from '../../../api/client';
import { toQueryString, type PaginationMeta } from '../../../api/query';

export type { PaginationMeta };

export type OrderStatus = string;

export const ORDER_STATUSES: OrderStatus[] = [
  'SUPPLIER_CONFIRMATION_REQUIRED',
  'ORDER_CONFIRMED',
  'PREPARING',
  'READY_TO_SHIP',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'COMPLETED',
  'SUPPLIER_UNAVAILABLE',
  'DELIVERY_FAILED',
  'RETURNED',
  'CANCELLED',
];

export type PaymentStatus = string;

export const PAYMENT_STATUSES: PaymentStatus[] = [
  'NOT_PAID',
  'CASH_COLLECTION_PENDING',
  'CASH_COLLECTED',
  'PAYMENT_CONFIRMED',
  'CUSTOMER_REFUSED_TO_PAY',
  'PAYMENT_FAILED',
];

export type DeliveryStatus = string;

/** One immutable item snapshot copied from the accepted quotation version. */
export interface OrderItem {
  id: number;
  product_id: number | null;
  supplier_id: number | null;
  product_name_snapshot: string;
  sku_snapshot: string | null;
  specification_snapshot: string | null;
  quantity: number;
  unit_price: number;
  discount: number;
  line_total: number;
  supplier: { id: number; shop_name: string | null } | null;
}

/** The single full-delivery record created with the order (MVP). */
export interface OrderDelivery {
  id: number;
  supplier_id: number | null;
  delivery_contact_name: string;
  delivery_phone: string;
  delivery_address: string;
  city: string;
  township: string | null;
  landmark: string | null;
  delivery_fee: number;
  delivery_partner: string | null;
  tracking_number: string | null;
  estimated_delivery_date: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  received_by: string | null;
  customer_note: string | null;
  delivery_status: DeliveryStatus;
}

/** The full COD payment record. Amounts are integer MMK. */
export interface OrderCashPayment {
  id: number;
  delivery_id: number | null;
  receipt_number: string;
  amount_due: number;
  amount_collected: number;
  amount_remaining: number;
  received_by: string | null;
  collected_at: string | null;
  customer_name: string | null;
  note: string | null;
  status: PaymentStatus;
}

/** One append-only order status change. */
export interface OrderStatusHistory {
  id: number;
  old_status: string | null;
  new_status: string;
  changed_by_type: string;
  changed_by_id: number | null;
  note: string | null;
  created_at: string | null;
}

/** Supplier group returned to admins so they can confirm over Viber. */
export interface OrderSupplierGroup {
  supplier: {
    id: number;
    shop_name: string | null;
    contact_person: string | null;
    phone: string | null;
    viber_phone: string | null;
    email: string | null;
    delivery_time: string | null;
    warranty_policy: string | null;
  };
  items: OrderItem[];
}

export interface OrderSummary {
  id: number;
  order_number: string;
  quotation_id: number;
  quotation_request_id: number;
  customer_id: number;
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
  payment_status: PaymentStatus;
  order_status: OrderStatus;
  delivery_status: DeliveryStatus;
  customer_note: string | null;
  item_count?: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface OrderDetail extends OrderSummary {
  items: OrderItem[];
  delivery: OrderDelivery | null;
  cash_payment: OrderCashPayment | null;
  status_histories: OrderStatusHistory[];
  quotation: {
    id: number;
    quotation_number: string;
    version: number;
    status: string;
    accepted_at: string | null;
    valid_until: string | null;
  } | null;
  suppliers: OrderSupplierGroup[];
}

export interface OrderListParams {
  page?: number;
  per_page?: number;
  status?: OrderStatus | '';
}

export interface OrderListResult {
  orders: OrderSummary[];
  meta: PaginationMeta;
  statuses: OrderStatus[];
}

export async function listOrders(
  params: OrderListParams = {},
): Promise<ApiResponse<OrderListResult>> {
  const query = toQueryString({
    page: params.page,
    per_page: params.per_page,
    status: params.status,
  });

  return apiRequest<OrderListResult>(`/customer/orders${query}`);
}

export async function getOrder(id: number): Promise<ApiResponse<{ order: OrderDetail }>> {
  return apiRequest<{ order: OrderDetail }>(`/customer/orders/${id}`);
}
