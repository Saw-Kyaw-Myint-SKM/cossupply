import { describe, expect, it } from 'vitest';
import type { PublicProduct, StockStatus } from '../../api/catalog';
import {
  addProductToCart,
  cartBlockReason,
  cartSubtotal,
  cartUnitCount,
  displayUnitPrice,
  isProductCartEligible,
  minimumQuantity,
  needsSupplierConfirmation,
  quantityError,
  reconcileCart,
  removeCartItem,
  setCartQuantity,
  type CartItem,
} from '../cart-storage';

function product(overrides: Partial<PublicProduct> = {}): PublicProduct {
  return {
    id: 1,
    supplier_id: 10,
    category_id: 20,
    name_mm: 'ပလတ်စတစ်ကုတ်အင်္ကျီ',
    name_en: 'Plastic Chair',
    slug: 'plastic-chair',
    sku: 'CHAIR-001',
    brand: 'CoSupply',
    model: 'PC-100',
    description: null,
    specification: null,
    size: null,
    color: null,
    unit: 'pcs',
    package_size: null,
    photo: null,
    photo_url: '/storage/products/chair.jpg',
    status: 'PUBLISHED',
    category: {
      id: 20,
      parent_id: null,
      name_mm: 'ကုတ်',
      name_en: 'Furniture',
      slug: 'furniture',
      description: null,
      image: null,
      image_url: null,
      sort_order: 0,
    },
    supplier: {
      id: 10,
      shop_name: 'Yangon Trading',
      company_name: null,
      logo: null,
      logo_url: null,
      business_description: null,
      delivery_area: null,
      delivery_time: null,
      verified: true,
    },
    price: {
      retail_price: 5000,
      discount_price: null,
      minimum_order_quantity: 2,
      price_valid_until: null,
      last_updated_at: null,
    },
    stock: {
      stock_quantity: 20,
      stock_status: 'IN_STOCK',
      last_confirmed_at: null,
    },
    ...overrides,
  };
}

function withStock(status: StockStatus | null): Partial<PublicProduct> {
  return status === null
    ? { stock: undefined }
    : { stock: { stock_quantity: 10, stock_status: status, last_confirmed_at: null } };
}

function line(overrides: Partial<CartItem> = {}): CartItem {
  return {
    product_id: 1,
    slug: 'plastic-chair',
    sku: 'CHAIR-001',
    name_mm: 'ပလတ်စတစ်ကုတ်အင်္ကျီ',
    name_en: 'Plastic Chair',
    unit: 'pcs',
    photo_url: null,
    supplier_id: 10,
    supplier_name: 'Yangon Trading',
    category_name: 'Furniture',
    unit_price: 5000,
    minimum_order_quantity: 2,
    stock_status: 'IN_STOCK',
    stock_quantity: 20,
    quantity: 2,
    ...overrides,
  };
}

describe('displayUnitPrice', () => {
  it('uses retail when there is no discount', () => {
    expect(displayUnitPrice(product().price)).toBe(5000);
  });

  it('uses a genuine discount below retail', () => {
    const price = { ...product().price!, discount_price: 4500 };
    expect(displayUnitPrice(price)).toBe(4500);
  });

  it('falls back to retail when the discount is not a reduction', () => {
    const equal = { ...product().price!, discount_price: 5000 };
    const above = { ...product().price!, discount_price: 6000 };
    const zero = { ...product().price!, discount_price: 0 };

    expect(displayUnitPrice(equal)).toBe(5000);
    expect(displayUnitPrice(above)).toBe(5000);
    expect(displayUnitPrice(zero)).toBe(5000);
  });

  it('returns null when no price row exists yet', () => {
    expect(displayUnitPrice(null)).toBeNull();
    expect(displayUnitPrice(undefined)).toBeNull();
  });
});

describe('minimumQuantity', () => {
  it('reads the MOQ from the price row', () => {
    expect(minimumQuantity(product().price)).toBe(2);
  });

  it('defaults to 1 when there is no price row', () => {
    expect(minimumQuantity(null)).toBe(1);
  });

  it('never returns a quantity below 1', () => {
    expect(minimumQuantity({ ...product().price!, minimum_order_quantity: 0 })).toBe(1);
    expect(minimumQuantity({ ...product().price!, minimum_order_quantity: -4 })).toBe(1);
  });
});

describe('cart eligibility', () => {
  it('allows published products with stock or with no stock row', () => {
    expect(cartBlockReason(product())).toBeNull();
    expect(cartBlockReason(product({ ...withStock(null) }))).toBeNull();
    expect(isProductCartEligible(product())).toBe(true);
  });

  it('blocks out-of-stock products', () => {
    const reason = cartBlockReason(product({ ...withStock('OUT_OF_STOCK') }));

    expect(reason).toMatch(/out of stock/i);
    expect(isProductCartEligible(product({ ...withStock('OUT_OF_STOCK') }))).toBe(false);
  });

  it('blocks anything that is not published', () => {
    expect(cartBlockReason(product({ status: 'DRAFT' }))).toMatch(/not available/i);
    expect(cartBlockReason(product({ status: 'HIDDEN' }))).toMatch(/not available/i);
    expect(cartBlockReason(product({ status: 'OUT_OF_STOCK' }))).toMatch(/not available/i);
  });

  it('keeps SUPPLIER_CONFIRMATION_REQUIRED in the cart but flags it', () => {
    const candidate = product({ ...withStock('SUPPLIER_CONFIRMATION_REQUIRED') });

    expect(cartBlockReason(candidate)).toBeNull();
    expect(needsSupplierConfirmation(candidate.stock?.stock_status ?? null)).toBe(true);
    expect(needsSupplierConfirmation('IN_STOCK')).toBe(false);
    expect(needsSupplierConfirmation(null)).toBe(false);
  });
});

