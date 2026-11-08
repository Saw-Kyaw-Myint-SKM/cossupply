import type { ReactNode } from 'react';
import { AuthProvider } from '../lib/auth-context';
import { CartProvider } from '../lib/cart-context';
import { NotificationProvider } from '../features/notifications/notification-context';
import { I18nProvider } from '../lib/i18n-context';
import { ToastProvider } from '../components/ui/Toast';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <I18nProvider>
      <ToastProvider>
        <AuthProvider>
          <NotificationProvider>
            <CartProvider>{children}</CartProvider>
          </NotificationProvider>
        </AuthProvider>
      </ToastProvider>
    </I18nProvider>
  );
}
