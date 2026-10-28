/**
 * Unit tests for the admin order workflow API module (Task 09): list filters,
 * detail, supplier confirmation and cancellation payloads.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

function stubStorage() {
  vi.stubGlobal('localStorage', {
    getItem: () => 'admin-token',
    setItem: () => undefined,
    removeItem: () => undefined,
  });
}

import {
  cancelOrder,
  confirmSupplier,
  getAdminOrder,
  listAdminOrders,
} from '../orderAdminApi';

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
  company_name: null,
  phone: '09-770-100-200',
  email: null,
  delivery_address: 'No. 12, Merchant St',
  city: 'Yangon',
  township: 'Bahan',
  landmark: null,
  subtotal: 25000,
  discount: 0,
  delivery_fee: 500,
  service_fee_percentage: 5,
  service_fee: 1250,
  total_amount: 26750,
  payment_method: 'CASH_ON_DELIVERY',
  payment_status: 'NOT_PAID',
  order_status: 'SUPPLIER_CONFIRMATION_REQUIRED',
  delivery_status: 'NOT_ASSIGNED',
  customer_note: null,
  item_count: 1,
  created_at: '2026-10-23T09:00:00+00:00',
  updated_at: '2026-10-23T09:00:00+00:00',
};

function detailBody(orderStatus = 'SUPPLIER_CONFIRMATION_REQUIRED') {
  return {
    success: true,
    data: {
      order: {
        ...sampleOrder,
        order_status: orderStatus,
        items: [],
        delivery: null,
        cash_payment: null,
        status_histories: [],
        quotation: {
          id: 77,
          quotation_number: 'QT-2026-0042',
          version: 2,
          status: 'ACCEPTED',
          accepted_at: '2026-10-23T09:00:00+00:00',
          valid_until: '2026-10-30',
        },
        suppliers: [],
      },
    },
  };
}

beforeEach(() => {
  vi.unstubAllGlobals();
  stubStorage();
});

describe('listAdminOrders', () => {
  it('sends every filter and unwraps the admin envelope', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          orders: [sampleOrder],
          meta: { current_page: 1, per_page: 15, total: 1, last_page: 1 },
          statuses: ['SUPPLIER_CONFIRMATION_REQUIRED'],
          payment_statuses: ['NOT_PAID'],
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await listAdminOrders({
      page: 1,
      per_page: 15,
      status: 'SUPPLIER_CONFIRMATION_REQUIRED',
      payment_status: 'NOT_PAID',
      search: 'ORD-2026',
    });

    expect(fetchMock.mock.calls[0][0]).toContain(
      '/admin/orders?page=1&per_page=15&status=SUPPLIER_CONFIRMATION_REQUIRED&payment_status=NOT_PAID&search=ORD-2026',
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer admin-token' }),
      }),
    );
    expect(response.data?.meta.total).toBe(1);
    expect(response.data?.payment_statuses).toContain('NOT_PAID');
  });
});

describe('getAdminOrder', () => {
  it('returns the supplier groups needed for Viber confirmation', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          order: {
            ...detailBody().data.order,
            suppliers: [
              {
                supplier: {
                  id: 3,
                  shop_name: 'Yangon Office Supply',
                  contact_person: 'Ko Aung',
                  phone: '09-111',
                  viber_phone: '09-222',
                  email: null,
                  delivery_time: '2 days',
                  warranty_policy: 'One year',
                },
                items: [],
              },
            ],
          },
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await getAdminOrder(8);

    expect(fetchMock.mock.calls[0][0]).toContain('/admin/orders/8');
    expect(response.data?.order.suppliers[0].supplier.viber_phone).toBe('09-222');
  });
});

describe('confirmSupplier', () => {
  it('posts CONFIRMED with the trimmed note and returns the refreshed order', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(detailBody('PREPARING')));
    vi.stubGlobal('fetch', fetchMock);

    const response = await confirmSupplier(8, 'CONFIRMED', '  confirmed over Viber  ');

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/admin/orders/8/supplier-confirmation'),
      expect.objectContaining({ method: 'POST' }),
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual({
      result: 'CONFIRMED',
      note: 'confirmed over Viber',
    });
    expect(response.data?.order.order_status).toBe('PREPARING');
  });

  it('omits a blank optional note', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(detailBody('ORDER_CONFIRMED')));
    vi.stubGlobal('fetch', fetchMock);

    await confirmSupplier(8, 'CONFIRMED', '   ');

    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual({ result: 'CONFIRMED' });
  });

  it('sends UNAVAILABLE with the mandatory note', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(detailBody('SUPPLIER_UNAVAILABLE')));
    vi.stubGlobal('fetch', fetchMock);

    await confirmSupplier(8, 'UNAVAILABLE', 'No stock this month.');

    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual({
      result: 'UNAVAILABLE',
      note: 'No stock this month.',
    });
  });

  it('surfaces the server validation error for a completed order', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          success: false,
          message: 'Only an order waiting for supplier confirmation can be confirmed.',
          errors: { order: ['Only an order waiting for supplier confirmation can be confirmed.'] },
        },
        422,
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await confirmSupplier(8, 'CONFIRMED');

    expect(response.success).toBe(false);
    expect(response.status).toBe(422);
    expect(response.errors?.order?.[0]).toContain('waiting for supplier confirmation');
  });
});

describe('cancelOrder', () => {
  it('posts the trimmed cancellation reason', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(detailBody('CANCELLED')));
    vi.stubGlobal('fetch', fetchMock);

    const response = await cancelOrder(8, '  Customer requested cancellation.  ');

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/admin/orders/8/cancel'),
      expect.objectContaining({ method: 'POST' }),
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual({
      note: 'Customer requested cancellation.',
    });
    expect(response.data?.order.order_status).toBe('CANCELLED');
  });
});