describe('quantityError', () => {
  it('accepts a whole number at or above the MOQ', () => {
    expect(quantityError(2, 2)).toBeNull();
    expect(quantityError(9, 2)).toBeNull();
    expect(quantityError(1, 1)).toBeNull();
  });

  it('rejects a quantity below the MOQ and names it', () => {
    expect(quantityError(1, 2)).toMatch(/minimum order quantity of 2/);
    expect(quantityError(0, 1)).toMatch(/at least 1/);
  });

  it('rejects fractional and non-numeric quantities', () => {
    expect(quantityError(2.5, 1)).toMatch(/whole number/);
    expect(quantityError(Number.NaN, 1)).toMatch(/whole number/);
  });
});

describe('addProductToCart', () => {
  it('creates a line using the requested quantity', () => {
    const result = addProductToCart([], product(), 3);

    expect(result.error).toBeNull();
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      product_id: 1,
      quantity: 3,
      unit_price: 5000,
      minimum_order_quantity: 2,
      stock_status: 'IN_STOCK',
    });
  });

  it('merges into an existing line instead of duplicating it', () => {
    const first = addProductToCart([], product(), 2);
    const second = addProductToCart(first.items, product(), 4);

    expect(second.error).toBeNull();
    expect(second.items).toHaveLength(1);
    expect(second.items[0].quantity).toBe(6);
  });

  it('refuses an out-of-stock product and leaves the cart untouched', () => {
    const existing = [line()];
    const result = addProductToCart(existing, product({ ...withStock('OUT_OF_STOCK') }), 2);

    expect(result.error).toMatch(/out of stock/i);
    expect(result.items).toBe(existing);
  });

  it('refuses an unpublished product', () => {
    const result = addProductToCart([], product({ status: 'DRAFT' }), 2);

    expect(result.error).toMatch(/not available/i);
    expect(result.items).toHaveLength(0);
  });

  it('refuses a quantity below the MOQ', () => {
    const result = addProductToCart([], product(), 1);

    expect(result.error).toMatch(/minimum order quantity of 2/);
    expect(result.items).toHaveLength(0);
  });

  it('refuses a product that has no price row', () => {
    const result = addProductToCart([], product({ price: null }), 2);

    expect(result.error).toMatch(/price/i);
    expect(result.items).toHaveLength(0);
  });

  it('accepts a SUPPLIER_CONFIRMATION_REQUIRED product and snapshots the flag', () => {
    const result = addProductToCart([], product({ ...withStock('SUPPLIER_CONFIRMATION_REQUIRED') }), 2);

    expect(result.error).toBeNull();
    expect(result.items[0].stock_status).toBe('SUPPLIER_CONFIRMATION_REQUIRED');
  });
});

describe('setCartQuantity', () => {
  it('accepts a quantity at the MOQ', () => {
    const result = setCartQuantity([line()], 1, 2);

    expect(result.error).toBeNull();
    expect(result.items[0].quantity).toBe(2);
  });

  it('rejects a quantity below the MOQ and keeps the previous value', () => {
    const existing = [line({ quantity: 5 })];
    const result = setCartQuantity(existing, 1, 1);

    expect(result.error).toMatch(/minimum order quantity of 2/);
    expect(result.items[0].quantity).toBe(5);
  });

  it('reports a line that is no longer in the cart', () => {
    const result = setCartQuantity([line()], 999, 4);

    expect(result.error).toMatch(/no longer in your cart/i);
  });
});

describe('cart totals', () => {
  it('counts units across every line', () => {
    expect(cartUnitCount([line({ quantity: 3 }), line({ product_id: 2, quantity: 4 })])).toBe(7);
  });

  it('multiplies the display price by quantity as an integer MMK total', () => {
    const total = cartSubtotal([line({ quantity: 3 }), line({ product_id: 2, unit_price: 1200, quantity: 2 })]);

    expect(total).toBe(5000 * 3 + 1200 * 2);
    expect(Number.isInteger(total)).toBe(true);
  });

  it('removes only the requested line', () => {
    const items = [line(), line({ product_id: 2 })];
    expect(removeCartItem(items, 1)).toHaveLength(1);
    expect(removeCartItem(items, 1)[0].product_id).toBe(2);
  });
});

describe('reconcileCart', () => {
  it('returns an empty cart for corrupt or missing storage', () => {
    expect(reconcileCart(null)).toEqual([]);
    expect(reconcileCart(undefined)).toEqual([]);
    expect(reconcileCart('nope')).toEqual([]);
    expect(reconcileCart({ items: [] })).toEqual([]);
  });

  it('keeps a valid line', () => {
    expect(reconcileCart([line()])).toHaveLength(1);
  });

  it('drops out-of-stock lines that localStorage could resurrect', () => {
    expect(reconcileCart([line({ stock_status: 'OUT_OF_STOCK' })])).toHaveLength(0);
  });

  it('drops lines below their MOQ', () => {
    expect(reconcileCart([line({ quantity: 1, minimum_order_quantity: 2 })])).toHaveLength(0);
  });

  it('drops malformed lines and duplicates', () => {
    const items = [
      line(),
      line(),
      line({ product_id: 3, quantity: 1.5 }),
      { product_id: 4 },
      { slug: 'missing-id' },
    ];

    const reconciled = reconcileCart(items);

    expect(reconciled).toHaveLength(1);
    expect(reconciled[0].product_id).toBe(1);
  });

  it('repairs a MOQ stored below 1', () => {
    const [repaired] = reconcileCart([line({ minimum_order_quantity: 0 })]);

    expect(repaired.minimum_order_quantity).toBe(1);
  });
});
