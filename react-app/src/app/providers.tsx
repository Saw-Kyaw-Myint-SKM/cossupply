import type { ReactNode } from 'react';
import { AuthProvider } from '../lib/auth-context';
import { CartProvider } from '../lib/cart-context';
import { NotificationProvider } from '../features/notifications/notification-context';
import { I18nProvider } from '../lib/i18n-context';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <I18nProvider>
      <AuthProvider>
        <NotificationProvider>
          <CartProvider>{children}</CartProvider>
        </NotificationProvider>
      </AuthProvider>
    </I18nProvider>
  );
}
