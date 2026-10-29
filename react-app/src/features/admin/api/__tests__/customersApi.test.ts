/**
 * Unit tests for the admin customer directory API (Task 12).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

function stubStorage() {
  vi.stubGlobal('localStorage', {
    getItem: () => 'admin-token',
    setItem: () => undefined,
    removeItem: () => undefined,
  });
}

import { listCustomers } from '../customersApi';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

const sampleCustomer = {
  id: 4,
  name: 'Daw Hla',
  phone: '09123456789',
  email: 'hla@example.com',
  company_name: 'Hla Trading',
  customer_type: 'business',
  status: 'active',
  quotation_requests_count: 2,
  orders_count: 1,
  created_at: '2026-10-20T08:00:00+00:00',
};

beforeEach(() => {
  vi.unstubAllGlobals();
  stubStorage();
});

describe('listCustomers', () => {
  it('sends status, type, search and pagination filters', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          customers: [sampleCustomer],
          meta: { current_page: 1, per_page: 20, total: 1, last_page: 1 },
          statuses: ['active', 'inactive', 'suspended'],
          customer_types: ['individual', 'business'],
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await listCustomers({
      page: 1,
      per_page: 20,
      status: 'active',
      customer_type: 'business',
      search: 'Hla',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(
        '/admin/customers?page=1&per_page=20&status=active&customer_type=business&search=Hla',
      ),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer admin-token' }),
      }),
    );
    expect(response.data?.customers[0].quotation_requests_count).toBe(2);
    expect(response.data?.customers[0].orders_count).toBe(1);
  });

  it('omits empty filters from the query string', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          customers: [],
          meta: { current_page: 1, per_page: 20, total: 0, last_page: 1 },
          statuses: ['active', 'inactive', 'suspended'],
          customer_types: ['individual', 'business'],
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await listCustomers({ page: 1, per_page: 20, status: '', customer_type: '', search: '' });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/admin/customers?page=1&per_page=20'),
      expect.anything(),
    );
  });

  it('returns the backend error envelope unchanged', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({ success: false, message: 'Forbidden.' }, 403),
      ),
    );

    const response = await listCustomers();

    expect(response.success).toBe(false);
    expect(response.status).toBe(403);
    expect(response.message).toBe('Forbidden.');
  });
});
