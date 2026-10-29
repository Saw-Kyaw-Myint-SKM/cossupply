/**
 * Header notification bell and recent-notification panel (Task 11).
 *
 * The bell reads the app-root provider; it never polls on its own. Selecting
 * an item marks it read and navigates to the record for the current role.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiBell, FiCheck } from 'react-icons/fi';
import { useAuth } from '../../../lib/auth-context';
import { useNotifications } from '../notification-context';
import { notificationHref, type AppNotification } from '../api/notificationsApi';

function itemTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
}

export function NotificationBell() {
  const { userType } = useAuth();
  const { notifications, unreadCount, isLoading, error, markRead, markAllRead } =
    useNotifications();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const openNotification = async (notification: AppNotification) => {
    if (!notification.is_read) {
      await markRead(notification.id);
    }

    setOpen(false);

    const href = notificationHref(notification, userType);
    if (href) navigate(href);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={
          unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'
        }
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-md text-ink hover:bg-gray-50 active:scale-[.99] focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 motion-safe:transition-colors"
      >
        <FiBell aria-hidden="true" className="h-5 w-5" />
        {unreadCount > 0 ? (
          <span
            aria-hidden="true"
            className="absolute right-0.5 top-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-4 text-white"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-lg border border-rule bg-plate shadow-lg"
        >
          <div className="flex items-center justify-between gap-2 border-b border-rule px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-ink">Notifications</p>
              <p className="text-xs text-gray-500">
                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
              </p>
            </div>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="inline-flex items-center gap-1 rounded text-xs font-medium text-ink hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
              >
                <FiCheck aria-hidden="true" className="h-3.5 w-3.5" />
                Mark all read
              </button>
            ) : null}
          </div>

          {error ? (
            <p className="border-b border-rule bg-red-50 px-4 py-2 text-xs text-red-800" role="alert">
              {error}
            </p>
          ) : null}

          {isLoading && notifications.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-500" role="status">
              Loading notifications…
            </p>
          ) : null}

          {!isLoading && notifications.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-500">No notifications yet.</p>
          ) : null}

          {notifications.length > 0 ? (
            <ul className="max-h-80 divide-y divide-rule overflow-y-auto">
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <button
                    type="button"
                    onClick={() => void openNotification(notification)}
                    className={`block w-full px-4 py-3 text-left hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent ${
                      notification.is_read ? '' : 'bg-amber-50/40'
                    }`}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium text-ink">{notification.title}</span>
                      {!notification.is_read ? (
                        <span
                          aria-label="Unread"
                          className="mt-1 h-2 w-2 flex-none rounded-full bg-accent"
                        />
                      ) : null}
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-xs text-gray-600">
                      {notification.message}
                    </span>
                    <span className="mt-1 block text-[11px] text-gray-400">
                      {itemTime(notification.created_at)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="border-t border-rule px-4 py-2 text-right">
            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-ink hover:text-accent"
            >
              View all notifications
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
