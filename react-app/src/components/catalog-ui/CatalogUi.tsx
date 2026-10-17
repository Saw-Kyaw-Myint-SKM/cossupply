/**
 * Shared presentation helpers for the catalog UI (Tasks 04 and 05).
 *
 * The visual language matches the existing admin pages
 * (AdminDashboardPage / AdminSettingsPage): white cards, gray text, and
 * gray-800 primary buttons on a gray-50 page background. The public
 * browse/cart pages reuse the same primitives so loading, empty, and error
 * states look and behave identically everywhere.
 */
import type { ReactNode } from 'react';
import type { ApiResponse } from '../../api/client';
import type { PaginationMeta } from '../../api/query';

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

export function formatStatusLabel(status: string): string {
  const spaced = status.replace(/_/g, ' ').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

const STATUS_BADGE_CLASSES: Record<string, string> = {
  ACTIVE: 'bg-green-50 text-green-700 ring-green-600/20',
  INACTIVE: 'bg-gray-100 text-gray-600 ring-gray-500/20',
  SUSPENDED: 'bg-red-50 text-red-700 ring-red-600/20',
  DRAFT: 'bg-gray-100 text-gray-600 ring-gray-500/20',
  PUBLISHED: 'bg-green-50 text-green-700 ring-green-600/20',
  HIDDEN: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  OUT_OF_STOCK: 'bg-red-50 text-red-700 ring-red-600/20',
  IN_STOCK: 'bg-green-50 text-green-700 ring-green-600/20',
  LOW_STOCK: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  PRE_ORDER: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  SUPPLIER_CONFIRMATION_REQUIRED: 'bg-purple-50 text-purple-700 ring-purple-600/20',
};

export function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_BADGE_CLASSES[status] ?? 'bg-gray-100 text-gray-700 ring-gray-500/20';

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${tone}`}
    >
      {formatStatusLabel(status)}
    </span>
  );
}

export const primaryButtonClass =
  'inline-flex items-center justify-center rounded-md border border-transparent bg-gray-800 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

export const secondaryButtonClass =
  'inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

export const smallButtonClass =
  'inline-flex items-center rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50';

export const dangerSmallButtonClass =
  'inline-flex items-center rounded-md border border-red-300 bg-white px-2.5 py-1 text-xs font-medium text-red-700 shadow-sm hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50';

export const linkClass =
  'rounded text-sm font-medium text-blue-700 hover:text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2';

export const dangerLinkClass =
  'rounded text-sm font-medium text-red-700 hover:text-red-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2';

export const inputBaseClass =
  'block w-full rounded-md border px-3 py-2 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500';
export const inputNormalClass = 'border-gray-300 focus:border-blue-500 focus:ring-blue-500';
export const inputErrorClass = 'border-red-300 focus:border-red-500 focus:ring-red-500';

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

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {description ? <p className="mt-1 text-gray-600">{description}</p> : null}
        </div>
        {action}
      </div>
    </div>
  );
}

type AlertTone = 'error' | 'success' | 'warning';

const ALERT_TONE_CLASSES: Record<AlertTone, string> = {
  error: 'border-red-200 bg-red-50 text-red-800',
  success: 'border-green-200 bg-green-50 text-green-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
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
      className={`rounded-lg border p-4 ${ALERT_TONE_CLASSES[tone]} ${className}`}
    >
      {children}
    </div>
  );
}

export function LoadingPanel({ label }: { label: string }) {
  return (
    <div
      className="flex min-h-[40vh] items-center justify-center rounded-lg bg-white p-6 shadow"
      role="status"
      aria-live="polite"
    >
      <div
        className="h-10 w-10 animate-spin rounded-full border-b-2 border-blue-600 motion-reduce:animate-none"
        aria-hidden="true"
      />
      <span className="sr-only">{label}</span>
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
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-4 py-3">
      <p className="text-sm text-gray-600">
        Showing <span className="font-medium text-gray-900">{from}</span>–
        <span className="font-medium text-gray-900">{to}</span> of{' '}
        <span className="font-medium text-gray-900">{meta.total}</span>
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPage(meta.current_page - 1)}
          disabled={disabled || meta.current_page <= 1}
          className={secondaryButtonClass}
        >
          Previous
        </button>
        <span className="text-sm text-gray-600" aria-live="polite">
          Page {meta.current_page} of {lastPage}
        </span>
        <button
          type="button"
          onClick={() => onPage(meta.current_page + 1)}
          disabled={disabled || meta.current_page >= lastPage}
          className={secondaryButtonClass}
        >
          Next
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
      <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-900">
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
        <p id={hintId} className="mt-1 text-xs text-gray-500">
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
    <div className="rounded-lg bg-white p-10 text-center shadow">
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      {hint ? <p className="mt-1 text-sm text-gray-500">{hint}</p> : null}
    </div>
  );
}
