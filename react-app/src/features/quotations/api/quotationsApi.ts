/**
 * Customer quotation request API (Tasks 06 and 08).
 *
 * Wraps the `/customer/quotation-requests` and `/customer/quotations`
 * endpoints documented in the agreed API contract:
 *
 *   GET  /customer/quotation-requests?page&per_page
 *   POST /customer/quotation-requests
 *   GET  /customer/quotation-requests/{id}
 *   POST /customer/quotation-requests/{id}/view
 *   POST /customer/quotations/{quotationId}/accept
 *   POST /customer/quotations/{quotationId}/reject
 *   POST /customer/quotations/{quotationId}/change-request
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
  created_at: string;
  current_quotation_id?: number | null;
  current_version?: number | null;
  current_status?: QuotationVersionStatus | null;
  valid_until?: string | null;
  is_expired?: boolean | null;
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
 * Additive list fields delivered by Task 08. They are optional so an older
 * backend response still renders (the UI simply omits the current-version
 * markers). `current_status` is the quotation version status.
 */
export interface QuotationRequestSummaryCurrent {
  current_quotation_id?: number | null;
  current_version?: number | null;
  current_status?: QuotationVersionStatus | null;
  valid_until?: string | null;
  is_expired?: boolean | null;
}

export type QuotationVersionStatus =
  | 'DRAFT'
  | 'SENT'
  | 'VIEWED'
  | 'CHANGE_REQUESTED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'SUPERSEDED'
  | 'CANCELLED';

/** One customer-visible action-history entry on a quotation version. */
export interface QuotationVersionAction {
  action: string;
  customer_note?: string | null;
  actor_type?: string | null;
  actor_id?: number | null;
  created_at: string;
}

/**
 * One line of a sent quotation version. The backend resource uses `discount`
 * for the line discount, while older/mock payloads may use `line_discount`;
 * both are accepted. Everything except the snapshot name/quantity/prices is
 * optional so the page renders defensively if a presentation field is omitted.
 */
export interface CustomerQuotationVersionItem {
  id?: number;
  product_id?: number | null;
  product_name_snapshot: string;
  specification_snapshot?: string | null;
  supplier_name_snapshot?: string | null;
  sku_snapshot?: string | null;
  quantity: number;
  unit_price: number;
  line_discount?: number | null;
  /** The backend version resource names this field `discount`. */
  discount?: number | null;
  line_total?: number | null;
  delivery_date?: string | null;
  warranty_note?: string | null;
  supplier_note?: string | null;
  supplier?: { id?: number; shop_name?: string | null } | null;
}

/** A quotation version as shown to the customer (Task 08 contract). */
export interface CustomerQuotationVersion {
  id: number;
  quotation_request_id?: number;
  quotation_number?: string;
  version: number;
  status: QuotationVersionStatus;
  is_current: boolean;
  is_expired?: boolean;
  valid_until: string | null;
  delivery_date: string | null;
  subtotal: number;
  discount_amount: number;
  delivery_fee: number;
  service_fee_percentage: number;
  service_fee: number;
  total_amount: number;
  cod_terms: string | null;
  admin_note: string | null;
  sent_at: string | null;
  items: CustomerQuotationVersionItem[];
  actions: QuotationVersionAction[];
}

/** Detail payload returned by both GET and POST /view. */
export interface QuotationRequestDetail extends QuotationRequestSummaryCurrent {
  id: number;
  quotation_number: string;
  status: QuotationRequestStatus;
  customer_name: string;
  company_name: string | null;
  phone: string;
  email: string | null;
  city: string;
  township: string | null;
  landmark: string | null;
  delivery_address: string;
  required_delivery_date: string | null;
  customer_note: string | null;
  created_at: string;
  items: QuotationRequestItem[];
  current_quotation_id: number | null;
  /**
   * The order created when the current quotation was accepted. Null until
   * acceptance; the detail page falls back to it so the order survives a
   * reload instead of existing only in the accept response.
   */
  order?: QuotationMutationOrder | null;
  is_expired: boolean;
  can_accept: boolean;
  can_reject: boolean;
  can_request_change: boolean;
  /** Newest first is not guaranteed by the API; the UI sorts defensively. */
  versions: CustomerQuotationVersion[];
}

