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
  created_at: string;
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
