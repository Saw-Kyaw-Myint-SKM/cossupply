/**
 * Unit tests for the admin user management API.
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
  createAdminUser,
  deleteAdminUser,
  listAdminUsers,
  resetAdminUserPassword,
  updateAdminUser,
} from '../adminUsersApi';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

const sampleAdminUser = {
  id: 7,
  name: 'Aye Chan',
  email: 'aye@example.com',
  phone: '09123456789',
  role: 'super_admin',
  status: 'active',
  last_login_at: '2026-11-01T08:00:00+00:00',
  created_at: '2026-10-01T08:00:00+00:00',
  updated_at: '2026-11-01T08:00:00+00:00',
};

beforeEach(() => {
  vi.unstubAllGlobals();
  stubStorage();
});

describe('listAdminUsers', () => {
  it('sends search, role, status and pagination filters', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          admin_users: [sampleAdminUser],
          meta: { current_page: 2, per_page: 15, total: 16, last_page: 2 },
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await listAdminUsers({
      page: 2,
      per_page: 15,
      search: 'Aye',
      role: 'super_admin',
      status: 'active',
      sort_by: 'created_at',
      sort_direction: 'desc',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(
        '/admin/admin-users?page=2&per_page=15&search=Aye&role=super_admin&status=active&sort_by=created_at&sort_direction=desc',
      ),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer admin-token' }),
      }),
    );
    expect(response.data?.admin_users[0].role).toBe('super_admin');
    expect(response.data?.meta.total).toBe(16);
  });

  it('omits empty filters from the query string', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          admin_users: [],
          meta: { current_page: 1, per_page: 15, total: 0, last_page: 1 },
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await listAdminUsers({ page: 1, per_page: 15, search: '', role: '', status: '' });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/admin/admin-users?page=1&per_page=15'),
      expect.anything(),
    );
  });
});

describe('createAdminUser', () => {
  it('posts the JSON payload with the password included', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ success: true, data: { admin_user: sampleAdminUser } }, 201),
      );
    vi.stubGlobal('fetch', fetchMock);

    const response = await createAdminUser({
      name: '  Aye Chan  ',
      email: ' aye@example.com ',
      phone: ' 09123456789 ',
      role: 'admin',
      status: 'active',
      password: 'secret-password',
    });

    const [url, options] = fetchMock.mock.calls[0];

    expect(url).toContain('/admin/admin-users');
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(options.body)).toEqual({
      name: 'Aye Chan',
      email: 'aye@example.com',
      phone: '09123456789',
      role: 'admin',
      status: 'active',
      password: 'secret-password',
    });
    expect(response.data?.admin_user.id).toBe(7);
  });
});

describe('updateAdminUser', () => {
  it('never sends the password field', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ success: true, data: { admin_user: sampleAdminUser } }));
    vi.stubGlobal('fetch', fetchMock);

    await updateAdminUser(7, {
      name: 'Renamed',
      role: 'super_admin',
      status: 'inactive',
      password: 'should-not-be-sent',
    });

    const [, options] = fetchMock.mock.calls[0];

    expect(options.method).toBe('PATCH');
    expect(JSON.parse(options.body)).toEqual({
      name: 'Renamed',
      role: 'super_admin',
      status: 'inactive',
    });
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/admin/admin-users/7'), expect.anything());
  });
});

describe('resetAdminUserPassword', () => {
  it('PATCHes only the password to the dedicated endpoint', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ success: true, data: { admin_user: sampleAdminUser } }));
    vi.stubGlobal('fetch', fetchMock);

    await resetAdminUserPassword(7, 'brand-new-password');

    const [url, options] = fetchMock.mock.calls[0];

    expect(url).toContain('/admin/admin-users/7/password');
    expect(options.method).toBe('PATCH');
    expect(JSON.parse(options.body)).toEqual({ password: 'brand-new-password' });
  });
});

describe('deleteAdminUser', () => {
  it('sends DELETE and returns the 409 conflict envelope unchanged', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(
          { success: false, message: 'Admin user cannot be deleted because quotation requests are assigned to them. Reassign them first.' },
          409,
        ),
      ),
    );

    const response = await deleteAdminUser(7);

    expect(response.success).toBe(false);
    expect(response.status).toBe(409);
    expect(response.message).toContain('assigned to them');
  });
});

describe('authorization failures', () => {
  it('returns the backend 403 envelope unchanged', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({ success: false, message: 'Forbidden. Super admin access required.' }, 403),
      ),
    );

    const response = await listAdminUsers();

    expect(response.success).toBe(false);
    expect(response.status).toBe(403);
    expect(response.message).toBe('Forbidden. Super admin access required.');
  });
});
