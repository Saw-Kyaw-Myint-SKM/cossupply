/**
 * Unit tests for the admin product multipart builder, including optional
 * nested variants (Task 04).
 */
import { describe, expect, it } from 'vitest';
import { buildProductFormData, type ProductInput } from '../productsApi';

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
