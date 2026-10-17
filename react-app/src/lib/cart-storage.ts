/**
 * Guest cart rules and browser-local persistence (Task 05).
 *
 * The cart is a localStorage-only, guest-capable list. It holds a snapshot of
 * the display price and the MOQ, both of which are explicitly non-final: the
 * server remains the money source of truth (MoneyAndValidationRules §2).
 *
 * Every rule from LogicFlow §4 is enforced here, in one place:
 *
 *   - Only PUBLISHED products can enter the cart, and only when their stock
 *     row is missing or is not OUT_OF_STOCK.
 *   - Quantity must be a whole number of at least the product MOQ.
 *   - SUPPLIER_CONFIRMATION_REQUIRED products are cart-eligible but must be
 *     flagged so the UI can say "Price/Stock will be confirmed".
 */
import type { PublicProduct, PublicProductPrice, StockStatus } from '../api/catalog';

export const CART_STORAGE_KEY = 'cos_cart_v1';

export interface CartItem {
  product_id: number;
  slug: string;
  sku: string | null;
  name_mm: string;
  name_en: string | null;
  unit: string;
  photo_url: string | null;
  supplier_id: number;
  supplier_name: string | null;
  category_name: string | null;
  /** Snapshot of the display price; never treated as the final price. */
  unit_price: number;
  minimum_order_quantity: number;
  /** null when the product has no stock row (treated as available). */
  stock_status: StockStatus | null;
  stock_quantity: number | null;
  quantity: number;
}

export interface CartMutation {
  items: CartItem[];
  error: string | null;
}

/**
 * The unit price shown to buyers: the discounted price when it is a genuine
 * reduction, otherwise retail. A `discount_price` of 0 is stored as "no
 * discount" by the admin form, so it never renders as a free item.
 */
export function displayUnitPrice(price: PublicProductPrice | null | undefined): number | null {
  if (!price) return null;

  const { discount_price: discount, retail_price: retail } = price;

  if (discount !== null && discount !== undefined && discount > 0 && discount < retail) {
    return discount;
  }

  return retail;
}

/** MOQ for a product, defaulting to 1 when no price row exists yet. */
export function minimumQuantity(price: PublicProductPrice | null | undefined): number {
  const moq = price?.minimum_order_quantity ?? 1;
  return Number.isFinite(moq) && moq >= 1 ? Math.trunc(moq) : 1;
}

/**
 * Cart eligibility mirrors the server's `Product::availableForCart()` scope:
 * published, and the stock row is missing or not OUT_OF_STOCK.
 */
export function isProductCartEligible(product: PublicProduct): boolean {
  if (product.status !== 'PUBLISHED') return false;

  return !product.stock || product.stock.stock_status !== 'OUT_OF_STOCK';
}

/** SUPPLIER_CONFIRMATION_REQUIRED must surface as "price/stock to be confirmed". */
export function needsSupplierConfirmation(stockStatus: StockStatus | null): boolean {
  return stockStatus === 'SUPPLIER_CONFIRMATION_REQUIRED';
}

/**
 * Why a product cannot be added, or null when it can.
 * Used both by the product list and the product detail page.
 */
export function cartBlockReason(product: PublicProduct): string | null {
  if (product.status !== 'PUBLISHED') {
    return 'This product is not available.';
  }

  if (product.stock && product.stock.stock_status === 'OUT_OF_STOCK') {
    return 'This product is out of stock and cannot be added to the cart.';
  }

  return null;
}

/** Validate a quantity against a product's MOQ. Returns an error message or null. */
export function quantityError(quantity: number, minimum: number): string | null {
  if (!Number.isFinite(quantity) || !Number.isInteger(quantity)) {
    return 'Quantity must be a whole number.';
  }

  if (quantity < minimum) {
    return minimum === 1
      ? 'Quantity must be at least 1.'
      : `Quantity must be at least the minimum order quantity of ${minimum}.`;
  }

  return null;
}

function snapshot(product: PublicProduct, quantity: number): CartItem | null {
  const price = displayUnitPrice(product.price);
  const moq = minimumQuantity(product.price);

  if (price === null) return null;

  return {
    product_id: product.id,
    slug: product.slug,
    sku: product.sku,
    name_mm: product.name_mm,
    name_en: product.name_en,
    unit: product.unit,
    photo_url: product.photo_url,
    supplier_id: product.supplier_id,
    supplier_name: product.supplier?.shop_name ?? null,
    category_name: product.category?.name_en ?? null,
    unit_price: price,
    minimum_order_quantity: moq,
    stock_status: product.stock?.stock_status ?? null,
    stock_quantity: product.stock?.stock_quantity ?? null,
    quantity,
  };
}

