import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { PublicProduct } from '../api/catalog';
import {
  addProductToCart,
  cartUnitCount,
  clearCartItems,
  loadCart,
  removeCartItem,
  saveCart,
  setCartQuantity,
  type CartItem,
} from './cart-storage';

/**
 * What the last successful "add" logged. The `at` timestamp lets cards and
 * detail pages play the receipt moment (button flips to "Added — N" while the
 * header badge pops) and time it out without a global clock.
 */
export interface LastAddedCartLine {
  productId: number;
  quantity: number;
  at: number;
}

interface CartContextType {
  items: CartItem[];
  /** Total units across every line; drives the header badge. */
  count: number;
  /** Snapshot of the most recent successful add, or null when the list starts session. */
  lastAdded: LastAddedCartLine | null;
  /**
   * Add (or top up) a product line.
   * Returns null on success, or the rejection message to show the buyer.
   */
  add: (product: PublicProduct, quantity: number) => string | null;
  /** Same contract as `add`, for an existing line. */
  setQuantity: (productId: number, quantity: number) => string | null;
  remove: (productId: number) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => loadCart());
  const [lastAdded, setLastAdded] = useState<LastAddedCartLine | null>(null);

  useEffect(() => {
    saveCart(items);
  }, [items]);

  const add = (product: PublicProduct, quantity: number): string | null => {
    const result = addProductToCart(items, product, quantity);

    if (result.error !== null) return result.error;

    setItems(result.items);
    setLastAdded({ productId: product.id, quantity, at: Date.now() });
    return null;
  };

  const setQuantity = (productId: number, quantity: number): string | null => {
    const result = setCartQuantity(items, productId, quantity);

    if (result.error !== null) return result.error;

    setItems(result.items);
    return null;
  };

  const remove = (productId: number) => {
    setItems((current) => removeCartItem(current, productId));
  };

  const clear = () => {
    setItems(clearCartItems());
  };

  return (
    <CartContext.Provider
      value={{ items, count: cartUnitCount(items), lastAdded, add, setQuantity, remove, clear }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
