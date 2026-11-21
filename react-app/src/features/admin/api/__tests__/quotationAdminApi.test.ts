/**
 * Unit tests for the bulk supplier communication multipart payload.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBulkSupplierCommunication } from '../quotationAdminApi';

/** `node` has no localStorage, and the client reads the bearer token from it. */
function stubStorage() {
  vi.stubGlobal('localStorage', {
    getItem: () => 'admin-token',
    setItem: () => undefined,
    removeItem: () => undefined,
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe('createBulkSupplierCommunication', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    stubStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts one shared entry for every selected supplier', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          communications: [{ id: 1 }, { id: 2 }],
          request_status: 'SUPPLIER_RESPONSE_PENDING',
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const attachment = new File(['pdf'], 'list.pdf', { type: 'application/pdf' });
    const response = await createBulkSupplierCommunication(31, {
      supplier_ids: [3, 4],
      contact_method: 'VIBER',
      message_text: '  Please confirm stock.  ',
      attachment,
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(url).toContain('/admin/quotation-requests/31/communications/bulk');
    expect(init.method).toBe('POST');

    const form = init.body as FormData;
    expect(form.getAll('supplier_ids[]')).toEqual(['3', '4']);
    expect(form.get('contact_method')).toBe('VIBER');
    expect(form.get('message_text')).toBe('Please confirm stock.');
    expect(form.get('attachment')).toBeInstanceOf(File);
    expect(response.success).toBe(true);
    expect(response.data?.communications).toHaveLength(2);
  });

  it('omits supplier_ids when no selection is given so the server uses them all', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: { communications: [], request_status: 'SUPPLIER_RESPONSE_PENDING' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await createBulkSupplierCommunication(31, {
      contact_method: 'PHONE',
      message_text: 'Hello',
      attachment: null,
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const form = init.body as FormData;

    expect(form.getAll('supplier_ids[]')).toEqual([]);
    expect(form.get('attachment')).toBeNull();
  });
});
