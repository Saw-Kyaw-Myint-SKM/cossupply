/**
 * Unit tests for the notification API module (Task 11): polling cadence,
 * list filters, read actions and role-aware links.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

function stubStorage() {
  vi.stubGlobal('localStorage', {
    getItem: () => 'customer-token',
    setItem: () => undefined,
    removeItem: () => undefined,
  });
}

import {
  NOTIFICATION_POLL_MS,
  getNotificationUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  notificationHref,
  type AppNotification,
} from '../notificationsApi';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

const sampleNotification: AppNotification = {
  id: 12,
  type: 'ORDER_OUT_FOR_DELIVERY',
  title: 'Order out for delivery',
  message: 'Order ORD-2026-000008 is on its way.',
  data: { order_id: 8, quotation_request_id: 42 },
  quotation_id: null,
  order_id: 8,
  is_read: false,
  read_at: null,
  created_at: '2026-10-28T09:00:00+00:00',
};

beforeEach(() => {
  vi.unstubAllGlobals();
  stubStorage();
});

describe('notification polling', () => {
  it('uses the documented 60-second cadence', () => {
    expect(NOTIFICATION_POLL_MS).toBe(60_000);
  });
});

describe('listNotifications', () => {
  it('sends pagination and the unread filter with the bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          notifications: [sampleNotification],
          unread_count: 3,
          meta: { current_page: 2, per_page: 5, total: 6, last_page: 2 },
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await listNotifications({ page: 2, per_page: 5, unread: true });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/notifications?page=2&per_page=5&unread=1'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer customer-token',
        }),
      }),
    );
    expect(response.data?.unread_count).toBe(3);
    expect(response.data?.notifications[0].title).toBe('Order out for delivery');
  });
});

describe('read actions', () => {
  it('marks one notification read with PATCH', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: { notification: { ...sampleNotification, is_read: true }, unread_count: 2 },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await markNotificationRead(12);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/notifications/12/read'),
      expect.objectContaining({ method: 'PATCH' }),
    );
    expect(response.data?.unread_count).toBe(2);
  });

  it('marks all notifications read with POST', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ success: true, data: { marked: 3, unread_count: 0 } }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await markAllNotificationsRead();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/notifications/read-all'),
      expect.objectContaining({ method: 'POST' }),
    );
    expect(response.data?.marked).toBe(3);
  });

  it('reads the unread count separately', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ success: true, data: { unread_count: 4 } }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await getNotificationUnreadCount();

    expect(response.data?.unread_count).toBe(4);
  });
});

describe('notificationHref', () => {
  it('routes customers to their order page', () => {
    expect(notificationHref(sampleNotification, 'customer')).toBe('/orders/8');
  });

  it('routes admins to the admin order page', () => {
    expect(notificationHref(sampleNotification, 'admin')).toBe('/admin/orders/8');
  });

  it('falls back to the quotation request when there is no order', () => {
    const quotationNotification: AppNotification = {
      ...sampleNotification,
      order_id: null,
      data: { quotation_request_id: 42 },
    };

    expect(notificationHref(quotationNotification, 'customer')).toBe('/quotations/42');
    expect(notificationHref(quotationNotification, 'admin')).toBe(
      '/admin/quotation-requests/42',
    );
  });

  it('returns null when there is nothing to open', () => {
    expect(notificationHref({ ...sampleNotification, order_id: null, data: null }, 'customer')).toBeNull();
  });
});