/**
 * Add a product (or increase an existing line).
 * Returns the previous list untouched when the product is not eligible or the
 * quantity is below MOQ, together with a message for the UI.
 */
export function addProductToCart(
  items: CartItem[],
  product: PublicProduct,
  quantity: number,
): CartMutation {
  const blocked = cartBlockReason(product);
  if (blocked) return { items, error: blocked };

  const price = displayUnitPrice(product.price);
  if (price === null) {
    return { items, error: 'This product has no confirmed price yet.' };
  }

  const moq = minimumQuantity(product.price);
  const invalid = quantityError(quantity, moq);
  if (invalid) return { items, error: invalid };

  const existing = items.find((item) => item.product_id === product.id);
  if (existing) {
    return {
      items: items.map((item) =>
        item.product_id === product.id ? { ...item, quantity: item.quantity + quantity } : item,
      ),
      error: null,
    };
  }

  const created = snapshot(product, quantity);
  if (!created) return { items, error: 'This product has no confirmed price yet.' };

  return { items: [...items, created], error: null };
}

/** Replace an existing line's quantity, enforcing MOQ. */
export function setCartQuantity(
  items: CartItem[],
  productId: number,
  quantity: number,
): CartMutation {
  const existing = items.find((item) => item.product_id === productId);
  if (!existing) return { items, error: 'That product is no longer in your cart.' };

  const invalid = quantityError(quantity, existing.minimum_order_quantity);
  if (invalid) return { items, error: invalid };

  return {
    items: items.map((item) => (item.product_id === productId ? { ...item, quantity } : item)),
    error: null,
  };
}

export function removeCartItem(items: CartItem[], productId: number): CartItem[] {
  return items.filter((item) => item.product_id !== productId);
}

export function clearCartItems(): CartItem[] {
  return [];
}

/** Header badge value: the total number of units across all lines. */
export function cartUnitCount(items: CartItem[]): number {
  return items.reduce((total, item) => total + item.quantity, 0);
}

/** Cart totals are indicative only; the server recomputes every quotation. */
export function cartSubtotal(items: CartItem[]): number {
  return items.reduce((total, item) => total + item.unit_price * item.quantity, 0);
}

/**
 * Drop anything that must never sit in a cart (bad shape, unpublished rules,
 * OOS stock, or a quantity below MOQ) so stale localStorage cannot resurrect
 * an ineligible line.
 */
export function reconcileCart(items: unknown): CartItem[] {
  if (!Array.isArray(items)) return [];

  const seen = new Set<number>();
  const result: CartItem[] = [];

  for (const entry of items) {
    if (!entry || typeof entry !== 'object') continue;

    const item = entry as Partial<CartItem>;
    if (typeof item.product_id !== 'number' || seen.has(item.product_id)) continue;

    const quantity = Number(item.quantity);
    const minimum = Number(item.minimum_order_quantity);
    const unitPrice = Number(item.unit_price);

    if (!Number.isInteger(quantity) || !Number.isInteger(minimum) || !Number.isFinite(unitPrice)) {
      continue;
    }

    const moq = minimum >= 1 ? minimum : 1;
    if (quantity < moq || unitPrice < 0) continue;

    if (item.stock_status === 'OUT_OF_STOCK') continue;
    if (typeof item.slug !== 'string' || typeof item.name_mm !== 'string') continue;

    seen.add(item.product_id);

    result.push({
      product_id: item.product_id,
      slug: item.slug,
      sku: typeof item.sku === 'string' ? item.sku : null,
      name_mm: item.name_mm,
      name_en: typeof item.name_en === 'string' ? item.name_en : null,
      unit: typeof item.unit === 'string' ? item.unit : '',
      photo_url: typeof item.photo_url === 'string' ? item.photo_url : null,
      supplier_id: Number(item.supplier_id) || 0,
      supplier_name: typeof item.supplier_name === 'string' ? item.supplier_name : null,
      category_name: typeof item.category_name === 'string' ? item.category_name : null,
      unit_price: unitPrice,
      minimum_order_quantity: moq,
      stock_status: item.stock_status ?? null,
      stock_quantity: typeof item.stock_quantity === 'number' ? item.stock_quantity : null,
      quantity,
    });
  }

  return result;
}

/** Read the guest cart, tolerating corrupt or unavailable storage. */
export function loadCart(): CartItem[] {
  if (typeof localStorage === 'undefined') return [];

  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];

    return reconcileCart(JSON.parse(raw));
  } catch {
    return [];
  }
}

/** Persist the guest cart, tolerating a full or unavailable storage quota. */
export function saveCart(items: CartItem[]): void {
  if (typeof localStorage === 'undefined') return;

  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // A failed write must never break browsing; the cart just will not persist.
  }
}
