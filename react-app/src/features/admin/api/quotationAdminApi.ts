/**
 * Admin quotation workflow API (Task 07).
 *
 * Wraps the `/admin/quotation-requests/*` and `/admin/quotations/*`
 * endpoints documented in `laravel-api/api_doc.md`. Money values are always
 * integer MMK and every total is calculated by the server; the UI only shows
 * a local preview before saving.
 */
import { apiRequest, type ApiResponse } from '../../../api/client';
import { downloadAuthorizedFile, type DownloadedFile } from '../../../api/download';
import { toQueryString, type PaginationMeta } from '../../../api/query';

export type QuotationRequestStatus =
  | 'NEW'
  | 'CONTACTING_SUPPLIER'
  | 'SUPPLIER_RESPONSE_PENDING'
  | 'PREPARING_QUOTATION'
  | 'QUOTATION_SENT'
  | 'CUSTOMER_REVIEWING'
  | 'CHANGE_REQUESTED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'CANCELLED';

export const QUOTATION_REQUEST_STATUSES: QuotationRequestStatus[] = [
  'NEW',
  'CONTACTING_SUPPLIER',
  'SUPPLIER_RESPONSE_PENDING',
  'PREPARING_QUOTATION',
  'QUOTATION_SENT',
  'CUSTOMER_REVIEWING',
  'CHANGE_REQUESTED',
  'ACCEPTED',
  'REJECTED',
  'EXPIRED',
  'CANCELLED',
];

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

export type SupplierContactMethod = 'VIBER' | 'PHONE' | 'EMAIL' | 'TELEGRAM' | 'OTHER';

export interface AdminOption {
  id: number;
  name: string;
  email: string;
  role: string;
}

export interface AdminSupplierSummary {
  id: number;
  shop_name: string | null;
  contact_person?: string | null;
  phone?: string | null;
  viber_phone?: string | null;
  email?: string | null;
  delivery_time?: string | null;
  warranty_policy?: string | null;
}

export interface AdminQuotationItem {
  product_id: number;
  supplier_id: number;
  product_name_snapshot: string;
  specification_snapshot: string | null;
  quantity: number;
  display_price: number | null;
  stock_status: string | null;
  sku?: string | null;
  supplier?: AdminSupplierSummary | null;
}

export interface SupplierCommunication {
  id: number;
  supplier_id: number;
  contact_method: SupplierContactMethod;
  message_text: string | null;
  supplier_response: string | null;
  attachment_path: string | null;
  attachment_url: string | null;
  contacted_at: string | null;
  responded_at: string | null;
  created_at: string | null;
  admin?: { id: number; name: string } | null;
}

export interface SupplierGroup {
  supplier: AdminSupplierSummary;
  items: AdminQuotationItem[];
  communications: SupplierCommunication[];
}

export interface AdminQuotationRequestSummary {
  id: number;
  quotation_number: string;
  customer_id: number;
  customer_name: string;
  company_name: string | null;
  phone: string;
  email: string | null;
  city: string;
  township: string | null;
  status: QuotationRequestStatus;
  item_count?: number;
  assigned_admin: { id: number; name: string } | null;
  required_delivery_date: string | null;
  created_at: string;
}

export interface AdminQuotationRequest extends AdminQuotationRequestSummary {
  delivery_address: string;
  landmark: string | null;
  customer_note: string | null;
  updated_at: string;
  items: AdminQuotationItem[];
  suppliers: SupplierGroup[];
  communications: SupplierCommunication[];
  quotations: QuotationVersion[];
  current_quotation: QuotationVersion | null;
}

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
  supplier?: { id: number; shop_name: string } | null;
}

export interface QuotationPdf {
  id: number;
  file_name: string;
  generated_at: string;
  download_url: string;
  generated_by_admin?: { id: number; name: string } | null;
}

export interface EmailLog {
  id: number;
  recipient_email: string;
  email_type: string;
  subject: string;
  status: 'SENT' | 'FAILED';
  sent_at: string | null;
  error_message: string | null;
  created_at: string;
}

export interface QuotationVersion {
  id: number;
  quotation_request_id: number;
  quotation_number: string;
  version: number;
  status: QuotationVersionStatus;
  is_current: boolean;
  subtotal: number;
  discount: number;
  delivery_fee: number;
  service_fee_percentage: number;
  service_fee: number;
  total_amount: number;
  payment_method: string;
  payment_terms: string;
  valid_until: string;
  admin_note: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  accepted_at: string | null;
  rejected_at: string | null;
  created_at: string;
  created_by_admin?: { id: number; name: string } | null;
  items: QuotationVersionItem[];
  pdfs: QuotationPdf[];
  email_logs: EmailLog[];
}

export interface QuotationRequestListParams {
  page?: number;
  per_page?: number;
  status?: QuotationRequestStatus | '';
  assigned_admin_id?: number | '';
  unassigned?: boolean;
  search?: string;
}

