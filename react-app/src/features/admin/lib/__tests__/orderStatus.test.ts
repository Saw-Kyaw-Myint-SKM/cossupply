/**
 * Pure helper tests for the Admin supplier-confirmation screen (Task 09).
 *
 * Covers the rules the UI must not get wrong: only server-allowed actions,
 * required reasons for unavailable/cancellation, trimming and the 2,000
 * character limit, status labels/tones, and history wording.
 */
import { describe, expect, it } from 'vitest';
import {
  ORDER_NOTE_MAX_LENGTH,
  ORDER_STATUS_TONE_CLASSES,
  buildOrderStatusPayload,
  deliveryStatusLabel,
  formatOrderAmount,
  formatOrderDate,
  orderActionButtons,
  orderActionIsDestructive,
  orderActionReasonLabel,
  orderActionRequiresNote,
  orderHistoryActorLabel,
  orderStatusLabel,
  orderStatusTone,
  orderStatusTransitionLabel,
  paymentStatusLabel,
  validateOrderActionNote,
} from '../orderStatus';

describe('orderActionButtons', () => {
  it('maps the server list to labelled, ordered actions', () => {
    const actions = orderActionButtons([
      'CANCELLED',
      'SUPPLIER_UNAVAILABLE',
      'ORDER_CONFIRMED',
      'PREPARING',
    ]);

    expect(actions.map((action) => [action.status, action.label])).toEqual([
      ['ORDER_CONFIRMED', 'Confirm supplier available'],
      ['PREPARING', 'Start preparing'],
      ['SUPPLIER_UNAVAILABLE', 'Supplier unavailable'],
      ['CANCELLED', 'Cancel order'],
    ]);
    expect(actions.filter((action) => action.requiresNote)).toHaveLength(2);
    expect(actions.filter((action) => action.destructive)).toHaveLength(2);
  });

  it('does not invent actions outside the server list or Task 09', () => {
    expect(orderActionButtons(['READY_TO_SHIP', 'OUT_FOR_DELIVERY'])).toEqual([]);
    expect(orderActionButtons(['PREPARING']).map((action) => action.status)).toEqual([
      'PREPARING',
    ]);
    expect(orderActionButtons([])).toEqual([]);
    expect(orderActionButtons(null)).toEqual([]);
  });

  it('exposes per-target note and destructive rules', () => {
    expect(orderActionRequiresNote('SUPPLIER_UNAVAILABLE')).toBe(true);
    expect(orderActionRequiresNote('CANCELLED')).toBe(true);
    expect(orderActionRequiresNote('ORDER_CONFIRMED')).toBe(false);
    expect(orderActionRequiresNote('READY_TO_SHIP')).toBe(false);

    expect(orderActionIsDestructive('CANCELLED')).toBe(true);
    expect(orderActionIsDestructive('SUPPLIER_UNAVAILABLE')).toBe(true);
    expect(orderActionIsDestructive('PREPARING')).toBe(false);
  });

  it('names the reason field for the operator', () => {
    expect(orderActionReasonLabel('SUPPLIER_UNAVAILABLE')).toBe(
      'Reason the supplier is unavailable',
    );
    expect(orderActionReasonLabel('CANCELLED')).toBe('Cancellation reason');
    expect(orderActionReasonLabel('ORDER_CONFIRMED')).toBe('Note (optional)');
  });
});

