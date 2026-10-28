import type { ReactNode } from 'react';
import { AuthProvider } from '../lib/auth-context';
import { CartProvider } from '../lib/cart-context';
import { NotificationProvider } from '../features/notifications/notification-context';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <AuthProvider>
      <NotificationProvider>
        <CartProvider>{children}</CartProvider>
      </NotificationProvider>
    </AuthProvider>
  );
}
