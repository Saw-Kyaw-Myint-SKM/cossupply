/**
 * Unit tests for the shared order presentation helpers (Task 09).
 */
import { describe, expect, it } from 'vitest';
import {
  CANCELLABLE_ORDER_STATUSES,
  canCancelOrder,
  formatOrderDate,
  formatOrderDateTime,
  isOpenOrderStatus,
  orderStatusHint,
  paymentMethodLabel,
} from '../orderDisplay';

describe('formatOrderDate', () => {
  it('keeps a date-only value on its calendar day', () => {
    expect(formatOrderDate('2026-10-29')).toBe(
      new Date(2026, 9, 29).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
    );
  });

  it('renders a dash for missing values', () => {
    expect(formatOrderDate(null)).toBe('—');
    expect(formatOrderDate(undefined)).toBe('—');
  });
});

describe('formatOrderDateTime', () => {
  it('renders a dash for missing values', () => {
    expect(formatOrderDateTime(null)).toBe('—');
  });

  it('formats an ISO timestamp', () => {
    expect(formatOrderDateTime('2026-10-23T09:00:00+00:00')).toBe(
      new Date('2026-10-23T09:00:00+00:00').toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    );
  });
});

describe('paymentMethodLabel', () => {
  it('names the fixed COD method', () => {
    expect(paymentMethodLabel('CASH_ON_DELIVERY')).toBe('Cash on delivery');
  });

  it('turns an unknown enum into spaced words', () => {
    expect(paymentMethodLabel('BANK_TRANSFER')).toBe('BANK TRANSFER');
  });

  it('renders a dash for a null method', () => {
    expect(paymentMethodLabel(null)).toBe('—');
  });
});

describe('order cancellation rules', () => {
  it('matches the server transition map', () => {
    expect(CANCELLABLE_ORDER_STATUSES).toEqual([
      'SUPPLIER_CONFIRMATION_REQUIRED',
      'ORDER_CONFIRMED',
      'PREPARING',
      'READY_TO_SHIP',
      'DELIVERY_FAILED',
    ]);
  });

  it('allows cancellation before dispatch and after a failed delivery', () => {
    expect(canCancelOrder('SUPPLIER_CONFIRMATION_REQUIRED')).toBe(true);
    expect(canCancelOrder('PREPARING')).toBe(true);
    expect(canCancelOrder('DELIVERY_FAILED')).toBe(true);
  });

  it('blocks cancellation for terminal and in-transit statuses', () => {
    expect(canCancelOrder('OUT_FOR_DELIVERY')).toBe(false);
    expect(canCancelOrder('DELIVERED')).toBe(false);
    expect(canCancelOrder('CANCELLED')).toBe(false);
    expect(canCancelOrder('SUPPLIER_UNAVAILABLE')).toBe(false);
  });
});

describe('order status helpers', () => {
  it('treats workflow statuses as open', () => {
    expect(isOpenOrderStatus('SUPPLIER_CONFIRMATION_REQUIRED')).toBe(true);
    expect(isOpenOrderStatus('OUT_FOR_DELIVERY')).toBe(true);
    expect(isOpenOrderStatus('COMPLETED')).toBe(false);
    expect(isOpenOrderStatus('CANCELLED')).toBe(false);
  });

  it('explains known statuses and falls back for unknown ones', () => {
    expect(orderStatusHint('SUPPLIER_CONFIRMATION_REQUIRED')).toContain('confirming stock');
    expect(orderStatusHint('CANCELLED')).toBe('This order was cancelled.');
    expect(orderStatusHint('SOMETHING_NEW')).toBe(
      'The supplier team is handling this order.',
    );
  });
});
