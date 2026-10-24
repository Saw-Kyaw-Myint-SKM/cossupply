/**
 * Shared presentation helpers for the catalog UI (Tasks 04 and 05).
 *
 * The visual language matches the existing admin pages
 * (AdminDashboardPage / AdminSettingsPage): white cards, gray text, and
 * primary buttons on a paper background. The public
 * browse/cart pages reuse the same primitives so loading, empty, and error
 * states look and behave identically everywhere. The cart "receipt moment"
 * (addedButtonClass, useReceipt, ReceiptCheckMark) also lives here so every
 * add-to-order-list surface confirms the logged line the same way.
 */
import { useEffect, useReducer, type ReactNode } from 'react';
import { FiAlertCircle, FiAlertTriangle, FiCheckCircle, FiChevronLeft, FiChevronRight, FiInbox, FiInfo } from 'react-icons/fi';
import type { ApiResponse } from '../../api/client';
import type { PaginationMeta } from '../../api/query';
import type { LastAddedCartLine } from '../../lib/cart-context';

export interface LoadErrorState {
  message: string;
  needsLogin: boolean;
}

export function describeLoadError(response: ApiResponse<unknown>, subject: string): LoadErrorState {
  if (response.status === 401) {
    return {
      message: `Your admin session has expired. Sign in again to view ${subject}.`,
      needsLogin: true,
    };
  }

  if (response.status === 403) {
    return {
      message: response.message ?? `Your account does not have permission to view ${subject}.`,
      needsLogin: false,
    };
  }

  if (response.status === undefined) {
    return {
      message: 'Could not reach the server. Check that the API is running and try again.',
      needsLogin: false,
    };
  }

  return {
    message: response.message ?? `Unable to load ${subject}.`,
    needsLogin: false,
  };
}

export function describeRequestError(response: ApiResponse<unknown>, fallback: string): string {
  if (response.status === 401) {
    return 'Your admin session has expired. Sign in again, then try again.';
  }

  if (response.status === 403) {
    return response.message ?? 'Your account does not have permission to do that.';
  }

  if (response.status === undefined) {
    return 'Could not reach the server. Try again.';
  }

  return response.message ?? fallback;
}

/**
 * Customer-facing variants of the two helpers above: the session wording
 * must not say "admin" on buyer pages (`/customer/*` endpoints, Task 06).
 */
export function describeCustomerLoadError(
  response: ApiResponse<unknown>,
  subject: string,
): LoadErrorState {
  if (response.status === 401) {
    return {
      message: `Your session has expired. Sign in again to view ${subject}.`,
      needsLogin: true,
    };
  }

  if (response.status === 403) {
    return {
      message: response.message ?? `Your account does not have permission to view ${subject}.`,
      needsLogin: false,
    };
  }

  if (response.status === undefined) {
    return {
      message: 'Could not reach the server. Check that the API is running and try again.',
      needsLogin: false,
    };
  }

  return {
    message: response.message ?? `Unable to load ${subject}.`,
    needsLogin: false,
  };
}

export function describeCustomerRequestError(
  response: ApiResponse<unknown>,
  fallback: string,
): string {
  if (response.status === 401) {
    return 'Your session has expired. Sign in again, then try again.';
  }

  if (response.status === 403) {
    return response.message ?? 'Your account does not have permission to do that.';
  }

  if (response.status === undefined) {
    return 'Could not reach the server. Try again.';
  }

  return response.message ?? fallback;
}

