/**
 * Shared presentation helpers for customer and admin order views (Task 09).
 *
 * The order payload is a frozen snapshot: these helpers only format what the
 * server already calculated. No money value is ever derived in the browser.
 */

export function formatOrderDate(value: string | null | undefined): string {
  if (!value) return '—';

  // A date-only value (YYYY-MM-DD) is parsed as local time so the displayed
  // day never shifts because of a UTC offset.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);

    return new Date(year, month - 1, day).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  return new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatOrderDateTime(value: string | null | undefined): string {
  if (!value) return '—';

  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function paymentMethodLabel(value: string | null): string {
  if (!value) return '—';

  return value === 'CASH_ON_DELIVERY' ? 'Cash on delivery' : value.replace(/_/g, ' ');
}

/** Statuses an admin may cancel from (mirrors the server transition map). */
export const CANCELLABLE_ORDER_STATUSES = [
  'SUPPLIER_CONFIRMATION_REQUIRED',
  'ORDER_CONFIRMED',
  'PREPARING',
  'READY_TO_SHIP',
  'DELIVERY_FAILED',
];

export function canCancelOrder(status: string): boolean {
  return CANCELLABLE_ORDER_STATUSES.includes(status);
}

/**
 * Plain-language explanation of what the current order status means for the
 * customer. Unknown values fall back to a neutral sentence.
 */
export function orderStatusHint(status: string): string {
  switch (status) {
    case 'SUPPLIER_CONFIRMATION_REQUIRED':
      return 'We are confirming stock, quantity and the delivery date with the supplier.';
    case 'ORDER_CONFIRMED':
      return 'The supplier confirmed your order. We are moving it into preparation.';
    case 'PREPARING':
      return 'Your items are being prepared for delivery.';
    case 'READY_TO_SHIP':
      return 'Your order is packed and waiting for the delivery partner.';
    case 'OUT_FOR_DELIVERY':
      return 'Your order is on the way. Please prepare the cash payment.';
    case 'DELIVERED':
      return 'Your order was delivered. Cash payment is collected on delivery.';
    case 'COMPLETED':
      return 'This order is complete. Thank you for ordering with CoSupply.';
    case 'SUPPLIER_UNAVAILABLE':
      return 'The supplier could not fulfil this order. The supplier team will contact you.';
    case 'DELIVERY_FAILED':
      return 'The delivery could not be completed. The supplier team will follow up with you.';
    case 'RETURNED':
      return 'This order was returned.';
    case 'CANCELLED':
      return 'This order was cancelled.';
    default:
      return 'The supplier team is handling this order.';
  }
}

/** Orders that are still moving through the workflow. */
export const OPEN_ORDER_STATUSES = [
  'SUPPLIER_CONFIRMATION_REQUIRED',
  'ORDER_CONFIRMED',
  'PREPARING',
  'READY_TO_SHIP',
  'OUT_FOR_DELIVERY',
];

export function isOpenOrderStatus(status: string): boolean {
  return OPEN_ORDER_STATUSES.includes(status);
}
