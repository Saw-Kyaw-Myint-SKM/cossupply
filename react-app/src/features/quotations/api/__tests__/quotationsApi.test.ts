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
  createQuotationRequest,
  listQuotationRequests,
  type QuotationRequest,
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
