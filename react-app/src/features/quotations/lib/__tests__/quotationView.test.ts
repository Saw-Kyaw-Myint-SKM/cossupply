/**
 * Pure helper tests for the customer quotation review screen (Task 08).
 *
 * These cover the rules the UI must not get wrong: who may act
 * (current/expired/status), the required COD acknowledgement, note validation
 * and trimming, money/date formatting, and the additively delivered list
 * markers. No DOM is required — the project's vitest environment is `node`.
 */
import { describe, expect, it } from 'vitest';
import type {
  CustomerQuotationVersion,
  QuotationRequestDetail,
} from '../../api/quotationsApi';
import {
  buildAcceptPayload,
  buildChangeRequestPayload,
  buildQuotationListMarkers,
  buildRejectPayload,
  canAcceptQuotation,
  canRejectQuotation,
  canRequestQuotationChange,
  canShowActions,
  CUSTOMER_NOTE_MAX_LENGTH,
  formatQuotationAmount,
  formatQuotationDate,
  formatQuotationDateTime,
  formatValidity,
  isActionable,
  isExpiredForActions,
  quotationActionLabel,
  quotationActorLabel,
  quotationLineTotal,
  quotationStatusLabel,
  quotationStatusTone,
  sortVersionsNewestFirst,
  visibleQuotationVersions,
} from '../quotationView';

function makeVersion(
  overrides: Partial<CustomerQuotationVersion> = {},
): CustomerQuotationVersion {
  return {
    id: 7,
    version: 1,
    status: 'SENT',
    is_current: true,
    is_expired: false,
    valid_until: '2026-10-31',
    delivery_date: null,
    subtotal: 10000,
    discount_amount: 500,
    delivery_fee: 1000,
    service_fee_percentage: 5,
    service_fee: 500,
    total_amount: 11000,
    cod_terms: 'Full cash payment on delivery (COD).',
    admin_note: null,
    sent_at: '2026-10-20T09:00:00.000000Z',
    items: [],
    actions: [],
    ...overrides,
  };
}

function makeRequest(
  overrides: Partial<QuotationRequestDetail> = {},
): QuotationRequestDetail {
  return {
    id: 42,
    quotation_number: 'QT-2026-0042',
    status: 'QUOTATION_SENT',
    customer_name: 'Daw Hla',
    company_name: null,
    phone: '09-770-100-200',
    email: null,
    city: 'Yangon',
    township: 'Bahan',
    landmark: null,
    delivery_address: 'No. 12, Merchant St, Bahan, Yangon',
    required_delivery_date: null,
    customer_note: null,
    created_at: '2026-10-19T08:00:00.000000Z',
    items: [],
    current_quotation_id: 7,
    is_expired: false,
    can_accept: true,
    can_reject: true,
    can_request_change: true,
    versions: [makeVersion()],
    ...overrides,
  };
}

describe('quotation status mapping', () => {
  it('labels request and version statuses', () => {
    expect(quotationStatusLabel('SENT')).toBe('Sent');
    expect(quotationStatusLabel('CUSTOMER_REVIEWING')).toBe('Reviewing');
    expect(quotationStatusLabel('CHANGE_REQUESTED')).toBe('Change requested');
    expect(quotationStatusLabel('SUPERSEDED')).toBe('Superseded');
    expect(quotationStatusLabel(null)).toBe('—');
  });

  it('maps semantic tones so accepted is green and rejected/expired are red', () => {
    expect(quotationStatusTone('ACCEPTED')).toBe('success');
    expect(quotationStatusTone('SENT')).toBe('info');
    expect(quotationStatusTone('VIEWED')).toBe('progress');
    expect(quotationStatusTone('CHANGE_REQUESTED')).toBe('warning');
    expect(quotationStatusTone('REJECTED')).toBe('danger');
    expect(quotationStatusTone('EXPIRED')).toBe('danger');
    expect(quotationStatusTone('SUPERSEDED')).toBe('neutral');
    expect(quotationStatusTone('SOMETHING_NEW')).toBe('neutral');
  });
});