export function formatStatusLabel(status: string): string {
  const spaced = status.replace(/_/g, ' ').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

const STATUS_BADGE_CLASSES: Record<string, string> = {
  ACTIVE: 'bg-success-soft text-success ring-success/20',
  INACTIVE: 'bg-paper text-muted ring-line/20',
  SUSPENDED: 'bg-error-soft text-error ring-error/20',
  DRAFT: 'bg-paper text-muted ring-line/20',
  PUBLISHED: 'bg-success-soft text-success ring-success/20',
  HIDDEN: 'bg-warning-soft text-warning ring-warning/20',
  OUT_OF_STOCK: 'bg-error-soft text-error ring-error/20',
  IN_STOCK: 'bg-success-soft text-success ring-success/20',
  LOW_STOCK: 'bg-warning-soft text-warning ring-warning/20',
  PRE_ORDER: 'bg-primary-light text-primary ring-primary/20',
  SUPPLIER_CONFIRMATION_REQUIRED: 'bg-purple-50 text-purple-700 ring-purple-500/20',
};

export function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_BADGE_CLASSES[status] ?? 'bg-paper text-ink ring-gray-500/20';

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${tone}`}
    >
      {formatStatusLabel(status)}
    </span>
  );
}

/**
 * Primary action button — friendly, trustworthy, prominent.
 * Warm cyan with smooth hover states for Myanmar users.
 */
export const primaryButtonClass =
  'inline-flex items-center justify-center rounded-lg border border-transparent bg-primary px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover hover:shadow-md active:scale-[.99] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 motion-safe:transition-all disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100';

/**
 * Success state of the cart "receipt moment": right after a line registers,
 * the ink button flips to the warm success green ("Added — N") for the
 * length of the beat, then components settle back to `primaryButtonClass`.
 */
export const addedButtonClass =
  'inline-flex items-center justify-center rounded-lg border border-transparent bg-success px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-success focus:ring-offset-2 motion-reduce:transition-none';

/**
 * Secondary action button — subtle, supportive, ready when needed.
 */
export const secondaryButtonClass =
  'inline-flex items-center justify-center rounded-lg border border-line bg-plate px-4 py-1.5 text-sm font-semibold text-ink shadow-sm hover:bg-accent-soft hover:border-primary/30 active:scale-[.99] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 motion-safe:transition-all disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100';

/**
 * Small button for compact UI areas — tables, inline actions.
 */
export const smallButtonClass =
  'inline-flex items-center justify-center gap-1 rounded-lg border border-line bg-plate px-2.5 py-0.5 text-xs font-semibold text-ink shadow-sm hover:bg-accent-soft hover:border-primary/30 active:scale-[.99] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 motion-safe:transition-all disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100';

/**
 * Danger action button — clear warning, but not alarming.
 */
export const dangerSmallButtonClass =
  'inline-flex items-center justify-center gap-1 rounded-lg border border-error-soft bg-plate px-2.5 py-0.5 text-xs font-semibold text-error shadow-sm hover:bg-error-soft active:scale-[.99] focus:outline-none focus:ring-2 focus:ring-error focus:ring-offset-1 motion-safe:transition-all disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100';

/**
 * Text link — friendly and clear.
 */
export const linkClass =
  'inline-flex items-center gap-1 rounded text-sm font-medium text-primary hover:text-primary-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 motion-safe:transition-colors';

export const dangerLinkClass =
  'rounded text-sm font-medium text-error hover:text-red-800 focus:outline-none focus:ring-2 focus:ring-error focus:ring-offset-2';

export const inputBaseClass =
  'block w-full rounded-lg border px-3 py-2 text-sm text-ink shadow-sm focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-paper disabled:text-subtle motion-safe:transition-all';
export const inputNormalClass = 'border-line bg-white focus:border-primary focus:ring-primary/30';
export const inputErrorClass = 'border-error bg-white focus:border-error focus:ring-error/30';

export function inputClass(hasError: boolean): string {
  return `${inputBaseClass} ${hasError ? inputErrorClass : inputNormalClass}`;
}

/**
 * Join optional id fragments for `aria-describedby`, returning undefined when
 * nothing applies so the attribute is omitted entirely.
 */
export function joinIds(...ids: Array<string | null | undefined | false>): string | undefined {
  const list = ids.filter((id): id is string => typeof id === 'string' && id.length > 0);
  return list.length > 0 ? list.join(' ') : undefined;
}

export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp';

/**
 * Fallback imagery shown when a product/record has no photo of its own.
 * `FALLBACK_BANNER` suits large stages (hero carousel, product detail);
 * `FALLBACK_THUMB` suits cards, list rows, and cart lines.
 */
export const FALLBACK_BANNER =
  'https://ds.ecisolutions.com/pixere.com/ECinteractivePlus/Merrifield-Office-Supply/NewUI/images/banner-img01.jpg';
export const FALLBACK_THUMB =
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT_3W8JAy115erl-nuzfNpkuKHihXzhYWHdim8ExFPEkw&s=10';

/**
 * Category placeholder imagery. When a category has no image of its own, we
 * pick one of these by its id so the same category always shows the same
 * stand-in (stable across renders, varied across the grid).
 */
export const FALLBACK_CATEGORY_IMAGES = [
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQkbg9a6EXoXmsLJ_vwoA8OXmFDzKe6XBzowPGdeUuxaQ&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQz3PXZt3pJG-REHMFmQTXmIXbymeiA2lqo0VgVhfM6FA&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSo17LW0QyujXByPkeLufEOEEjIXDX_JHTelT1EQR0RXw&s',
] as const;

/** Deterministic category fallback image for a given category id. */
export function categoryFallbackImage(id: number): string {
  const index = Math.abs(id) % FALLBACK_CATEGORY_IMAGES.length;
  return FALLBACK_CATEGORY_IMAGES[index];
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

/** Client-side pre-check mirroring the documented jpeg/jpg/png/webp ≤ 2 MB rule. */
export function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return 'Choose a JPEG, PNG, or WebP image.';
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return 'The image must be 2 MB or smaller.';
  }

  return null;
}

/** How long the "Added — N" receipt stays on the button before it settles back. */
export const JUST_ADDED_MS = 1500;

/**
 * Drives the receipt moment for one product: re-renders once when the window
 * closes so the button can settle back to its idle label. Returns null while
 * no receipt is showing, otherwise the logged line.
 */
export function useReceipt(
  productId: number,
  lastAdded: LastAddedCartLine | null,
): LastAddedCartLine | null {
  const [, tick] = useReducer((value: number) => value + 1, 0);
  const justAddedAt = lastAdded && lastAdded.productId === productId ? lastAdded.at : 0;

  useEffect(() => {
    if (justAddedAt === 0) return;

    const remaining = JUST_ADDED_MS - (Date.now() - justAddedAt);
    if (remaining <= 0) return;

    const timer = window.setTimeout(tick, remaining);
    return () => window.clearTimeout(timer);
  }, [justAddedAt]);

  return justAddedAt > 0 && Date.now() - justAddedAt < JUST_ADDED_MS ? lastAdded : null;
}

/** Check mark drawn while the logged line registers. Fully drawn when motion is reduced. */
export function ReceiptCheckMark(): ReactNode {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-4 w-4">
      <path
        d="M5 13l4 4L19 7"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={24}
        className="motion-safe:animate-check-draw"
      />
    </svg>
  );
}

/**
 * The page-level display-price guarantee (LogicFlow §4). One quiet sentence
 * per catalog surface replaces per-card fine print; the product detail page
 * keeps its inline PriceBlock wording. Inline, not a yellow Alert: it is a
 * standing fact, not a warning state.
 */
export function PricingNotice({ className = '' }: { className?: string }): ReactNode {
  return (
    <p className={`flex items-center gap-2 text-[13px] leading-5 text-subtle ${className}`}>
      <FiInfo aria-hidden="true" className="h-4 w-4 flex-none text-subtle" />
      All prices shown are display prices — final pricing is confirmed by the supplier in your
      quotation.
    </p>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  /* Open composition: the header sits on paper, closed by a hairline rule —
   * not a floating card. Section pages own the surface beneath it. */
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-rule pb-4 mb-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

type AlertTone = 'error' | 'success' | 'warning';

const ALERT_TONE_CLASSES: Record<AlertTone, string> = {
  error: 'border-error/30 bg-error-soft text-error',
  success: 'border-success/30 bg-success-soft text-success',
  warning: 'border-warning/30 bg-warning-soft text-warning',
};

const ALERT_TONE_ICONS: Record<AlertTone, ReactNode> = {
  error: <FiAlertCircle aria-hidden="true" className="h-4 w-4 flex-none" />,
  success: <FiCheckCircle aria-hidden="true" className="h-4 w-4 flex-none" />,
  warning: <FiAlertTriangle aria-hidden="true" className="h-4 w-4 flex-none" />,
};

export function Alert({
  tone = 'error',
  children,
  id,
  className = '',
}: {
  tone?: AlertTone;
  children: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <div
      id={id}
      role={tone === 'success' ? 'status' : 'alert'}
      className={`flex items-start gap-2.5 rounded-xl border p-4 ${ALERT_TONE_CLASSES[tone]} ${className}`}
    >
      {ALERT_TONE_ICONS[tone]}
      <div className="min-w-0 text-sm font-medium">{children}</div>
    </div>
  );
}

export function LoadingPanel({ label }: { label: string }) {
  return (
    <div
      className="flex min-h-[40vh] items-center justify-center rounded-2xl border border-rule bg-white p-6"
      role="status"
      aria-live="polite"
    >
      <div
        className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary motion-reduce:animate-none"
        aria-hidden="true"
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}

/**
 * Skeleton plates: shaped exactly like the real ledger card (photo slab,
 * title line, dashed-rule zone, price bar, CTA) so first paint keeps the
 * layout stable instead of handing the page to an empty spinner.
 */
export function SkeletonCard(): ReactNode {
  return (
    <div
      aria-hidden="true"
      className="flex flex-col overflow-hidden rounded-2xl border border-rule bg-white"
    >
      <div className="h-44 animate-pulse border-b border-rule bg-paper" />
      <div className="flex flex-1 flex-col p-4">
        <div className="h-4 w-3/4 animate-pulse rounded bg-rule" />
        <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-paper" />
        <div className="mt-3 flex items-center justify-between border-t border-dashed border-rule/60 pt-3">
          <div className="h-6 w-2/5 animate-pulse rounded bg-rule" />
          <div className="h-2.5 w-1/5 animate-pulse rounded-full bg-rule" />
        </div>
        <div className="mt-auto pt-4">
          <div className="h-10 w-full animate-pulse rounded-lg bg-paper" />
        </div>
      </div>
    </div>
  );
}

/** Skeleton equivalent of one cart line row. */
export function SkeletonRow(): ReactNode {
  return (
    <div aria-hidden="true" className="flex gap-4 p-4">
      <div className="h-20 w-20 flex-none animate-pulse rounded-md bg-paper" />
      <div className="flex flex-1 flex-col gap-2">
        <div className="h-4 w-2/3 animate-pulse rounded bg-line" />
        <div className="h-3 w-1/3 animate-pulse rounded bg-paper" />
        <div className="mt-2 flex items-center justify-between">
          <div className="h-9 w-28 animate-pulse rounded-md bg-paper" />
          <div className="h-4 w-20 animate-pulse rounded bg-line" />
        </div>
      </div>
    </div>
  );
}

export function Pagination({
  meta,
  onPage,
  disabled = false,
}: {
  meta: PaginationMeta;
  onPage: (page: number) => void;
  disabled?: boolean;
}) {
  const from = meta.total === 0 ? 0 : (meta.current_page - 1) * meta.per_page + 1;
  const to = Math.min(meta.current_page * meta.per_page, meta.total);
  const lastPage = Math.max(meta.last_page, 1);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rule bg-white px-4 py-3 rounded-b-2xl">
      <p className="text-sm text-muted">
        Showing <span className="font-semibold text-ink">{from}</span>–
        <span className="font-semibold text-ink">{to}</span> of{' '}
        <span className="font-semibold text-ink tabular-nums">{meta.total}</span>
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPage(meta.current_page - 1)}
          disabled={disabled || meta.current_page <= 1}
          className={secondaryButtonClass}
        >
          <FiChevronLeft aria-hidden="true" className="h-4 w-4" />
          Previous
        </button>
        <span className="text-sm font-medium text-ink" aria-live="polite">
          {meta.current_page} / {lastPage}
        </span>
        <button
          type="button"
          onClick={() => onPage(meta.current_page + 1)}
          disabled={disabled || meta.current_page >= lastPage}
          className={secondaryButtonClass}
        >
          Next
          <FiChevronRight aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export interface FieldProps {
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: string[] | null;
  hint?: ReactNode;
  hintId?: string;
  children: ReactNode;
}

/**
 * Label + hint + error wrapper for form controls. The error paragraph gets the
 * id `<htmlFor>-error`, which callers reference from `aria-describedby`.
 */
export function Field({ label, htmlFor, required = false, error, hint, hintId, children }: FieldProps) {
  const message = error && error.length > 0 ? error[0] : null;

  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
        {label}
        {required ? (
          <>
            <span aria-hidden="true" className="text-red-600">
              {' '}
              *
            </span>
            <span className="sr-only"> (required)</span>
          </>
        ) : null}
      </label>
      {hint ? (
        <p id={hintId} className="mt-1 text-xs text-subtle">
          {hint}
        </p>
      ) : null}
      <div className="mt-1">{children}</div>
      {message ? (
        <p id={`${htmlFor}-error`} className="mt-1.5 text-sm text-red-600">
          {message}
        </p>
      ) : null}
    </div>
  );
}

/** Neutral empty state used by both the admin tables and the public catalog. */
export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-rule bg-white p-10 text-center">
      <FiInbox aria-hidden="true" className="h-10 w-10 text-muted/60" />
      <h2 className="mt-3 text-base font-semibold text-ink">{title}</h2>
      {hint ? <p className="mt-1 max-w-md text-sm text-muted">{hint}</p> : null}
    </div>
  );
}
