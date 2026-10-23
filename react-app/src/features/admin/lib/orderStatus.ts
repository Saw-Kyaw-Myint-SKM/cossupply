/**
 * Pure presentation/action helpers for the Admin order screens (Task 09).
 *
 * The server owns the transition table: the detail response's
 * `available_statuses` is the only source of action buttons. These helpers
 * translate that list into stable labels, tones, required-note rules, and a
 * validated PATCH body. Nothing here touches React or the network.
 *
 * Task 09 deliberately exposes only the supplier-confirmation slice
 * (ORDER_CONFIRMED, PREPARING, SUPPLIER_UNAVAILABLE, CANCELLED). Delivery and
 * cash-collection statuses are displayed when the API returns them, but no
 * action for them is offered here.
 */
import { formatMMK } from '../../../lib/money';
import type { OrderStatusActionTarget } from '../api/ordersApi';

/** Contract limit for the optional reason on the status PATCH. */
export const ORDER_NOTE_MAX_LENGTH = 2000;

export type OrderStatusTone =
  | 'neutral'
  | 'info'
  | 'progress'
  | 'success'
  | 'warning'
  | 'danger';

const ORDER_STATUS_LABELS: Record<string, string> = {
  SUPPLIER_CONFIRMATION_REQUIRED: 'Supplier confirmation required',
  ORDER_CONFIRMED: 'Order confirmed',
  PREPARING: 'Preparing',
  READY_TO_SHIP: 'Ready to ship',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  COMPLETED: 'Completed',
  SUPPLIER_UNAVAILABLE: 'Supplier unavailable',
  DELIVERY_FAILED: 'Delivery failed',
  RETURNED: 'Returned',
  CANCELLED: 'Cancelled',
};

const ORDER_STATUS_TONES: Record<string, OrderStatusTone> = {
  SUPPLIER_CONFIRMATION_REQUIRED: 'warning',
  ORDER_CONFIRMED: 'success',
  PREPARING: 'progress',
  READY_TO_SHIP: 'info',
  OUT_FOR_DELIVERY: 'progress',
  DELIVERED: 'success',
  COMPLETED: 'success',
  SUPPLIER_UNAVAILABLE: 'danger',
  DELIVERY_FAILED: 'danger',
  RETURNED: 'danger',
  CANCELLED: 'danger',
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  NOT_PAID: 'Not paid',
  CASH_COLLECTION_PENDING: 'Cash collection pending',
  CASH_COLLECTED: 'Cash collected',
  PAYMENT_CONFIRMED: 'Payment confirmed',
  PAYMENT_FAILED: 'Payment failed',
  CUSTOMER_REFUSED_TO_PAY: 'Customer refused to pay',
};

const PAYMENT_STATUS_TONES: Record<string, OrderStatusTone> = {
  NOT_PAID: 'neutral',
  CASH_COLLECTION_PENDING: 'warning',
  CASH_COLLECTED: 'progress',
  PAYMENT_CONFIRMED: 'success',
  PAYMENT_FAILED: 'danger',
  CUSTOMER_REFUSED_TO_PAY: 'danger',
};

const DELIVERY_STATUS_LABELS: Record<string, string> = {
  NOT_ASSIGNED: 'Not assigned',
  PREPARING: 'Preparing',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  DELIVERY_FAILED: 'Delivery failed',
  RETURNED: 'Returned',
};

const DELIVERY_STATUS_TONES: Record<string, OrderStatusTone> = {
  NOT_ASSIGNED: 'neutral',
  PREPARING: 'progress',
  OUT_FOR_DELIVERY: 'info',
  DELIVERED: 'success',
  DELIVERY_FAILED: 'danger',
  RETURNED: 'danger',
};

/** Tailwind classes for each semantic tone, shared by every order badge. */
export const ORDER_STATUS_TONE_CLASSES: Record<OrderStatusTone, string> = {
  neutral: 'bg-gray-100 text-gray-700 ring-gray-500/20',
  info: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  progress: 'bg-sky-50 text-sky-800 ring-sky-600/20',
  success: 'bg-green-50 text-green-700 ring-green-600/20',
  warning: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  danger: 'bg-red-50 text-red-700 ring-red-600/20',
};

/**
 * All vocabulary from StatusDefinitions §7–9. The list filter uses this
 * because the approved GET /admin/orders contract does not return a
 * server-provided status list.
 */
