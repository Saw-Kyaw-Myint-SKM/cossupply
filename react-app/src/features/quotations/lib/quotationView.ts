import type { Locale, TranslationKey, Translator } from '../../../lib/i18n-context';
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

const STATUS_LABELS: Record<string, TranslationKey> = {
  // Quotation request statuses.
  NEW: 'statusNew',
  CONTACTING_SUPPLIER: 'statusContactingSupplier',
  SUPPLIER_RESPONSE_PENDING: 'statusAwaitingSupplier',
  PREPARING_QUOTATION: 'statusPreparingQuotation',
  QUOTATION_SENT: 'statusQuotationSent',
  CUSTOMER_REVIEWING: 'statusReviewing',
  CHANGE_REQUESTED: 'statusChangeRequested',
  ACCEPTED: 'statusAccepted',
  REJECTED: 'statusRejected',
  EXPIRED: 'statusExpired',
  CANCELLED: 'statusCancelled',
  // Quotation version statuses.
  DRAFT: 'statusDraft',
  SENT: 'statusSent',
  VIEWED: 'statusViewed',
  SUPERSEDED: 'statusSuperseded',
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

export function quotationStatusLabel(
  status: string | null | undefined,
  t: Translator,
): string {
  if (!status) return t('statusNoValue');
  const key = STATUS_LABELS[status];
  return key ? t(key) : t('statusUnknown', { status: formatWords(status) });
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
export function formatQuotationDate(
  value: string | null | undefined,
  locale: Locale,
  t: Translator,
): string {
  if (!value) return t('statusNoValue');
  const date = parseQuotationDate(value);
  if (!date) return t('statusNoValue');

  return date.toLocaleDateString(locale === 'my' ? 'my-MM' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** "Oct 19, 2026, 2:45 PM" for audit stamps. */
export function formatQuotationDateTime(
  value: string | null | undefined,
  locale: Locale,
  t: Translator,
): string {
  if (!value) return t('statusNoValue');
  const date = parseQuotationDate(value);
  if (!date) return t('statusNoValue');

  return date.toLocaleString(locale === 'my' ? 'my-MM' : 'en-US', {
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
  isExpired: boolean,
  locale: Locale,
  t: Translator,
): string {
  if (!validUntil) return t('noValidityDate');
  const date = formatQuotationDate(validUntil, locale, t);
  return isExpired ? `${t('expired')} ${date}` : t('validUntil', { date });
}

/** Integer MMK formatting; malformed amounts render as an em dash, never NaN. */
export function formatQuotationAmount(amount: number | null | undefined, t: Translator): string {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return t('statusNoValue');
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
export function buildQuotationListMarkers(
  row: QuotationListMarkerSource,
  locale: Locale,
  t: Translator,
): QuotationListMarkers {
  const hasCurrentVersion =
    row.current_quotation_id !== null && row.current_quotation_id !== undefined
      ? true
      : row.current_version !== null && row.current_version !== undefined
        ? true
        : Boolean(row.current_status);

  const expired = Boolean(row.is_expired) || row.current_status === 'EXPIRED';
  const validityLabel = row.valid_until
    ? formatValidity(row.valid_until, expired, locale, t)
    : expired
      ? t('expired')
      : null;

  return {
    hasCurrentVersion,
    currentVersionLabel:
      row.current_version !== null && row.current_version !== undefined
        ? t('version', { version: row.current_version })
        : hasCurrentVersion
          ? t('quotationReady')
          : null,
    currentStatusLabel: row.current_status ? quotationStatusLabel(row.current_status, t) : null,
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

const ACTION_LABEL_KEYS: Record<string, TranslationKey> = {
  VIEWED: 'viewedByCustomer',
  ACCEPTED: 'acceptedByCustomer',
  REJECTED: 'rejectedByCustomer',
  REQUESTED_CHANGE: 'changeRequestedByCustomer',
  CHANGE_REQUESTED: 'changeRequestedByCustomer',
};

export function quotationActionLabel(action: string, t: Translator): string {
  const key = ACTION_LABEL_KEYS[action];
  return key ? t(key) : quotationStatusLabel(action, t);
}

const ACTOR_LABEL_KEYS: Record<string, TranslationKey> = {
  CUSTOMER: 'customer',
  ADMIN: 'adminUser',
  SYSTEM: 'system',
};

export function quotationActorLabel(
  actorType: string | null | undefined,
  t: Translator,
): string | null {
  if (!actorType) return null;
  const key = ACTOR_LABEL_KEYS[actorType];
  return key ? t(key) : t('statusUnknown', { status: formatWords(actorType) });
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

function noteError(note: string, required: boolean, t: Translator): string | null {
  if (required && note.trim() === '') return t('changeNoteRequired');
  if (note.length > CUSTOMER_NOTE_MAX_LENGTH) {
    return t('noteTooLong', { max: CUSTOMER_NOTE_MAX_LENGTH.toLocaleString('en-US') });
  }
  return null;
}

/** Accept is gated on the explicit COD acknowledgement checkbox. */
export function buildAcceptPayload(
  acknowledged: boolean,
  t: Translator,
): BuiltQuotationPayload<AcceptQuotationPayload> {
  if (!acknowledged) {
    const error = t('acceptCodError');
    return {
      ok: false,
      payload: null,
      error,
      fieldErrors: { cod_terms_accepted: [error] },
    };
  }

  return { ok: true, payload: { cod_terms_accepted: true }, error: null, fieldErrors: {} };
}

/** Optional rejection reason; blank notes are omitted from the body. */
export function buildRejectPayload(
  note: string,
  t: Translator,
): BuiltQuotationPayload<RejectQuotationPayload> {
  const error = noteError(note, false, t);
  if (error) return { ok: false, payload: null, error, fieldErrors: { customer_note: [error] } };

  const trimmed = note.trim();
  return { ok: true, payload: trimmed !== '' ? { customer_note: trimmed } : {}, error: null, fieldErrors: {} };
}

/** Required change-request note, trimmed before it is sent. */
export function buildChangeRequestPayload(
  note: string,
  t: Translator,
): BuiltQuotationPayload<ChangeQuotationPayload> {
  const error = noteError(note, true, t);
  if (error) return { ok: false, payload: null, error, fieldErrors: { customer_note: [error] } };

  return { ok: true, payload: { customer_note: note.trim() }, error: null, fieldErrors: {} };
}