describe('action visibility', () => {
  it('allows actions only for the current, unexpired version the server flags', () => {
    const request = makeRequest();
    expect(canShowActions(makeVersion(), request)).toBe(true);
    expect(canAcceptQuotation(makeVersion(), request)).toBe(true);
    expect(canRejectQuotation(makeVersion(), request)).toBe(true);
    expect(canRequestQuotationChange(makeVersion(), request)).toBe(true);
  });

  it('hides actions for a non-current version', () => {
    const request = makeRequest({ can_accept: true, can_reject: true, can_request_change: true });
    const oldVersion = makeVersion({ id: 3, is_current: false, status: 'SUPERSEDED' });

    expect(canShowActions(oldVersion, request)).toBe(false);
    expect(canAcceptQuotation(oldVersion, request)).toBe(false);
    expect(canRejectQuotation(oldVersion, request)).toBe(false);
    expect(canRequestQuotationChange(oldVersion, request)).toBe(false);
  });

  it('hides actions when the current version or request is expired', () => {
    const expiredVersion = makeVersion({ is_expired: true });
    const request = makeRequest({ is_expired: true });

    expect(canShowActions(expiredVersion, request)).toBe(false);
    expect(canAcceptQuotation(expiredVersion, request)).toBe(false);
    expect(isExpiredForActions(expiredVersion, request)).toBe(true);
  });

  it('respects each server flag independently', () => {
    const request = makeRequest({
      can_accept: false,
      can_reject: true,
      can_request_change: false,
    });
    const version = makeVersion();

    expect(canShowActions(version, request)).toBe(true);
    expect(canAcceptQuotation(version, request)).toBe(false);
    expect(canRejectQuotation(version, request)).toBe(true);
    expect(canRequestQuotationChange(version, request)).toBe(false);
  });

  it('treats the request-level expiry flag only against the current version', () => {
    const request = makeRequest({ is_expired: true, current_quotation_id: 7 });
    const olderVersion = makeVersion({ id: 3, is_current: false });

    expect(isExpiredForActions(makeVersion({ id: 7 }), request)).toBe(true);
    expect(isExpiredForActions(olderVersion, request)).toBe(false);
  });

  it('marks SENT/VIEWED current statuses actionable until expiry', () => {
    expect(isActionable('SENT', false)).toBe(true);
    expect(isActionable('VIEWED', false)).toBe(true);
    expect(isActionable('SENT', true)).toBe(false);
    expect(isActionable('ACCEPTED', false)).toBe(false);
    expect(isActionable(undefined, false)).toBe(false);
  });
});

describe('COD acknowledgement and note payloads', () => {
  it('blocks accept until the COD terms are acknowledged', () => {
    const blocked = buildAcceptPayload(false);
    expect(blocked.ok).toBe(false);
    expect(blocked.payload).toBeNull();
    expect(blocked.fieldErrors.cod_terms_accepted).toHaveLength(1);

    const allowed = buildAcceptPayload(true);
    expect(allowed.ok).toBe(true);
    expect(allowed.payload).toEqual({ cod_terms_accepted: true });
  });

  it('accepts an empty optional rejection note as an empty body', () => {
    const built = buildRejectPayload('   ');
    expect(built.ok).toBe(true);
    expect(built.payload).toEqual({});
  });

  it('trims a supplied rejection note', () => {
    const built = buildRejectPayload('  Found a better price  ');
    expect(built.ok).toBe(true);
    expect(built.payload).toEqual({ customer_note: 'Found a better price' });
  });

  it('requires a change-request note and trims it', () => {
    const empty = buildChangeRequestPayload('   ');
    expect(empty.ok).toBe(false);
    expect(empty.payload).toBeNull();
    expect(empty.fieldErrors.customer_note).toHaveLength(1);

    const filled = buildChangeRequestPayload('  Please ship 10 instead of 5  ');
    expect(filled.ok).toBe(true);
    expect(filled.payload).toEqual({ customer_note: 'Please ship 10 instead of 5' });
  });

  it('enforces the 2,000 character limit on both note actions', () => {
    const atLimit = 'a'.repeat(CUSTOMER_NOTE_MAX_LENGTH);
    expect(buildChangeRequestPayload(atLimit).ok).toBe(true);
    expect(buildRejectPayload(atLimit).ok).toBe(true);

    const overLimit = 'a'.repeat(CUSTOMER_NOTE_MAX_LENGTH + 1);
    expect(buildChangeRequestPayload(overLimit).ok).toBe(false);
    expect(buildRejectPayload(overLimit).ok).toBe(false);
  });
});