export const ORDER_STATUSES: string[] = [
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

function formatWords(value: string): string {
  const spaced = value.replace(/_/g, ' ').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function orderStatusLabel(status: string | null | undefined): string {
  if (!status) return '—';
  return ORDER_STATUS_LABELS[status] ?? formatWords(status);
}

export function orderStatusTone(status: string | null | undefined): OrderStatusTone {
  if (!status) return 'neutral';
  return ORDER_STATUS_TONES[status] ?? 'neutral';
}

export function paymentStatusLabel(status: string | null | undefined): string {
  if (!status) return '—';
  return PAYMENT_STATUS_LABELS[status] ?? formatWords(status);
}

export function paymentStatusTone(status: string | null | undefined): OrderStatusTone {
  if (!status) return 'neutral';
  return PAYMENT_STATUS_TONES[status] ?? 'neutral';
}

export function deliveryStatusLabel(status: string | null | undefined): string {
  if (!status) return '—';
  return DELIVERY_STATUS_LABELS[status] ?? formatWords(status);
}

export function deliveryStatusTone(status: string | null | undefined): OrderStatusTone {
  if (!status) return 'neutral';
  return DELIVERY_STATUS_TONES[status] ?? 'neutral';
}

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseOrderDate(value: string): Date | null {
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

/** "Oct 24, 2026" for order and audit dates. */
export function formatOrderDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = parseOrderDate(value);
  if (!date) return '—';

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** "Oct 24, 2026, 2:45 PM" for audit stamps. */
export function formatOrderDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = parseOrderDate(value);
  if (!date) return '—';

  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Integer MMK formatting for defensive rendering. */
export function formatOrderAmount(amount: number | null | undefined): string {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return '—';
  return formatMMK(amount);
}

export interface OrderStatusAction {
  status: OrderStatusActionTarget;
  label: string;
  /** Destructive actions get the red treatment and a finality warning. */
  destructive: boolean;
  /** SUPPLIER_UNAVAILABLE and CANCELLED require a reason. */
  requiresNote: boolean;
}

const ACTION_DEFINITIONS: Record<
  OrderStatusActionTarget,
  Omit<OrderStatusAction, 'status'>
> = {
  ORDER_CONFIRMED: {
    label: 'Confirm supplier available',
    destructive: false,
    requiresNote: false,
  },
  PREPARING: {
    label: 'Start preparing',
    destructive: false,
    requiresNote: false,
  },
  SUPPLIER_UNAVAILABLE: {
    label: 'Supplier unavailable',
    destructive: true,
    requiresNote: true,
  },
  CANCELLED: {
    label: 'Cancel order',
    destructive: true,
    requiresNote: true,
  },
};

/** The order the action buttons appear in, from confirmation to cancellation. */
export const ORDER_ACTION_PRIORITY: OrderStatusActionTarget[] = [
  'ORDER_CONFIRMED',
  'PREPARING',
  'SUPPLIER_UNAVAILABLE',
  'CANCELLED',
];

export function isOrderActionTarget(status: string): status is OrderStatusActionTarget {
  return status in ACTION_DEFINITIONS;
}

/**
 * Only targets the server put in `available_statuses` become buttons, and only
 * those this task owns are recognised. Unknown/next-task targets are ignored
 * rather than guessed at.
 */
export function orderActionButtons(
  availableStatuses: readonly string[] | null | undefined,
): OrderStatusAction[] {
  if (!availableStatuses || availableStatuses.length === 0) return [];

  const available = new Set(availableStatuses);
  return ORDER_ACTION_PRIORITY.filter((status) => available.has(status)).map(
    (status) => ({ status, ...ACTION_DEFINITIONS[status] }),
  );
}

export function orderActionRequiresNote(status: string | null | undefined): boolean {
  return Boolean(status && isOrderActionTarget(status) && ACTION_DEFINITIONS[status].requiresNote);
}

export function orderActionIsDestructive(status: string | null | undefined): boolean {
  return Boolean(
    status && isOrderActionTarget(status) && ACTION_DEFINITIONS[status].destructive,
  );
}

/** Human label for the reason field of the confirmation panel. */
export function orderActionReasonLabel(status: string | null | undefined): string {
  if (status === 'SUPPLIER_UNAVAILABLE') return 'Reason the supplier is unavailable';
  if (status === 'CANCELLED') return 'Cancellation reason';
  return 'Note (optional)';
}

/**
 * Trim-aware reason validation. Empty values are only an error when the
 * transition requires a reason; over-limit values fail for every action.
 */
export function validateOrderActionNote(
  status: string | null | undefined,
  note: string,
): string | null {
  const trimmed = note.trim();
  const required = orderActionRequiresNote(status);

  if (required && trimmed === '') {
    return 'Add a reason before making this change. It is recorded in the order history.';
  }

  if (trimmed.length > ORDER_NOTE_MAX_LENGTH) {
    return `Keep the reason to ${ORDER_NOTE_MAX_LENGTH.toLocaleString('en-US')} characters or fewer.`;
  }

  return null;
}

export interface OrderStatusPayload {
  status: string;
  note?: string;
}

export interface BuiltOrderStatusPayload {
  ok: boolean;
  payload: OrderStatusPayload | null;
  error: string | null;
  fieldErrors: Record<string, string[]>;
}

/** Validate and build the PATCH body; notes are trimmed and blank optional notes omitted. */
export function buildOrderStatusPayload(
  status: string,
  note: string,
): BuiltOrderStatusPayload {
  const error = validateOrderActionNote(status, note);
  if (error) {
    return {
      ok: false,
      payload: null,
      error,
      fieldErrors: { note: [error] },
    };
  }

  const trimmed = note.trim();
  return {
    ok: true,
    payload: trimmed !== '' ? { status, note: trimmed } : { status },
    error: null,
    fieldErrors: {},
  };
}

export function orderHistoryActorLabel(actorType: string | null | undefined): string | null {
  if (!actorType) return null;

  switch (actorType) {
    case 'ADMIN':
      return 'Admin';
    case 'CUSTOMER':
      return 'Customer';
    case 'SYSTEM':
      return 'System';
    default:
      return formatWords(actorType);
  }
}

/** "Supplier confirmation required → Order confirmed" for the history trail. */
export function orderStatusTransitionLabel(
  oldStatus: string | null | undefined,
  newStatus: string | null | undefined,
): string {
  return `${orderStatusLabel(oldStatus)} → ${orderStatusLabel(newStatus)}`;
}
