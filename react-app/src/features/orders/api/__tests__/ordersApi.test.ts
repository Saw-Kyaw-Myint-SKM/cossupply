/**
 * Unit tests for the customer order API module (Task 09). Mirrors the
 * fetch-stubbed style used by the quotation API tests.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

function stubStorage() {
  vi.stubGlobal('localStorage', {
    getItem: () => 'customer-token',
    setItem: () => undefined,
    removeItem: () => undefined,
  });
}

import { getOrder, listOrders, ORDER_STATUSES, PAYMENT_STATUSES } from '../ordersApi';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

const sampleOrder = {
  id: 8,
  order_number: 'ORD-2026-000008',
  quotation_id: 77,
  quotation_request_id: 42,
  customer_id: 3,
  customer_name: 'Daw Hla',
  company_name: 'Hla Trading',
  phone: '09-770-100-200',
  email: 'daw.hla@example.com',
  delivery_address: 'No. 12, Merchant St',
  city: 'Yangon',
  township: 'Bahan',
  landmark: null,
  subtotal: 25000,
  discount: 1000,
  delivery_fee: 500,
  service_fee_percentage: 5,
  service_fee: 1250,
  total_amount: 25750,
  payment_method: 'CASH_ON_DELIVERY',
  payment_status: 'NOT_PAID',
  order_status: 'SUPPLIER_CONFIRMATION_REQUIRED',
  delivery_status: 'NOT_ASSIGNED',
  customer_note: null,
  item_count: 1,
  created_at: '2026-10-23T09:00:00+00:00',
  updated_at: '2026-10-23T09:00:00+00:00',
};

beforeEach(() => {
  stubStorage();
  vi.unstubAllGlobals();
  stubStorage();
});

describe('listOrders', () => {
  it('sends pagination and status filters and unwraps the envelope', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          orders: [sampleOrder],
          meta: { current_page: 2, per_page: 10, total: 11, last_page: 2 },
          statuses: ORDER_STATUSES,
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await listOrders({
      page: 2,
      per_page: 10,
      status: 'SUPPLIER_CONFIRMATION_REQUIRED',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(
        '/customer/orders?page=2&per_page=10&status=SUPPLIER_CONFIRMATION_REQUIRED',
      ),
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: 'application/json',
          Authorization: 'Bearer customer-token',
        }),
      }),
    );
    expect(response.success).toBe(true);
    expect(response.data?.orders[0].order_number).toBe('ORD-2026-000008');
    expect(response.data?.orders[0].total_amount).toBe(25750);
    expect(response.data?.meta.total).toBe(11);
  });

  it('omits an empty status filter from the query string', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: { orders: [], meta: { current_page: 1, per_page: 10, total: 0, last_page: 1 } },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await listOrders({ page: 1, per_page: 10, status: '' });

    expect(fetchMock.mock.calls[0][0]).toContain('/customer/orders?page=1&per_page=10');
    expect(fetchMock.mock.calls[0][0]).not.toContain('status=');
  });
});

describe('getOrder', () => {
  it('returns the full order detail from the scoped endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          order: {
            ...sampleOrder,
            items: [
              {
                id: 1,
                product_id: 5,
                supplier_id: 3,
                product_name_snapshot: 'Plastic Chair',
                sku_snapshot: 'SKU-1',
                specification_snapshot: 'Blue',
                quantity: 5,
                unit_price: 5000,
                discount: 0,
                line_total: 25000,
                supplier: { id: 3, shop_name: 'Yangon Office Supply' },
              },
            ],
            delivery: null,
            cash_payment: {
              id: 4,
              delivery_id: null,
              receipt_number: 'RCP-2026-000008',
              amount_due: 25750,
              amount_collected: 0,
              amount_remaining: 25750,
              received_by: null,
              collected_at: null,
              customer_name: 'Daw Hla',
              note: null,
              status: 'NOT_PAID',
            },
            status_histories: [],
            quotation: null,
            suppliers: [],
          },
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await getOrder(8);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/customer/orders/8'),
      expect.any(Object),
    );
    expect(response.success).toBe(true);
    expect(response.data?.order.items[0].product_name_snapshot).toBe('Plastic Chair');
    expect(response.data?.order.cash_payment?.amount_remaining).toBe(25750);
    expect(response.data?.order.suppliers).toEqual([]);
  });

  it('surfaces 404 for another customer order without leaking details', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ success: false, message: 'Order not found.' }, 404),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await getOrder(999);

    expect(response.success).toBe(false);
    expect(response.status).toBe(404);
    expect(response.message).toBe('Order not found.');
  });
});

describe('order vocabulary', () => {
  it('keeps the status lists aligned with the server enums', () => {
    expect(ORDER_STATUSES).toContain('SUPPLIER_CONFIRMATION_REQUIRED');
    expect(ORDER_STATUSES).toContain('SUPPLIER_UNAVAILABLE');
    expect(ORDER_STATUSES).toContain('CANCELLED');
    expect(PAYMENT_STATUSES).toContain('NOT_PAID');
    expect(PAYMENT_STATUSES).toContain('PAYMENT_CONFIRMED');
  });
});