export interface QuotationRequestListResult {
  quotation_requests: AdminQuotationRequestSummary[];
  meta: PaginationMeta;
  statuses: QuotationRequestStatus[];
  service_fee_default_percentage: number;
}

export interface QuotationRequestDetailResult {
  quotation_request: AdminQuotationRequest;
  service_fee_default_percentage: number;
  quotation_validity_days: number;
  default_delivery_fee: number;
  admins: AdminOption[];
}

export async function listAdminQuotationRequests(
  params: QuotationRequestListParams = {},
): Promise<ApiResponse<QuotationRequestListResult>> {
  const query = toQueryString({
    page: params.page,
    per_page: params.per_page,
    status: params.status,
    assigned_admin_id: params.assigned_admin_id,
    unassigned: params.unassigned ? 1 : undefined,
    search: params.search,
  });

  return apiRequest<QuotationRequestListResult>(`/admin/quotation-requests${query}`);
}

export async function getAdminQuotationRequest(
  id: number,
): Promise<ApiResponse<QuotationRequestDetailResult>> {
  return apiRequest<QuotationRequestDetailResult>(`/admin/quotation-requests/${id}`);
}

export async function assignQuotationRequest(
  id: number,
  assignedAdminId: number | null,
): Promise<ApiResponse<{ quotation_request: AdminQuotationRequestSummary }>> {
  return apiRequest(`/admin/quotation-requests/${id}/assignment`, {
    method: 'PATCH',
    body: JSON.stringify({ assigned_admin_id: assignedAdminId }),
  });
}

export async function updateQuotationRequestStatus(
  id: number,
  status: QuotationRequestStatus,
): Promise<ApiResponse<{ quotation_request: AdminQuotationRequestSummary }>> {
  return apiRequest(`/admin/quotation-requests/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export interface SupplierCommunicationInput {
  supplier_id: number;
  contact_method: SupplierContactMethod;
  message_text: string;
  supplier_response: string;
  responded_at?: string;
  attachment: File | null;
}

export async function createSupplierCommunication(
  requestId: number,
  input: SupplierCommunicationInput,
): Promise<
  ApiResponse<{
    communication: SupplierCommunication;
    request_status: QuotationRequestStatus;
  }>
> {
  const form = new FormData();
  form.append('supplier_id', String(input.supplier_id));
  form.append('contact_method', input.contact_method);
  form.append('message_text', input.message_text.trim());
  form.append('supplier_response', input.supplier_response.trim());

  if (input.responded_at) form.append('responded_at', input.responded_at);
  if (input.attachment) form.append('attachment', input.attachment);

  return apiRequest(`/admin/quotation-requests/${requestId}/communications`, {
    method: 'POST',
    body: form,
  });
}

export interface QuotationVersionItemInput {
  product_id: number;
  quantity: number;
  unit_price: number;
  discount: number;
  delivery_date?: string | null;
  warranty_note?: string | null;
  supplier_note?: string | null;
}

export interface QuotationVersionInput {
  items: QuotationVersionItemInput[];
  discount: number;
  delivery_fee: number;
  service_fee_percentage: number;
  payment_terms: string;
  valid_until: string;
  admin_note?: string | null;
}

export async function createQuotationVersion(
  requestId: number,
  input: QuotationVersionInput,
): Promise<ApiResponse<{ quotation: QuotationVersion }>> {
  return apiRequest(`/admin/quotation-requests/${requestId}/quotations`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getQuotationVersion(
  id: number,
): Promise<ApiResponse<{ quotation: QuotationVersion }>> {
  return apiRequest(`/admin/quotations/${id}`);
}

export async function updateQuotationVersion(
  id: number,
  input: QuotationVersionInput,
): Promise<ApiResponse<{ quotation: QuotationVersion }>> {
  return apiRequest(`/admin/quotations/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function sendQuotation(
  id: number,
): Promise<ApiResponse<{ quotation: QuotationVersion; email: EmailLog }>> {
  return apiRequest(`/admin/quotations/${id}/send`, { method: 'POST' });
}

export async function resendQuotationEmail(
  id: number,
): Promise<ApiResponse<{ email: EmailLog }>> {
  return apiRequest(`/admin/quotations/${id}/resend`, { method: 'POST' });
}

export async function generateQuotationPdf(
  id: number,
): Promise<ApiResponse<{ pdf: QuotationPdf }>> {
  return apiRequest(`/admin/quotations/${id}/pdf`, { method: 'POST' });
}

export type { DownloadedFile };

export async function downloadQuotationPdf(id: number): Promise<ApiResponse<DownloadedFile>> {
  return downloadAuthorizedFile(`/admin/quotations/${id}/pdf/download`, `quotation-${id}.pdf`);
}

export async function downloadAdminPrivateFile(
  path: string,
  fallbackName: string,
): Promise<ApiResponse<DownloadedFile>> {
  return downloadAuthorizedFile(`/admin/files/${path}`, fallbackName);
}
