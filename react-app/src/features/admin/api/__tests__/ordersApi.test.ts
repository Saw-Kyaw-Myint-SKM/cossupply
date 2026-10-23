/**
 * Unit tests for the Admin order API module (Task 09), using a stubbed global
 * fetch and the project's node test environment (no DOM).
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
  getAdminOrder,
  listAdminOrders,
  updateAdminOrderStatus,
} from '../ordersApi';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

beforeEach(() => {
  stubStorage();
});

describe('listAdminOrders', () => {
  it('sends status, search, and pagination, then unwraps orders and meta', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          orders: [
            {
              id: 77,
              order_number: 'ORD-2026-0001',
              quotation_number: 'QT-2026-0042',
              customer_name: 'Daw Hla',
              phone: '09-770-100-200',
              order_status: 'SUPPLIER_CONFIRMATION_REQUIRED',
              payment_status: 'NOT_PAID',
              delivery_status: 'NOT_ASSIGNED',
              total_amount: 137500,
              created_at: '2026-10-24T08:00:00.000000Z',
            },
          ],
          meta: { current_page: 2, per_page: 15, total: 16, last_page: 2 },
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await listAdminOrders({
      order_status: 'SUPPLIER_CONFIRMATION_REQUIRED',
      search: 'ORD-2026-0001',
      page: 2,
      per_page: 15,
    });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain(
      '/admin/orders?order_status=SUPPLIER_CONFIRMATION_REQUIRED&search=ORD-2026-0001&page=2&per_page=15',
    );
    expect(options.headers).toEqual(
      expect.objectContaining({ Authorization: 'Bearer admin-token' }),
    );
    expect(options.method).toBeUndefined();
    expect(response.success).toBe(true);
    expect(response.data?.orders[0].order_number).toBe('ORD-2026-0001');
    expect(response.data?.meta.total).toBe(16);
  });

  it('omits empty filters from the query string', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: { orders: [], meta: { current_page: 1, per_page: 15, total: 0, last_page: 1 } },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await listAdminOrders({ order_status: '', search: '', page: 1, per_page: 15 });

    expect(fetchMock.mock.calls[0][0]).toContain('/admin/orders?page=1&per_page=15');
  });
});

describe('getAdminOrder', () => {
  it('GETs the detail without a mutation', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          order: {
            id: 77,
            order_number: 'ORD-2026-0001',
            order_status: 'SUPPLIER_CONFIRMATION_REQUIRED',
            available_statuses: ['ORDER_CONFIRMED', 'SUPPLIER_UNAVAILABLE', 'CANCELLED'],
          },
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await getAdminOrder(77);

    expect(fetchMock.mock.calls[0][0]).toContain('/admin/orders/77');
    expect(fetchMock.mock.calls[0][1].method).toBeUndefined();
    expect(response.success).toBe(true);
    expect(response.data?.order.available_statuses).toEqual([
      'ORDER_CONFIRMED',
      'SUPPLIER_UNAVAILABLE',
      'CANCELLED',
    ]);
  });

  it('propagates 404 for an unknown order', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ success: false, message: 'Not found.' }, 404)),
    );

    const response = await getAdminOrder(999);

    expect(response.success).toBe(false);
    expect(response.status).toBe(404);
    expect(response.message).toBe('Not found.');
  });
});

describe('updateAdminOrderStatus', () => {
  it('PATCHes the status with a trimmed reason', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ success: true, data: { order: { id: 77 } } }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await updateAdminOrderStatus(77, {
      status: 'CANCELLED',
      note: '  Supplier closed this month  ',
    });

    expect(fetchMock.mock.calls[0][0]).toContain('/admin/orders/77/status');
    expect(fetchMock.mock.calls[0][1].method).toBe('PATCH');
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual({
      status: 'CANCELLED',
      note: 'Supplier closed this month',
    });
    expect(response.success).toBe(true);
  });

  it('omits a blank optional note', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ success: true, data: { order: { id: 77 } } }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await updateAdminOrderStatus(77, { status: 'ORDER_CONFIRMED', note: '   ' });

    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual({
      status: 'ORDER_CONFIRMED',
    });
  });

  it('surfaces 409 when the order moved first', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            success: false,
            message: 'This order can no longer move to that status.',
          },
          409,
        ),
      ),
    );

    const response = await updateAdminOrderStatus(77, { status: 'PREPARING' });

    expect(response.success).toBe(false);
    expect(response.status).toBe(409);
    expect(response.message).toBe('This order can no longer move to that status.');
  });

  it('surfaces 422 field errors for a missing or invalid reason', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            success: false,
            message: 'The given data was invalid.',
            errors: { note: ['The note field is required when status is cancelled.'] },
          },
          422,
        ),
      ),
    );

    const response = await updateAdminOrderStatus(77, { status: 'CANCELLED' });

    expect(response.success).toBe(false);
    expect(response.status).toBe(422);
    expect(response.errors?.note).toEqual([
      'The note field is required when status is cancelled.',
    ]);
  });

  it('reports a network failure without a status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));

    const response = await updateAdminOrderStatus(77, { status: 'PREPARING' });

    expect(response.success).toBe(false);
    expect(response.status).toBeUndefined();
    expect(response.message).toBe('ECONNREFUSED');
  });
});
