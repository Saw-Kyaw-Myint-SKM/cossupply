/**
 * Customer quotation request API (Task 06).
 *
 * Wraps the `/customer/quotation-requests` endpoints documented in the
 * agreed API contract (backend `api_doc.md`, Task 06):
 *
 *   GET  /customer/quotation-requests?page&per_page
 *   POST /customer/quotation-requests
 *
 * The POST body carries only products already in the buyer's authenticated
 * cart (`product_id`, `quantity`) plus contact/delivery snapshot fields.
 * `customer_id` is resolved server-side from the bearer token — it is never a
 * body field (LogicFlow §5). Prices stay display prices; the server remains
 * the money source of truth (MoneyAndValidationRules §5).
 */
import { apiRequest, type ApiResponse } from '../../../api/client';
import { toQueryString, type PaginationMeta } from '../../../api/query';

export type { PaginationMeta };

/**
 * Quotation request lifecycle status. The contract only fixes `NEW` for
 * Task 06; later tasks extend the vocabulary, so the field stays a plain
 * string and the UI tolerates unknown values.
 */
export type QuotationRequestStatus = string;

export interface QuotationRequestItem {
  product_id: number;
  product_name_snapshot: string;
  specification_snapshot: string | null;
  quantity: number;
  display_price: number;
  stock_status: string | null;
}

export interface QuotationRequest {
  id: number;
  quotation_number: string;
  status: QuotationRequestStatus;
  customer_name: string;
  phone: string;
  city: string;
  township: string | null;
  delivery_address: string;
  items: QuotationRequestItem[];
}

export interface QuotationRequestInput {
  items: Array<{ product_id: number; quantity: number }>;
  name: string;
  phone: string;
  company_name?: string;
  email?: string;
  city: string;
  township?: string;
  delivery_address: string;
  landmark?: string;
  /** ISO date (YYYY-MM-DD); must not be before today. */
  required_delivery_date?: string;
  customer_note?: string;
}

/** One row of the "My quotations" list (Task 06 list foundation). */
export interface QuotationRequestSummary {
  id: number;
  quotation_number: string;
  status: QuotationRequestStatus;
  customer_name: string;
  phone: string;
  city: string;
  township: string | null;
  item_count: number;
  current_quotation: QuotationVersionSummary | null;
  created_at: string;
}

/**
 * The customer-facing Final Quotation version state. Task 08 fixes the
 * vocabulary; values remain plain strings so unknown future statuses render
 * instead of breaking the page.
 */
export type QuotationVersionStatus = string;

/** Compact version row used by the list and the detail history. */
export interface QuotationVersionSummary {
  id: number;
  version: number;
  status: QuotationVersionStatus;
  is_current: boolean;
  total_amount: number;
  valid_until: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  accepted_at: string | null;
  rejected_at: string | null;
  created_at: string | null;
}

/** One immutable item snapshot inside a Final Quotation version. */
export interface QuotationVersionItem {
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
  delivery_date: string | null;
  warranty_note: string | null;
  supplier_note: string | null;
  supplier: { id: number; shop_name: string } | null;
}

/** Full version payload returned on the detail view and after a decision. */
export interface QuotationVersion extends QuotationVersionSummary {
  quotation_request_id: number;
  quotation_number: string;
  subtotal: number;
  discount: number;
  delivery_fee: number;
  service_fee_percentage: number;
  service_fee: number;
  payment_method: string;
  payment_terms: string;
  admin_note: string | null;
  items: QuotationVersionItem[];
}

/** Customer action trail entry (VIEWED, ACCEPTED, REJECTED, REQUESTED_CHANGE). */
export interface QuotationActionEntry {
  id: number;
  action: string;
  customer_note: string | null;
  created_at: string | null;
}