describe('validateOrderActionNote / buildOrderStatusPayload', () => {
  it('requires a non-whitespace reason for unavailable and cancellation', () => {
    const message =
      'Add a reason before making this change. It is recorded in the order history.';

    for (const status of ['SUPPLIER_UNAVAILABLE', 'CANCELLED']) {
      expect(validateOrderActionNote(status, '   ')).toBe(message);
      expect(validateOrderActionNote(status, '')).toBe(message);

      const built = buildOrderStatusPayload(status, '  ');
      expect(built.ok).toBe(false);
      expect(built.payload).toBeNull();
      expect(built.fieldErrors.note?.[0]).toBe(message);
    }
  });

  it('allows a blank note for confirmation and preparation', () => {
    expect(validateOrderActionNote('ORDER_CONFIRMED', '   ')).toBeNull();
    expect(buildOrderStatusPayload('ORDER_CONFIRMED', '   ')).toEqual({
      ok: true,
      payload: { status: 'ORDER_CONFIRMED' },
      error: null,
      fieldErrors: {},
    });
  });

  it('trims a supplied reason into the PATCH body', () => {
    expect(buildOrderStatusPayload('CANCELLED', '  Supplier closed this month  ')).toEqual({
      ok: true,
      payload: { status: 'CANCELLED', note: 'Supplier closed this month' },
      error: null,
      fieldErrors: {},
    });
  });

  it('keeps an optional note when one is supplied', () => {
    expect(buildOrderStatusPayload('PREPARING', '  Packing starts Monday  ').payload).toEqual({
      status: 'PREPARING',
      note: 'Packing starts Monday',
    });
  });

  it('rejects a reason over the contract limit, including whitespace edges', () => {
    const tooLong = 'x'.repeat(ORDER_NOTE_MAX_LENGTH + 1);
    expect(validateOrderActionNote('CANCELLED', tooLong)).toContain('2,000');

    const built = buildOrderStatusPayload('ORDER_CONFIRMED', tooLong);
    expect(built.ok).toBe(false);
    expect(built.fieldErrors.note).toHaveLength(1);
  });

  it('accepts exactly the maximum length after trimming', () => {
    const max = ` ${'x'.repeat(ORDER_NOTE_MAX_LENGTH)} `;
    const built = buildOrderStatusPayload('CANCELLED', max);
    expect(built.ok).toBe(true);
    expect(built.payload?.note).toHaveLength(ORDER_NOTE_MAX_LENGTH);
  });
});

describe('status vocabulary', () => {
  it('labels order, payment, and delivery statuses', () => {
    expect(orderStatusLabel('SUPPLIER_CONFIRMATION_REQUIRED')).toBe(
      'Supplier confirmation required',
    );
    expect(orderStatusLabel('ORDER_CONFIRMED')).toBe('Order confirmed');
    expect(orderStatusLabel('SOMETHING_NEW')).toBe('Something new');
    expect(orderStatusLabel(null)).toBe('—');

    expect(paymentStatusLabel('CASH_COLLECTION_PENDING')).toBe('Cash collection pending');
    expect(paymentStatusLabel('CUSTOMER_REFUSED_TO_PAY')).toBe('Customer refused to pay');
    expect(deliveryStatusLabel('NOT_ASSIGNED')).toBe('Not assigned');
    expect(deliveryStatusLabel('OUT_FOR_DELIVERY')).toBe('Out for delivery');
  });

  it('assigns semantic tones and exposes their class map', () => {
    expect(orderStatusTone('CANCELLED')).toBe('danger');
    expect(orderStatusTone('ORDER_CONFIRMED')).toBe('success');
    expect(orderStatusTone('UNKNOWN')).toBe('neutral');
    expect(ORDER_STATUS_TONE_CLASSES.danger).toContain('bg-red-50');
    expect(ORDER_STATUS_TONE_CLASSES.success).toContain('bg-green-50');
  });

  it('formats date-only order values and malformed amounts defensively', () => {
    expect(formatOrderDate('2026-10-24')).toBe('Oct 24, 2026');
    expect(formatOrderDate(null)).toBe('—');
    expect(formatOrderAmount(125000)).toBe('125,000');
    expect(formatOrderAmount(Number.NaN)).toBe('—');
  });

  it('describes history actors and transitions', () => {
    expect(orderHistoryActorLabel('ADMIN')).toBe('Admin');
    expect(orderHistoryActorLabel('SYSTEM')).toBe('System');
    expect(orderHistoryActorLabel(null)).toBeNull();
    expect(
      orderStatusTransitionLabel('SUPPLIER_CONFIRMATION_REQUIRED', 'ORDER_CONFIRMED'),
    ).toBe('Supplier confirmation required → Order confirmed');
  });
});
