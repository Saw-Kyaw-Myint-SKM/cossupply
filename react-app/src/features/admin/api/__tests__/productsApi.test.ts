/**
 * Unit tests for the admin product multipart builder, including optional
 * nested variants (Task 04), and the SKU generation endpoint.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildProductFormData, generateSku, type ProductInput } from '../productsApi';

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

function baseInput(overrides: Partial<ProductInput> = {}): ProductInput {
  return {
    supplier_id: '1',
    category_id: '2',
    name_mm: 'ပလတ်စတစ်ကုတ်အင်္ကျီ',
    name_en: 'Plastic Chair',
    slug: 'plastic-chair',
    sku: 'CHAIR-1',
    brand: 'Acme',
    model: 'M-1',
    description: '',
    specification: '',
    size: '',
    color: '',
    unit: 'pcs',
    package_size: '',
    photo: null,
    status: 'DRAFT',
    retail_price: '5000',
    wholesale_price: '',
    discount_price: '',
    minimum_order_quantity: '1',
    price_valid_until: '',
    stock_quantity: '20',
    stock_status: 'IN_STOCK',
    supplier_note: '',
    variants: [],
    syncVariants: true,
    ...overrides,
  };
}

describe('buildProductFormData with variants', () => {
  it('sends variants_sync and an empty variant list when the product has none', () => {
    const form = buildProductFormData(baseInput(), { includeStatus: true });

    expect(form.get('variants_sync')).toBe('1');
    expect(form.get('variants[0][id]')).toBeNull();
    expect(form.get('name_mm')).toBe('ပလတ်စတစ်ကုတ်အင်္ကျီ');
    expect(form.get('status')).toBe('DRAFT');
  });

  it('appends nested names, prices, stock and files for each variant', () => {
    const photo = new File(['image'], 'red.jpg', { type: 'image/jpeg' });
    const form = buildProductFormData(
      baseInput({
        variants: [
          {
            id: 12,
            name: 'Red / M',
            sku: 'TS-RED-M',
            photo,
            retail_price: '6000',
            wholesale_price: '5500',
            discount_price: '5800',
            minimum_order_quantity: '2',
            price_valid_until: '2026-12-31',
            stock_quantity: '7',
            stock_status: 'LOW_STOCK',
            supplier_note: 'Ready stock',
          },
          {
            id: null,
            name: 'Blue / L',
            sku: '',
            photo: null,
            retail_price: '',
            wholesale_price: '',
            discount_price: '',
            minimum_order_quantity: '',
            price_valid_until: '',
            stock_quantity: '',
            stock_status: '',
            supplier_note: '',
          },
        ],
      }),
    );

    expect(form.get('variants[0][id]')).toBe('12');
    expect(form.get('variants[0][name]')).toBe('Red / M');
    expect(form.get('variants[0][sku]')).toBe('TS-RED-M');
    expect(form.get('variants[0][retail_price]')).toBe('6000');
    expect(form.get('variants[0][minimum_order_quantity]')).toBe('2');
    expect(form.get('variants[0][stock_status]')).toBe('LOW_STOCK');
    expect(form.get('variants[0][photo]')).toBeInstanceOf(File);

    // A new row has no id, and blank nullable values still clear on update.
    expect(form.get('variants[1][id]')).toBeNull();
    expect(form.get('variants[1][name]')).toBe('Blue / L');
    expect(form.get('variants[1][sku]')).toBe('');
    expect(form.get('variants[1][retail_price]')).toBe('');
    expect(form.get('variants[1][stock_status]')).toBeNull();
    expect(form.get('variants[1][photo]')).toBeNull();
  });

  it('omits variants_sync when a caller explicitly does not sync', () => {
    const form = buildProductFormData(baseInput({ syncVariants: false }));

    expect(form.get('variants_sync')).toBeNull();
  });
});

describe('generateSku', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    stubStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts the scope payload and returns the generated sku', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ success: true, data: { sku: 'OFFICE-CHAIR-7K2P' } }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await generateSku({
      scope: 'product',
      name_en: 'Office Chair',
      brand: 'Acme',
      model: 'M-1',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/admin/products/generate-sku'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          scope: 'product',
          name_en: 'Office Chair',
          brand: 'Acme',
          model: 'M-1',
        }),
        headers: expect.objectContaining({
          Authorization: 'Bearer admin-token',
          'Content-Type': 'application/json',
        }),
      }),
    );
    expect(response.success).toBe(true);
    expect(response.data?.sku).toBe('OFFICE-CHAIR-7K2P');
  });

  it('carries the variant payload so the server can avoid taken codes', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ success: true, data: { sku: 'CHAIR-001-RED-2' } }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await generateSku({
      scope: 'variant',
      base: 'CHAIR-001',
      product_id: 7,
      variant_name: 'Red / M',
      variant_index: 1,
      exclude_variant_id: 12,
      existing_skus: ['CHAIR-001-RED-M', 'CHAIR-001-BLUE-L'],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/admin/products/generate-sku'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          scope: 'variant',
          base: 'CHAIR-001',
          product_id: 7,
          variant_name: 'Red / M',
          variant_index: 1,
          exclude_variant_id: 12,
          existing_skus: ['CHAIR-001-RED-M', 'CHAIR-001-BLUE-L'],
        }),
      }),
    );
    expect(response.data?.sku).toBe('CHAIR-001-RED-2');
  });

  it('surfaces a conflict when the server finds no free sku', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          success: false,
          message: 'A free SKU could not be generated. Adjust the name and try again.',
        },
        409,
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await generateSku({ scope: 'product', name_en: 'Office Chair' });

    expect(response.success).toBe(false);
    expect(response.status).toBe(409);
    expect(response.message).toContain('A free SKU could not be generated');
  });
});