/** Full response for `/customer/quotation-requests/{id}`. */
export interface CustomerQuotationDetail extends QuotationRequest {
  company_name: string | null;
  email: string | null;
  landmark: string | null;
  required_delivery_date: string | null;
  customer_note: string | null;
  created_at: string;
  current_quotation: QuotationVersion | null;
  quotation_history: QuotationVersionSummary[];
  actions: QuotationActionEntry[];
  can_accept: boolean;
  can_reject: boolean;
  can_request_change: boolean;
  is_expired: boolean;
}

/** Result envelope shared by accept, reject and request-change. */
export interface QuotationDecisionResult {
  quotation: QuotationVersion;
  quotation_request: { id: number; status: QuotationRequestStatus };
  /** Present only when an accept created the order (Task 09). */
  order?: {
    id: number;
    order_number: string;
    order_status: string;
  };
}


export interface QuotationRequestListParams {
  page?: number;
  per_page?: number;
}

export interface QuotationRequestListResult {
  quotation_requests: QuotationRequestSummary[];
  meta: PaginationMeta;
}

/**
 * GET /customer/quotation-requests — the buyer's own requests, newest first.
 * 401 (expired or admin token) surfaces `status` so the caller can send the
 * buyer back to `/login`.
 */
export async function listQuotationRequests(
  params: QuotationRequestListParams = {},
): Promise<ApiResponse<QuotationRequestListResult>> {
  const query = toQueryString({
    page: params.page,
    per_page: params.per_page,
  });

  return apiRequest<QuotationRequestListResult>(`/customer/quotation-requests${query}`);
}

/**
 * POST /customer/quotation-requests — creates the request with immutable
 * contact/delivery/item snapshots and returns the generated quotation number
 * (format `QT-YYYY-####`). A 422 keeps flagging nothing on the server: the
 * callers must keep the buyer's form intact when the response carries
 * `errors` (including per-item keys such as `items.0.quantity`).
 */
export async function createQuotationRequest(
  input: QuotationRequestInput,
): Promise<ApiResponse<{ quotation_request: QuotationRequest }>> {
  return apiRequest<{ quotation_request: QuotationRequest }>(
    '/customer/quotation-requests',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

/**
 * GET /customer/quotation-requests/{id} — the request with its current
 * quotation, history and decision flags.
 *
 * The first open of a sent quotation is also the customer's "viewed" action;
 * the server records it and returns the updated VIEWED status. A 404 covers
 * both an unknown request and another customer's request.
 */
export async function getQuotationRequest(
  id: number,
): Promise<ApiResponse<{ quotation_request: CustomerQuotationDetail }>> {
  return apiRequest<{ quotation_request: CustomerQuotationDetail }>(
    `/customer/quotation-requests/${id}`,
  );
}

/**
 * POST /customer/quotations/{id}/accept — accepts the current valid version.
 * Order creation (Task 09) starts from this decision.
 */
export async function acceptQuotation(
  id: number,
): Promise<ApiResponse<QuotationDecisionResult>> {
  return apiRequest<QuotationDecisionResult>(`/customer/quotations/${id}/accept`, {
    method: 'POST',
  });
}

/** POST /customer/quotations/{id}/reject — closes the quotation as rejected. */
export async function rejectQuotation(
  id: number,
  customerNote?: string,
): Promise<ApiResponse<QuotationDecisionResult>> {
  const note = customerNote?.trim();

  return apiRequest<QuotationDecisionResult>(`/customer/quotations/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify(note ? { customer_note: note } : {}),
  });
}

/**
 * POST /customer/quotations/{id}/request-change — sends a mandatory revision
 * note to Admin; the server rejects notes shorter than 5 characters.
 */
export async function requestQuotationChange(
  id: number,
  customerNote: string,
): Promise<ApiResponse<QuotationDecisionResult>> {
  return apiRequest<QuotationDecisionResult>(
    `/customer/quotations/${id}/request-change`,
    {
      method: 'POST',
      body: JSON.stringify({ customer_note: customerNote }),
    },
  );
}
