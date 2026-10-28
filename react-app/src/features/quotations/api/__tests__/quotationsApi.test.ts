/**
 * Unit tests for the customer quotation-request API module (Task 06),
 * mirroring the style of src/lib/__tests__/cart-storage.test.ts: pure vitest
 * with a stubbed global fetch, no component rendering.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// node env has no localStorage; client.ts reads the bearer token from it.
function stubStorage() {
  vi.stubGlobal('localStorage', {
    getItem: () => 'customer-token',
    setItem: () => undefined,
    removeItem: () => undefined,
  });
}

import {
  acceptQuotation,
  createQuotationRequest,
  getQuotationRequest,
  listQuotationRequests,
  rejectQuotation,
  requestQuotationChange,
  type CustomerQuotationDetail,
  type QuotationDecisionResult,
  type QuotationRequest,
  type QuotationVersion,
} from '../quotationsApi';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

const sampleRequest: QuotationRequest = {
  id: 42,
  quotation_number: 'QT-2026-0042',
  status: 'NEW',
  customer_name: 'Daw Hla',
  phone: '09-770-100-200',
  city: 'Yangon',
  township: 'Bahan',
  delivery_address: 'No. 12, Merchant St, Bahan, Yangon',
  items: [
    {
      product_id: 1,
      product_name_snapshot: 'Plastic Chair',
      specification_snapshot: null,
      quantity: 5,
      display_price: 5000,
      stock_status: 'IN_STOCK',
    },
  ],
};

beforeEach(() => {
  stubStorage();
});

describe('listQuotationRequests', () => {
  it('hits the list endpoint with pagination and unwraps the envelope', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          quotation_requests: [
            {
              id: 42,
              quotation_number: 'QT-2026-0042',
              status: 'NEW',
              customer_name: 'Daw Hla',
              phone: '09-770-100-200',
              city: 'Yangon',
              township: 'Bahan',
              item_count: 3,
              current_quotation: {
                id: 77,
                version: 2,
                status: 'VIEWED',
                is_current: true,
                total_amount: 25750,
                valid_until: '2026-10-30',
                sent_at: '2026-10-23T08:00:00+00:00',
                viewed_at: '2026-10-23T09:00:00+00:00',
                accepted_at: null,
                rejected_at: null,
                created_at: '2026-10-23T07:59:00+00:00',
              },
              created_at: '2026-10-19T08:00:00.000000Z',
            },
          ],
          meta: { current_page: 1, per_page: 10, total: 1, last_page: 1 },
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await listQuotationRequests({ page: 2, per_page: 10 });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/customer/quotation-requests?page=2&per_page=10'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: 'application/json',
          Authorization: 'Bearer customer-token',
        }),
      }),
    );
    expect(response.success).toBe(true);
    expect(response.data?.quotation_requests[0].quotation_number).toBe('QT-2026-0042');
    expect(response.data?.quotation_requests[0].current_quotation?.total_amount).toBe(25750);
    expect(response.data?.meta.total).toBe(1);
  });
});

describe('createQuotationRequest', () => {
  it('POSTs the item list and contact/delivery snapshot fields, and returns the request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          success: true,
          data: { quotation_request: sampleRequest },
          message: 'Quotation request created',
        },
        201,
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await createQuotationRequest({
      items: [
        { product_id: 1, quantity: 5 },
        { product_id: 2, quantity: 2 },
      ],
      name: 'Daw Hla',
      phone: '09-770-100-200',
      city: 'Yangon',
      township: 'Bahan',
      delivery_address: 'No. 12, Merchant St, Bahan, Yangon',
      required_delivery_date: '2026-10-25',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/customer/quotation-requests'),
      expect.objectContaining({ method: 'POST' }),
    );

    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(body).toEqual({
      items: [
        { product_id: 1, quantity: 5 },
        { product_id: 2, quantity: 2 },
      ],
      name: 'Daw Hla',
      phone: '09-770-100-200',
      city: 'Yangon',
      township: 'Bahan',
      delivery_address: 'No. 12, Merchant St, Bahan, Yangon',
      required_delivery_date: '2026-10-25',
    });

    expect(response.success).toBe(true);
    expect(response.data?.quotation_request.quotation_number).toBe('QT-2026-0042');
    expect(response.data?.quotation_request.items[0].product_name_snapshot).toBe('Plastic Chair');
    expect(response.data?.quotation_request.items[0].display_price).toBe(5000);
  });

  it('surfaces 422 validation errors keyed with Laravel keys like items.1.quantity', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          success: false,
          message: 'The given data was invalid.',
          errors: {
            'items.0.product_id': ['The selected product is invalid.'],
            'items.1.quantity': ['The quantity must be at least 2.'],
            city: ['The city field is required.'],
          },
        },
        422,
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await createQuotationRequest({
      items: [{ product_id: 999, quantity: 0 }],
      name: '',
      phone: '',
      city: '',
      delivery_address: '',
    });

    expect(response.success).toBe(false);
    expect(response.status).toBe(422);
    expect(response.errors?.['items.1.quantity']).toEqual(['The quantity must be at least 2.']);
    expect(response.errors?.city).toEqual(['The city field is required.']);
    expect(response.message).toBe('The given data was invalid.');
  });

  it('surfaces 401 for expired sessions so the caller can redirect to login', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ success: false, message: 'Unauthenticated.' }, 401),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await createQuotationRequest({
      items: [{ product_id: 1, quantity: 1 }],
      name: 'A',
      phone: '1',
      city: 'X',
      delivery_address: 'Y',
    });

    expect(response.success).toBe(false);
    expect(response.status).toBe(401);
    expect(response.message).toBe('Unauthenticated.');
  });

  it('reports a network failure without a status', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    vi.stubGlobal('fetch', fetchMock);

    const response = await createQuotationRequest({
      items: [{ product_id: 1, quantity: 1 }],
      name: 'A',
      phone: '1',
      city: 'X',
      delivery_address: 'Y',
    });

    expect(response.success).toBe(false);
    expect(response.status).toBeUndefined();
    expect(response.message).toBe('ECONNREFUSED');
  });
});

const sampleVersion: QuotationVersion = {
  id: 77,
  quotation_request_id: 42,
  quotation_number: 'QT-2026-0042',
  version: 2,
  status: 'VIEWED',
  is_current: true,
  subtotal: 25000,
  discount: 1000,
  delivery_fee: 500,
  service_fee_percentage: 5,
  service_fee: 1250,
  total_amount: 25750,
  payment_method: 'CASH_ON_DELIVERY',
  payment_terms: 'Full payment on delivery (COD).',
  valid_until: '2026-10-30',
  admin_note: 'Supplier confirms delivery within five days.',
  sent_at: '2026-10-23T08:00:00+00:00',
  viewed_at: '2026-10-23T09:00:00+00:00',
  accepted_at: null,
  rejected_at: null,
  created_at: '2026-10-23T07:59:00+00:00',
  items: [
    {
      id: 1,
      product_id: 1,
      supplier_id: 3,
      product_name_snapshot: 'Plastic Chair',
      sku_snapshot: 'SKU-0001-AA',
      specification_snapshot: 'Stackable, blue',
      quantity: 5,
      unit_price: 5000,
      discount: 0,
      line_total: 25000,
      delivery_date: '2026-10-29',
      warranty_note: 'One year',
      supplier_note: null,
      supplier: { id: 3, shop_name: 'Yangon Office Supply' },
    },
  ],
};

const sampleDetail: CustomerQuotationDetail = {
  ...sampleRequest,
  company_name: 'Daw Hla Trading',
  email: 'daw.hla@example.com',
  landmark: 'Near Bogyoke Market',
  required_delivery_date: '2026-10-29',
  customer_note: 'Please deliver in the morning.',
  created_at: '2026-10-19T08:00:00.000000Z',
  current_quotation: sampleVersion,
  quotation_history: [sampleVersion],
  actions: [
    {
      id: 1,
      action: 'VIEWED',
      customer_note: null,
      created_at: '2026-10-23T09:00:00+00:00',
    },
  ],
  can_accept: true,
  can_reject: true,
  can_request_change: true,
  is_expired: false,
};

const sampleDecision: QuotationDecisionResult = {
  quotation: { ...sampleVersion, status: 'ACCEPTED' },
  quotation_request: { id: 42, status: 'ACCEPTED' },
};

describe('getQuotationRequest', () => {
  it('loads the current quotation, history and decision flags', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ success: true, data: { quotation_request: sampleDetail } }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await getQuotationRequest(42);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/customer/quotation-requests/42'),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer customer-token' }),
      }),
    );
    expect(response.success).toBe(true);
    expect(response.data?.quotation_request.current_quotation?.total_amount).toBe(25750);
    expect(response.data?.quotation_request.current_quotation?.items[0].line_total).toBe(25000);
    expect(response.data?.quotation_request.can_accept).toBe(true);
    expect(response.data?.quotation_request.quotation_history[0].status).toBe('VIEWED');
  });

  it('surfaces 404 when the quotation belongs to another customer', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({ success: false, message: 'Quotation request not found.' }, 404),
      ),
    );

    const response = await getQuotationRequest(999);

    expect(response.success).toBe(false);
    expect(response.status).toBe(404);
    expect(response.message).toBe('Quotation request not found.');
  });
});

describe('quotation decisions', () => {
  it('accepts the current quotation with an empty POST', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ success: true, data: sampleDecision }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await acceptQuotation(77);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/customer/quotations/77/accept'),
      expect.objectContaining({ method: 'POST' }),
    );
    expect(response.success).toBe(true);
    expect(response.data?.quotation_request.status).toBe('ACCEPTED');
  });

  it('rejects with a trimmed optional note', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          ...sampleDecision,
          quotation: { ...sampleDecision.quotation, status: 'REJECTED' },
          quotation_request: { id: 42, status: 'REJECTED' },
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await rejectQuotation(77, '  Over budget.  ');

    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(body).toEqual({ customer_note: 'Over budget.' });
  });

  it('sends the mandatory change note', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          ...sampleDecision,
          quotation: { ...sampleDecision.quotation, status: 'CHANGE_REQUESTED' },
          quotation_request: { id: 42, status: 'CHANGE_REQUESTED' },
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await requestQuotationChange(77, 'Please reduce the delivery fee.');

    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(body).toEqual({ customer_note: 'Please reduce the delivery fee.' });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/customer/quotations/77/request-change'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('surfaces an expired-quotation 422 so the panel can explain it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            message: 'This quotation expired on 2026-10-20 and can no longer be accepted.',
            errors: {
              quotation: ['This quotation expired on 2026-10-20 and can no longer be accepted.'],
            },
          },
          422,
        ),
      ),
    );

    const response = await acceptQuotation(77);

    expect(response.success).toBe(false);
    expect(response.status).toBe(422);
    expect(response.errors?.quotation?.[0]).toContain('expired');
  });
});