describe('money, dates, and version helpers', () => {
  it('formats integer MMK without decimal places and preserves values', () => {
    expect(formatQuotationAmount(11000)).toBe('11,000');
    expect(formatQuotationAmount(1234.9)).toBe('1,234');
    expect(formatQuotationAmount(null)).toBe('—');
    expect(formatQuotationAmount(Number.NaN)).toBe('—');
  });

  it('formats date-only validity without timezone drift', () => {
    expect(formatQuotationDate('2026-10-31')).toBe('Oct 31, 2026');
    expect(formatQuotationDate(null)).toBe('—');
    expect(formatValidity('2026-10-31')).toBe('Valid until Oct 31, 2026');
    expect(formatValidity('2026-10-31', true)).toBe('Expired Oct 31, 2026');
    expect(formatValidity(null)).toBe('No validity date');
  });

  it('formats audit timestamps to the minute', () => {
    expect(formatQuotationDateTime('2026-10-19T08:00:00.000000Z')).toMatch(
      /Oct 19, 2026/,
    );
    expect(formatQuotationDateTime(null)).toBe('—');
  });

  it('sorts newest first without mutating the API array and hides drafts', () => {
    const versions = [
      makeVersion({ id: 1, version: 1, status: 'SUPERSEDED', is_current: false }),
      makeVersion({ id: 3, version: 3, status: 'DRAFT', is_current: false }),
      makeVersion({ id: 2, version: 2, status: 'SENT', is_current: true }),
    ];
    const sorted = sortVersionsNewestFirst(versions);
    expect(sorted.map((version) => version.version)).toEqual([3, 2, 1]);
    expect(versions.map((version) => version.version)).toEqual([1, 3, 2]);

    expect(visibleQuotationVersions(versions).map((version) => version.version)).toEqual([
      2, 1,
    ]);
  });

  it('computes a missing line total from quantity, price, and line discount', () => {
    expect(
      quotationLineTotal({
        product_name_snapshot: 'Chair',
        quantity: 3,
        unit_price: 5000,
        line_discount: 500,
      }),
    ).toBe(14500);

    expect(
      quotationLineTotal({
        product_name_snapshot: 'Chair',
        quantity: 3,
        unit_price: 5000,
        line_discount: 500,
        line_total: 14500,
      }),
    ).toBe(14500);

    // The backend version resource calls the line discount `discount`.
    expect(
      quotationLineTotal({
        product_name_snapshot: 'Chair',
        quantity: 3,
        unit_price: 5000,
        discount: 250,
      }),
    ).toBe(14750);
  });

  it('labels action history and actors', () => {
    expect(quotationActionLabel('VIEWED')).toBe('Viewed by customer');
    expect(quotationActionLabel('REQUESTED_CHANGE')).toBe(
      'Change requested by customer',
    );
    expect(quotationActorLabel('CUSTOMER')).toBe('Customer');
    expect(quotationActorLabel('ADMIN')).toBe('Admin');
    expect(quotationActorLabel(null)).toBeNull();
  });
});

describe('list markers', () => {
  it('surfaces the current version, validity, and action-needed hint', () => {
    const markers = buildQuotationListMarkers({
      current_quotation_id: 7,
      current_version: 2,
      current_status: 'VIEWED',
      valid_until: '2026-10-31',
      is_expired: false,
    });

    expect(markers).toEqual({
      hasCurrentVersion: true,
      currentVersionLabel: 'Version 2',
      currentStatusLabel: 'Viewed',
      validityLabel: 'Valid until Oct 31, 2026',
      actionNeeded: true,
      expired: false,
    });
  });

  it('marks an expired current version without an action-needed hint', () => {
    const markers = buildQuotationListMarkers({
      current_quotation_id: 7,
      current_version: 2,
      current_status: 'SENT',
      valid_until: '2026-10-01',
      is_expired: true,
    });

    expect(markers.actionNeeded).toBe(false);
    expect(markers.expired).toBe(true);
    expect(markers.validityLabel).toBe('Expired Oct 1, 2026');
  });

  it('renders no current-version markers for a request still awaiting a quotation', () => {
    const markers = buildQuotationListMarkers({
      current_quotation_id: null,
      current_version: null,
      current_status: null,
      valid_until: null,
      is_expired: null,
    });

    expect(markers.hasCurrentVersion).toBe(false);
    expect(markers.currentVersionLabel).toBeNull();
    expect(markers.validityLabel).toBeNull();
    expect(markers.actionNeeded).toBe(false);
  });
});
