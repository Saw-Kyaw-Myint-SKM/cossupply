/**
 * Unit tests for the Admin quotation version builder (Task 07): request
 * prefill, state -> API payload conversion, local total preview, validation,
 * and edit prefill from an existing version.
 */
import { describe, expect, it } from 'vitest';
import type {
  AdminQuotationRequest,
  QuotationVersion,
} from '../../api/quotationAdminApi';
import {
  addDaysISODate,
  buildVersionPayload,
  createVersionFormState,
  editVersionFormState,
  localVersionError,
  previewTotals,
} from '../quotationVersionForm';

function request(): AdminQuotationRequest {
  return {
    id: 12,
    quotation_number: 'QR-2026-000012',
    customer_id: 4,
    customer_name: 'Daw Hla',
    company_name: 'Hla Trading',
    phone: '09-770-100-200',
    email: 'hla@example.com',
    city: 'Yangon',
    township: 'Bahan',
    status: 'CONTACTING_SUPPLIER',
    assigned_admin: null,
    required_delivery_date: '2026-11-01',
    created_at: '2026-10-20T10:00:00+00:00',
    updated_at: '2026-10-20T10:00:00+00:00',
    delivery_address: 'No. 40, Cypress Lane, Bahan, Yangon',
    landmark: null,
    customer_note: null,
    items: [
      {
        product_id: 7,
        supplier_id: 2,
        product_name_snapshot: 'Plastic Chair',
        specification_snapshot: 'White, stackable',
        quantity: 3,
        display_price: 42000,
        stock_status: 'IN_STOCK',
        sku: 'CHAIR-001',
        supplier: { id: 2, shop_name: 'Yangon Trading' },
      },
    ],
    suppliers: [],
    communications: [],
    quotations: [],
    current_quotation: null,
  };
}

function version(): QuotationVersion {
  return {
    id: 31,
    quotation_request_id: 12,
    quotation_number: 'QR-2026-000012',
    version: 2,
    status: 'DRAFT',
    is_current: false,
    subtotal: 130000,
    discount: 1000,
    delivery_fee: 2000,
    service_fee_percentage: 5,
    service_fee: 6500,
    total_amount: 137500,
    payment_method: 'CASH_ON_DELIVERY',
    payment_terms: 'Full payment on delivery (COD).',
    valid_until: addDaysISODate(7),
    admin_note: 'Delivery within Yangon.',
    sent_at: null,
    viewed_at: null,
    accepted_at: null,
    rejected_at: null,
    created_at: '2026-10-21T10:00:00+00:00',
    created_by_admin: { id: 1, name: 'Admin' },
    items: [
      {
        id: 99,
        product_id: 7,
        supplier_id: 2,
        product_name_snapshot: 'Plastic Chair',
        sku_snapshot: 'CHAIR-001',
        specification_snapshot: 'White, stackable',
        quantity: 3,
        unit_price: 45000,
        discount: 5000,
        line_total: 130000,
        delivery_date: addDaysISODate(5),
        warranty_note: '6 months',
        supplier_note: 'Confirmed stock',
        supplier: { id: 2, shop_name: 'Yangon Trading' },
      },
    ],
    pdfs: [],
    email_logs: [],
  };
}

describe('createVersionFormState', () => {
  it('prefills request lines, fee default and validity days', () => {
    const state = createVersionFormState(request(), 5, 10);

    expect(state.items).toHaveLength(1);
    expect(state.items[0]).toMatchObject({
      product_id: 7,
      product_name: 'Plastic Chair',
      quantity: '3',
      unit_price: '42000',
      discount: '0',
      supplier_name: 'Yangon Trading',
    });
    expect(state.service_fee_percentage).toBe('5');
    expect(state.valid_until).toBe(addDaysISODate(10));
    expect(state.payment_terms).toBe('Full payment on delivery (COD).');
  });

  it('leaves the unit price blank when the request has no display price', () => {
    const base = request();
    base.items[0].display_price = null;

    expect(createVersionFormState(base, 5, 7).items[0].unit_price).toBe('');
  });
});

describe('buildVersionPayload / previewTotals', () => {
  it('converts state strings into the API contract and trims empty notes', () => {
    const state = createVersionFormState(request(), 5, 7);
    state.items[0] = {
      ...state.items[0],
      quantity: '3',
      unit_price: '45000',
      discount: '5000',
      delivery_date: addDaysISODate(5),
      warranty_note: ' 6 months ',
      supplier_note: '   ',
    };
    state.discount = '1000';
    state.delivery_fee = '2000';
    state.service_fee_percentage = '5';
    state.admin_note = '  ';

    expect(buildVersionPayload(state)).toEqual({
      items: [
        {
          product_id: 7,
          quantity: 3,
          unit_price: 45000,
          discount: 5000,
          delivery_date: addDaysISODate(5),
          warranty_note: '6 months',
          supplier_note: null,
        },
      ],
      discount: 1000,
      delivery_fee: 2000,
      service_fee_percentage: 5,
      payment_terms: 'Full payment on delivery (COD).',
      valid_until: state.valid_until,
      admin_note: null,
    });
  });

  it('mirrors the server formula in the local preview', () => {
    const state = createVersionFormState(request(), 5, 7);
    state.items[0].quantity = '3';
    state.items[0].unit_price = '45000';
    state.items[0].discount = '5000';
    state.discount = '1000';
    state.delivery_fee = '2000';
    state.service_fee_percentage = '5';

    expect(previewTotals(state)).toEqual({
      lineTotals: [130000],
      subtotal: 130000,
      service_fee: 6500,
      total_amount: 137500,
    });
  });
});

describe('localVersionError', () => {
  it('requires a confirmed price on every line', () => {
    const state = createVersionFormState(request(), 5, 7);
    state.items[0].unit_price = '';

    expect(localVersionError(state)).toBe(
      'Enter a confirmed unit price for Plastic Chair.',
    );
  });

  it('rejects a validity date in the past', () => {
    const state = createVersionFormState(request(), 5, 7);
    state.items[0].unit_price = '45000';
    state.valid_until = '2020-01-01';

    expect(localVersionError(state)).toBe('The validity date cannot be in the past.');
  });

  it('accepts a complete draft', () => {
    const state = createVersionFormState(request(), 5, 7);
    state.items[0].unit_price = '45000';

    expect(localVersionError(state)).toBeNull();
  });
});

describe('editVersionFormState', () => {
  it('prefills the saved version including snapshot metadata and notes', () => {
    const state = editVersionFormState(version());

    expect(state).toMatchObject({
      discount: '1000',
      delivery_fee: '2000',
      service_fee_percentage: '5',
      payment_terms: 'Full payment on delivery (COD).',
      admin_note: 'Delivery within Yangon.',
    });
    expect(state.items[0]).toMatchObject({
      product_id: 7,
      product_name: 'Plastic Chair',
      sku: 'CHAIR-001',
      supplier_name: 'Yangon Trading',
      quantity: '3',
      unit_price: '45000',
      discount: '5000',
      warranty_note: '6 months',
      supplier_note: 'Confirmed stock',
    });
  });
});