export interface QuotationRequestDetailResult {
  quotation_request: QuotationRequestDetail;
}

/** 200 payload of the accept/reject/change-request mutations. */
export interface QuotationMutationQuotation {
  id: number;
  version: number;
  status: QuotationVersionStatus;
  total_amount: number;
  valid_until: string | null;
}

export interface QuotationMutationRequest {
  id: number;
  quotation_number: string;
  status: QuotationRequestStatus;
}

/**
 * The order created by the accept transaction (Task 09). The server owns the
 * number, lifecycle statuses, and total; the accept screen only presents it.
 * `order_status`/`payment_status`/`delivery_status` stay plain strings so a
 * later status vocabulary renders without a type change.
 */
export interface QuotationMutationOrder {
  id: number;
  order_number: string;
  order_status: string;
  payment_status: string;
  delivery_status: string;
  total_amount: number;
  created_at: string;
}

export interface QuotationMutationResult {
  quotation: QuotationMutationQuotation;
  request: QuotationMutationRequest;
  /**
   * Present on accept after Task 09; null for reject/change-request and for
   * an accept response from an older backend.
   */
  order?: QuotationMutationOrder | null;
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
 * GET /customer/quotation-requests/{id} — the owned request with every visible
 * version. Side-effect free, so it is used for retry and after an action.
 * Cross-customer access returns 404 (the server does not reveal existence).
 */
export async function getQuotationRequest(
  id: number,
): Promise<ApiResponse<QuotationRequestDetailResult>> {
  return apiRequest<QuotationRequestDetailResult>(`/customer/quotation-requests/${id}`);
}

/**
 * POST /customer/quotation-requests/{id}/view — idempotent first-view marker.
 * Returns the same payload as GET, which is why the detail page uses it as its
 * initial load call. Expiry is evaluated lazily by the server here.
 */
export async function markQuotationRequestViewed(
  id: number,
): Promise<ApiResponse<QuotationRequestDetailResult>> {
  return apiRequest<QuotationRequestDetailResult>(
    `/customer/quotation-requests/${id}/view`,
    { method: 'POST' },
  );
}

/**
 * POST /customer/quotations/{quotationId}/accept — the COD acknowledgement is
 * mandatory, and this wrapper always sends `true` so an unchecked checkbox can
 * never reach the server. 409 means the version is no longer current/valid.
 */
export async function acceptQuotation(
  quotationId: number,
): Promise<ApiResponse<QuotationMutationResult>> {
  return apiRequest<QuotationMutationResult>(
    `/customer/quotations/${quotationId}/accept`,
    {
      method: 'POST',
      body: JSON.stringify({ cod_terms_accepted: true }),
    },
  );
}

/**
 * POST /customer/quotations/{quotationId}/reject — the note is optional. An
 * empty/whitespace note is omitted instead of sending a meaningless empty
 * string; a non-empty note is trimmed.
 */
export async function rejectQuotation(
  quotationId: number,
  customerNote?: string,
): Promise<ApiResponse<QuotationMutationResult>> {
  const note = customerNote?.trim() ?? '';

  return apiRequest<QuotationMutationResult>(
    `/customer/quotations/${quotationId}/reject`,
    {
      method: 'POST',
      body: JSON.stringify(note !== '' ? { customer_note: note } : {}),
    },
  );
}

/**
 * POST /customer/quotations/{quotationId}/change-request — the note is
 * required. The UI validates before calling; the server returns 422 when it is
 * empty. The trimmed note is what the customer actually meant to send.
 */
export async function requestQuotationChange(
  quotationId: number,
  customerNote: string,
): Promise<ApiResponse<QuotationMutationResult>> {
  return apiRequest<QuotationMutationResult>(
    `/customer/quotations/${quotationId}/change-request`,
    {
      method: 'POST',
      body: JSON.stringify({ customer_note: customerNote.trim() }),
    },
  );
}
