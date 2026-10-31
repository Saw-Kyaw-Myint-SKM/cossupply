/**
 * Unit tests for the shared order presentation helpers (Task 09).
 */
import { describe, expect, it } from 'vitest';
import type { Translator } from '../../../../lib/i18n-context';
import {
  CANCELLABLE_ORDER_STATUSES,
  canCancelOrder,
  formatOrderDate,
  formatOrderDateTime,
  isOpenOrderStatus,
  orderStatusHint,
  orderStatusLabel,
  paymentMethodLabel,
} from '../orderDisplay';

const t: Translator = (key, values) => {
  const valuesText = values
    ? Object.entries(values).map(([name, value]) => `${name}=${value}`).join(',')
    : '';
  return valuesText ? `${key}:${valuesText}` : key;
};

describe('formatOrderDate', () => {
  it('keeps a date-only value on its calendar day in the requested locale', () => {
    expect(formatOrderDate('2026-10-29', 'en', t)).toBe(
      new Date(2026, 9, 29).toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
    );
    expect(formatOrderDate('2026-10-29', 'my', t)).toBe(
      new Date(2026, 9, 29).toLocaleDateString('my-MM', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
    );
  });

  it('uses the translated missing-value label', () => {
    expect(formatOrderDate(null, 'en', t)).toBe('statusNoValue');
    expect(formatOrderDate(undefined, 'my', t)).toBe('statusNoValue');
  });
});

describe('formatOrderDateTime', () => {
  it('uses the requested locale for timestamps', () => {
    expect(formatOrderDateTime('2026-10-23T09:00:00+00:00', 'en', t)).toBe(
      new Date('2026-10-23T09:00:00+00:00').toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    );
  });

  it('uses the translated missing-value label', () => {
    expect(formatOrderDateTime(null, 'my', t)).toBe('statusNoValue');
  });
});

describe('paymentMethodLabel', () => {
  it('uses the translated fixed COD method', () => {
    expect(paymentMethodLabel('CASH_ON_DELIVERY', t)).toBe('cashOnDelivery');
  });

  it('uses the translated unknown-status template for new methods', () => {
    expect(paymentMethodLabel('BANK_TRANSFER', t)).toBe('statusUnknown:status=Bank transfer');
  });

  it('uses the translated missing-value label for a null method', () => {
    expect(paymentMethodLabel(null, t)).toBe('statusNoValue');
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

  it('uses translated labels for known statuses and a translated unknown fallback', () => {
    expect(orderStatusLabel('ORDER_CONFIRMED', t)).toBe('statusOrderConfirmed');
    expect(orderStatusLabel('SOMETHING_NEW', t)).toBe('statusUnknown:status=Something new');
  });

  it('uses translated hints for known and unknown statuses', () => {
    expect(orderStatusHint('SUPPLIER_CONFIRMATION_REQUIRED', t)).toBe('orderStatusSupplierConfirmation');
    expect(orderStatusHint('CANCELLED', t)).toBe('orderStatusCancelled');
    expect(orderStatusHint('SOMETHING_NEW', t)).toBe('orderStatusDefault');
  });
});
