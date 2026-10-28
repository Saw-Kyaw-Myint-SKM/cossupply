/**
 * App-root notification provider (Task 11).
 *
 * A single poller runs here — not per page — while the user is authenticated:
 * it fetches the latest notifications every 60 seconds, stops on logout and
 * pauses while the browser tab is hidden. Badge and notification-center UI
 * read from this context.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '../../lib/auth-context';
import {
  NOTIFICATION_POLL_MS,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from './api/notificationsApi';

const RECENT_LIMIT = 5;

interface NotificationContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  markRead: (id: number) => Promise<void>;
  markAllRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, token, userType } = useAuth();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeRef = useRef(false);

  const load = useCallback(async (silent = false) => {
    if (!activeRef.current) return;

    if (!silent) {
      setIsLoading(true);
    }

    const response = await listNotifications({ page: 1, per_page: RECENT_LIMIT });

    if (!activeRef.current) return;

    if (response.success && response.data) {
      setNotifications(response.data.notifications);
      setUnreadCount(response.data.unread_count);
      setError(null);
    } else if (response.status === 401) {
      setError('Your session expired. Sign in again to see notifications.');
    } else {
      setError(response.message ?? 'Could not load notifications.');
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      activeRef.current = false;
      setNotifications([]);
      setUnreadCount(0);
      setError(null);
      setIsLoading(false);
      return;
    }

    activeRef.current = true;

    let intervalId: number | undefined;

    const stop = () => {
      if (intervalId !== undefined) {
        window.clearInterval(intervalId);
        intervalId = undefined;
      }
    };

    const start = () => {
      stop();
      intervalId = window.setInterval(() => {
        void load(true);
      }, NOTIFICATION_POLL_MS);
    };

    const onVisibilityChange = () => {
      if (typeof document === 'undefined') return;

      if (document.visibilityState === 'hidden') {
        // Pause polling entirely while the tab is in the background.
        stop();
        return;
      }

      void load(true);
      start();
    };

    if (typeof document === 'undefined' || document.visibilityState !== 'hidden') {
      void load();
      start();
    }

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      activeRef.current = false;
      stop();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [isAuthenticated, token, userType, load]);

  const refresh = useCallback(async () => {
    await load();
  }, [load]);

  const markRead = useCallback(async (id: number) => {
    const response = await markNotificationRead(id);

    if (!response.success || !response.data) {
      setError(response.message ?? 'Could not mark the notification as read.');
      return;
    }

    setNotifications((current) =>
      current.map((notification) =>
        notification.id === id ? response.data!.notification : notification,
      ),
    );
    setUnreadCount(response.data.unread_count);
  }, []);

  const markAllRead = useCallback(async () => {
    const response = await markAllNotificationsRead();

    if (!response.success || !response.data) {
      setError(response.message ?? 'Could not mark notifications as read.');
      return;
    }

    setNotifications((current) =>
      current.map((notification) =>
        notification.is_read
          ? notification
          : { ...notification, is_read: true, read_at: new Date().toISOString() },
      ),
    );
    setUnreadCount(0);
  }, []);

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, isLoading, error, refresh, markRead, markAllRead }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
