/**
 * Pure presentation/action helpers for the customer quotation review screen
 * (Task 08).
 *
 * The server owns every status transition, every total, and the
 * `can_accept` / `can_reject` / `can_request_change` flags. These helpers only
 * translate that response into stable labels, tones, formatted dates, and
 * validated request payloads so the detail page and the list/dashboard stay
 * consistent. Nothing here touches React or the network.
 */
import { formatMMK } from '../../../lib/money';
import type {
  CustomerQuotationVersion,
  CustomerQuotationVersionItem,
  QuotationRequestDetail,
  QuotationRequestSummary,
} from '../api/quotationsApi';

/** Contract limit from the accept/reject/change-request endpoints. */
export const CUSTOMER_NOTE_MAX_LENGTH = 2000;

export type QuotationStatusTone =
  | 'neutral'
  | 'info'
  | 'progress'
  | 'success'
  | 'warning'
  | 'danger';

const STATUS_LABELS: Record<string, string> = {
  // Quotation request statuses.
  NEW: 'New',
  CONTACTING_SUPPLIER: 'Contacting supplier',
  SUPPLIER_RESPONSE_PENDING: 'Awaiting supplier',
  PREPARING_QUOTATION: 'Preparing quotation',
  QUOTATION_SENT: 'Quotation sent',
  CUSTOMER_REVIEWING: 'Reviewing',
  CHANGE_REQUESTED: 'Change requested',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled',
  // Quotation version statuses.
  DRAFT: 'Draft',
  SENT: 'Sent',
  VIEWED: 'Viewed',
  SUPERSEDED: 'Superseded',
};

const STATUS_TONES: Record<string, QuotationStatusTone> = {
  NEW: 'neutral',
  CONTACTING_SUPPLIER: 'progress',
  SUPPLIER_RESPONSE_PENDING: 'progress',
  PREPARING_QUOTATION: 'progress',
  QUOTATION_SENT: 'info',
  CUSTOMER_REVIEWING: 'progress',
  CHANGE_REQUESTED: 'warning',
  ACCEPTED: 'success',
  REJECTED: 'danger',
  EXPIRED: 'danger',
  CANCELLED: 'danger',
  DRAFT: 'neutral',
  SENT: 'info',
  VIEWED: 'progress',
  SUPERSEDED: 'neutral',
};

/** Tailwind classes for each semantic tone, shared by every quotation badge. */
export const QUOTATION_STATUS_TONE_CLASSES: Record<QuotationStatusTone, string> = {
  neutral: 'bg-gray-100 text-gray-700 ring-gray-500/20',
  info: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  progress: 'bg-sky-50 text-sky-800 ring-sky-600/20',
  success: 'bg-green-50 text-green-700 ring-green-600/20',
  warning: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  danger: 'bg-red-50 text-red-700 ring-red-600/20',
};

