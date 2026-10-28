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
  collectCash,
  confirmCashPayment,
  confirmSupplier,
  downloadOrderReceipt,
  getAdminOrder,
  listAdminOrders,
  recordCustomerRefusal,
  updateDeliveryStatus,
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

describe('updateDeliveryStatus', () => {
  it('posts the full-delivery step with trimmed optional fields', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(detailBody('OUT_FOR_DELIVERY')));
    vi.stubGlobal('fetch', fetchMock);

    const response = await updateDeliveryStatus(8, {
      status: 'OUT_FOR_DELIVERY',
      note: '  Handed to Royal Express.  ',
      delivery_partner: ' Royal Express ',
      tracking_number: ' TRK-9012 ',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/admin/orders/8/delivery-status'),
      expect.objectContaining({ method: 'POST' }),
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual({
      status: 'OUT_FOR_DELIVERY',
      note: 'Handed to Royal Express.',
      delivery_partner: 'Royal Express',
      tracking_number: 'TRK-9012',
    });
    expect(response.data?.order.order_status).toBe('OUT_FOR_DELIVERY');
  });

  it('records who received a full delivery', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(detailBody('DELIVERED')));
    vi.stubGlobal('fetch', fetchMock);

    await updateDeliveryStatus(8, {
      status: 'DELIVERED',
      received_by: '  Daw Mya  ',
    });

    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual({
      status: 'DELIVERED',
      received_by: 'Daw Mya',
    });
  });
});

describe('collectCash', () => {
  it('posts the full amount, receiver and receipt number', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(detailBody('DELIVERED')));
    vi.stubGlobal('fetch', fetchMock);

    const response = await collectCash(8, {
      amount_collected: 26750,
      received_by: '  Daw Mya  ',
      receipt_number: ' RCP-2026-000008 ',
      note: '  Counted twice.  ',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/admin/orders/8/cash-collection'),
      expect.objectContaining({ method: 'POST' }),
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual({
      amount_collected: 26750,
      received_by: 'Daw Mya',
      receipt_number: 'RCP-2026-000008',
      note: 'Counted twice.',
    });
    expect(response.success).toBe(true);
  });
});

describe('confirmCashPayment', () => {
  it('posts the optional verification note', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(detailBody('COMPLETED')));
    vi.stubGlobal('fetch', fetchMock);

    const response = await confirmCashPayment(8, '  Counted and verified.  ');

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/admin/orders/8/payment-confirmation'),
      expect.objectContaining({ method: 'POST' }),
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual({
      note: 'Counted and verified.',
    });
    expect(response.data?.order.order_status).toBe('COMPLETED');
  });
});

describe('recordCustomerRefusal', () => {
  it('posts the delivery outcome, responsible person and note', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(detailBody('DELIVERY_FAILED')));
    vi.stubGlobal('fetch', fetchMock);

    const response = await recordCustomerRefusal(8, {
      delivery_outcome: 'DELIVERY_FAILED',
      responsible_person: '  Ko Aung  ',
      note: '  Customer refused to pay the full amount.  ',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/admin/orders/8/customer-refused-payment'),
      expect.objectContaining({ method: 'POST' }),
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual({
      delivery_outcome: 'DELIVERY_FAILED',
      responsible_person: 'Ko Aung',
      note: 'Customer refused to pay the full amount.',
    });
    expect(response.data?.order.order_status).toBe('DELIVERY_FAILED');
  });
});

describe('downloadOrderReceipt', () => {
  it('fetches the private receipt as an authenticated blob', async () => {
    const blob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
    const headers = new Headers({
      'Content-Disposition': 'attachment; filename="RCP-2026-000008.pdf"',
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers,
      blob: async () => blob,
      json: async () => ({}),
    } as unknown as Response);
    vi.stubGlobal('fetch', fetchMock);

    const response = await downloadOrderReceipt(8);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/admin/orders/8/receipt/download'),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer admin-token' }),
      }),
    );
    expect(response.success).toBe(true);
    expect(response.data?.fileName).toBe('RCP-2026-000008.pdf');
    expect(response.data?.blob).toBe(blob);
  });
});
