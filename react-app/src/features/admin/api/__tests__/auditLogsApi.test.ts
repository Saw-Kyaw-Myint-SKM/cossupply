/**
 * Unit tests for the admin audit trail API (Task 12).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

function stubStorage() {
  vi.stubGlobal('localStorage', {
    getItem: () => 'admin-token',
    setItem: () => undefined,
    removeItem: () => undefined,
  });
}

import { changedFields, listAuditLogs, type AuditLogEntry } from '../auditLogsApi';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

const sampleEntry: AuditLogEntry = {
  id: 9,
  action: 'setting.updated',
  entity_type: 'setting',
  entity_id: '7',
  old_data: { key: 'quotation_validity_days', value: 7 },
  new_data: { key: 'quotation_validity_days', value: 14 },
  ip_address: '127.0.0.1',
  created_at: '2026-10-29T09:00:00+00:00',
  admin: { id: 1, name: 'Admin', email: 'admin@example.com' },
};

beforeEach(() => {
  vi.unstubAllGlobals();
  stubStorage();
});

describe('listAuditLogs', () => {
  it('sends every filter and pagination parameter', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          audit_logs: [sampleEntry],
          meta: { current_page: 1, per_page: 20, total: 1, last_page: 1 },
          actions: ['setting.updated'],
          entity_types: ['setting'],
          admins: [{ id: 1, name: 'Admin', email: 'admin@example.com' }],
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await listAuditLogs({
      page: 2,
      per_page: 20,
      action: 'setting.updated',
      entity_type: 'setting',
      admin_id: 1,
      search: 'validity',
      from: '2026-10-01',
      to: '2026-10-31',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(
        '/admin/audit-logs?page=2&per_page=20&action=setting.updated&entity_type=setting&admin_id=1&search=validity&from=2026-10-01&to=2026-10-31',
      ),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer admin-token' }),
      }),
    );
    expect(response.data?.audit_logs[0].new_data).toEqual({
      key: 'quotation_validity_days',
      value: 14,
    });
    expect(response.data?.actions).toEqual(['setting.updated']);
  });

  it('omits empty filters from the query string', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          audit_logs: [],
          meta: { current_page: 1, per_page: 20, total: 0, last_page: 1 },
          actions: [],
          entity_types: [],
          admins: [],
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await listAuditLogs({ page: 1, per_page: 20, action: '', admin_id: '', search: '' });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/admin/audit-logs?page=1&per_page=20'),
      expect.anything(),
    );
  });
});

describe('changedFields', () => {
  it('returns only keys whose value differs', () => {
    expect(changedFields(sampleEntry)).toEqual(['value']);
  });

  it('handles null snapshots and added or removed keys', () => {
    const added = changedFields({
      ...sampleEntry,
      old_data: null,
      new_data: { status: 'PUBLISHED' },
    });

    const removed = changedFields({
      ...sampleEntry,
      old_data: { status: 'DRAFT' },
      new_data: null,
    });

    expect(added).toEqual(['status']);
    expect(removed).toEqual(['status']);
  });
});
