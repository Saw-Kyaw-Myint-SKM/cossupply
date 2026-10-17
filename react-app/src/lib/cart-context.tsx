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

interface CartContextType {
  items: CartItem[];
  /** Total units across every line; drives the header badge. */
  count: number;
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

  useEffect(() => {
    saveCart(items);
  }, [items]);

  const add = (product: PublicProduct, quantity: number): string | null => {
    const result = addProductToCart(items, product, quantity);

    if (result.error !== null) return result.error;

    setItems(result.items);
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
    <CartContext.Provider value={{ items, count: cartUnitCount(items), add, setQuantity, remove, clear }}>
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
