import type { ReactNode } from 'react';
import { AuthProvider } from '../lib/auth-context';
import { CartProvider } from '../lib/cart-context';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <AuthProvider>
      <CartProvider>{children}</CartProvider>
    </AuthProvider>
  );
}
