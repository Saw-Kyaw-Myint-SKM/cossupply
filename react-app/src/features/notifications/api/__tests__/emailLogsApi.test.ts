/**
 * Unit tests for the admin email log API (Task 11).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

function stubStorage() {
  vi.stubGlobal('localStorage', {
    getItem: () => 'admin-token',
    setItem: () => undefined,
    removeItem: () => undefined,
  });
}

import { listEmailLogs, resendEmailLog } from '../emailLogsApi';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

const sampleLog = {
  id: 5,
  recipient_email: 'buyer@example.com',
  related_type: 'App\\Models\\Order',
  related_id: 8,
  email_type: 'ORDER_CONFIRMED',
  subject: 'Order ORD-2026-000008 confirmed',
  status: 'FAILED',
  sent_at: null,
  error_message: 'Connection refused',
  resendable: true,
  created_at: '2026-10-28T09:00:00+00:00',
};

beforeEach(() => {
  vi.unstubAllGlobals();
  stubStorage();
});

describe('listEmailLogs', () => {
  it('sends status, search and pagination filters', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          email_logs: [sampleLog],
          meta: { current_page: 1, per_page: 15, total: 1, last_page: 1 },
          statuses: ['SENT', 'FAILED'],
          email_types: ['ORDER_CONFIRMED'],
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await listEmailLogs({
      page: 1,
      per_page: 15,
      status: 'FAILED',
      search: 'buyer',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/admin/email-logs?page=1&per_page=15&status=FAILED&search=buyer'),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer admin-token' }),
      }),
    );
    expect(response.data?.email_logs[0].error_message).toBe('Connection refused');
  });
});

describe('resendEmailLog', () => {
  it('posts to the resend endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: { email: { ...sampleLog, id: 6, status: 'SENT', sent_at: '2026-10-28T10:00:00+00:00' } },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await resendEmailLog(5);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/admin/email-logs/5/resend'),
      expect.objectContaining({ method: 'POST' }),
    );
    expect(response.data?.email.status).toBe('SENT');
    expect(response.data?.email.id).toBe(6);
  });
});