function formatWords(value: string): string {
  const spaced = value.replace(/_/g, ' ').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function quotationStatusLabel(status: string | null | undefined): string {
  if (!status) return '—';
  return STATUS_LABELS[status] ?? formatWords(status);
}

export function quotationStatusTone(status: string | null | undefined): QuotationStatusTone {
  if (!status) return 'neutral';
  return STATUS_TONES[status] ?? 'neutral';
}

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseQuotationDate(value: string): Date | null {
  const dateOnly = DATE_ONLY_PATTERN.exec(value);
  if (dateOnly) {
    const date = new Date(
      Number(dateOnly[1]),
      Number(dateOnly[2]) - 1,
      Number(dateOnly[3]),
    );
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "Oct 31, 2026" for both date-only and ISO datetime values. */
export function formatQuotationDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = parseQuotationDate(value);
  if (!date) return '—';

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** "Oct 19, 2026, 2:45 PM" for audit stamps. */
export function formatQuotationDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = parseQuotationDate(value);
  if (!date) return '—';

  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Validity wording that makes an expired version unmistakable. */
export function formatValidity(
  validUntil: string | null | undefined,
  isExpired = false,
): string {
  if (!validUntil) return 'No validity date';
  return `${isExpired ? 'Expired' : 'Valid until'} ${formatQuotationDate(validUntil)}`;
}

/** Integer MMK formatting; malformed amounts render as an em dash, never NaN. */
export function formatQuotationAmount(amount: number | null | undefined): string {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return '—';
  return formatMMK(amount);
}

/** Newest version first, without mutating the response array. */
export function sortVersionsNewestFirst(
  versions: readonly CustomerQuotationVersion[],
): CustomerQuotationVersion[] {
  return [...versions].sort((left, right) => {
    if (right.version !== left.version) return right.version - left.version;
    return right.id - left.id;
  });
}

/**
 * Customer-visible versions. DRAFT versions are admin works-in-progress and
 * must not appear before they are sent (StatusDefinitions §5), so filter them
 * defensively even if a resource includes them.
 */
export function visibleQuotationVersions(
  versions: readonly CustomerQuotationVersion[],
): CustomerQuotationVersion[] {
  return sortVersionsNewestFirst(versions.filter((version) => version.status !== 'DRAFT'));
}

export function isCurrentVersion(
  version: CustomerQuotationVersion,
  request: QuotationRequestDetail,
): boolean {
  if (!version.is_current) return false;
  return (
    request.current_quotation_id === null ||
    request.current_quotation_id === undefined ||
    request.current_quotation_id === version.id
  );
}

/** The request-level expiry flag applies only to the current version's actions. */
export function isExpiredForActions(
  version: CustomerQuotationVersion,
  request: QuotationRequestDetail,
): boolean {
  return isCurrentVersion(version, request) && Boolean(version.is_expired || request.is_expired);
}

/**
 * Whether the action bar belongs on this version at all: current, unexpired,
 * and the server allowed at least one of the three actions.
 */
export function canShowActions(
  version: CustomerQuotationVersion,
  request: QuotationRequestDetail,
): boolean {
  if (!isCurrentVersion(version, request)) return false;
  if (isExpiredForActions(version, request)) return false;
  return Boolean(request.can_accept || request.can_reject || request.can_request_change);
}

export function canAcceptQuotation(
  version: CustomerQuotationVersion,
  request: QuotationRequestDetail,
): boolean {
  return (
    isCurrentVersion(version, request) &&
    !isExpiredForActions(version, request) &&
    Boolean(request.can_accept)
  );
}

export function canRejectQuotation(
  version: CustomerQuotationVersion,
  request: QuotationRequestDetail,
): boolean {
  return (
    isCurrentVersion(version, request) &&
    !isExpiredForActions(version, request) &&
    Boolean(request.can_reject)
  );
}

export function canRequestQuotationChange(
  version: CustomerQuotationVersion,
  request: QuotationRequestDetail,
): boolean {
  return (
    isCurrentVersion(version, request) &&
    !isExpiredForActions(version, request) &&
    Boolean(request.can_request_change)
  );
}

/**
 * List/dashboard hint: a sent-but-unread or viewed current version needs the
 * customer's attention, unless it has already expired.
 */
export function isActionable(
  status: string | null | undefined,
  isExpired: boolean | null | undefined,
): boolean {
  if (!status || isExpired) return false;
  return status === 'SENT' || status === 'VIEWED';
}

export interface QuotationListMarkers {
  hasCurrentVersion: boolean;
  currentVersionLabel: string | null;
  currentStatusLabel: string | null;
  validityLabel: string | null;
  actionNeeded: boolean;
  expired: boolean;
}

type QuotationListMarkerSource = Pick<
  QuotationRequestSummary,
  'current_quotation_id' | 'current_version' | 'current_status' | 'valid_until' | 'is_expired'
>;

/** Map the additive list fields into stable labels for the ledger row. */
export function buildQuotationListMarkers(row: QuotationListMarkerSource): QuotationListMarkers {
  const hasCurrentVersion =
    row.current_quotation_id !== null && row.current_quotation_id !== undefined
      ? true
      : row.current_version !== null && row.current_version !== undefined
        ? true
        : Boolean(row.current_status);

  const expired = Boolean(row.is_expired) || row.current_status === 'EXPIRED';
  const validityLabel = row.valid_until
    ? formatValidity(row.valid_until, expired)
    : expired
      ? 'Expired'
      : null;

  return {
    hasCurrentVersion,
    currentVersionLabel:
      row.current_version !== null && row.current_version !== undefined
        ? `Version ${row.current_version}`
        : hasCurrentVersion
          ? 'Quotation ready'
          : null,
    currentStatusLabel: row.current_status ? quotationStatusLabel(row.current_status) : null,
    validityLabel,
    actionNeeded: isActionable(row.current_status, row.is_expired),
    expired,
  };
}

export function quotationLineTotal(item: CustomerQuotationVersionItem): number {
  if (typeof item.line_total === 'number' && Number.isFinite(item.line_total)) {
    return Math.trunc(item.line_total);
  }

  const discount =
    typeof item.line_discount === 'number'
      ? item.line_discount
      : typeof item.discount === 'number'
        ? item.discount
        : 0;
  return Math.max(Math.trunc(item.quantity * item.unit_price - discount), 0);
}

export function quotationItemSupplier(item: CustomerQuotationVersionItem): string | null {
  return item.supplier_name_snapshot ?? item.supplier?.shop_name ?? null;
}

export function quotationActionLabel(action: string): string {
  switch (action) {
    case 'VIEWED':
      return 'Viewed by customer';
    case 'ACCEPTED':
      return 'Accepted by customer';
    case 'REJECTED':
      return 'Rejected by customer';
    case 'REQUESTED_CHANGE':
    case 'CHANGE_REQUESTED':
      return 'Change requested by customer';
    default:
      return quotationStatusLabel(action);
  }
}

export function quotationActorLabel(actorType: string | null | undefined): string | null {
  if (!actorType) return null;

  switch (actorType) {
    case 'CUSTOMER':
      return 'Customer';
    case 'ADMIN':
      return 'Admin';
    case 'SYSTEM':
      return 'System';
    default:
      return formatWords(actorType);
  }
}

export interface BuiltQuotationPayload<T> {
  ok: boolean;
  payload: T | null;
  error: string | null;
  fieldErrors: Record<string, string[]>;
}

export interface AcceptQuotationPayload {
  cod_terms_accepted: true;
}

export interface RejectQuotationPayload {
  customer_note?: string;
}

export interface ChangeQuotationPayload {
  customer_note: string;
}

function noteError(note: string, required: boolean): string | null {
  if (required && note.trim() === '') {
    return 'Describe the change you need before sending this request.';
  }

  if (note.length > CUSTOMER_NOTE_MAX_LENGTH) {
    return `Keep the note to ${CUSTOMER_NOTE_MAX_LENGTH.toLocaleString('en-US')} characters or fewer.`;
  }

  return null;
}

/** Accept is gated on the explicit COD acknowledgement checkbox. */
export function buildAcceptPayload(acknowledged: boolean): BuiltQuotationPayload<AcceptQuotationPayload> {
  if (!acknowledged) {
    return {
      ok: false,
      payload: null,
      error: 'Confirm that you accept the Cash on Delivery terms.',
      fieldErrors: {
        cod_terms_accepted: ['Confirm that you accept the Cash on Delivery terms.'],
      },
    };
  }

  return {
    ok: true,
    payload: { cod_terms_accepted: true },
    error: null,
    fieldErrors: {},
  };
}

/** Optional rejection reason; blank notes are omitted from the body. */
export function buildRejectPayload(note: string): BuiltQuotationPayload<RejectQuotationPayload> {
  const error = noteError(note, false);
  if (error) {
    return {
      ok: false,
      payload: null,
      error,
      fieldErrors: { customer_note: [error] },
    };
  }

  const trimmed = note.trim();
  return {
    ok: true,
    payload: trimmed !== '' ? { customer_note: trimmed } : {},
    error: null,
    fieldErrors: {},
  };
}

/** Required change-request note, trimmed before it is sent. */
export function buildChangeRequestPayload(
  note: string,
): BuiltQuotationPayload<ChangeQuotationPayload> {
  const error = noteError(note, true);
  if (error) {
    return {
      ok: false,
      payload: null,
      error,
      fieldErrors: { customer_note: [error] },
    };
  }

  return {
    ok: true,
    payload: { customer_note: note.trim() },
    error: null,
    fieldErrors: {},
  };
}
