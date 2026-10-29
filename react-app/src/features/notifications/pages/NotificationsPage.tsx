/**
 * Notification center (Task 11) for Customers and Admins.
 *
 * The list is paginated server-side with an optional unread filter. The
 * unread badge in the header is kept in sync through the app-root provider.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiCheck, FiExternalLink } from 'react-icons/fi';
import {
  Alert,
  EmptyState,
  LoadingPanel,
  PageHeader,
  Pagination,
  describeCustomerLoadError,
  formatStatusLabel,
  inputClass,
  linkClass,
  secondaryButtonClass,
  type LoadErrorState,
} from '../../../components/catalog-ui/CatalogUi';
import type { PaginationMeta } from '../../../api/query';
import { useAuth } from '../../../lib/auth-context';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  notificationHref,
  type AppNotification,
} from '../api/notificationsApi';
import { useNotifications } from '../notification-context';

const PER_PAGE = 15;

function formatWhen(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
}

export default function NotificationsPage() {
  const { userType } = useAuth();
  const { refresh } = useNotifications();

  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<LoadErrorState | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setLoadError(null);

      const response = await listNotifications({
        page,
        per_page: PER_PAGE,
        unread: unreadOnly,
      });

      if (cancelled) return;

      if (response.success && response.data) {
        setItems(response.data.notifications);
        setMeta(response.data.meta);
      } else {
        setLoadError(describeCustomerLoadError(response, 'your notifications'));
      }

      setIsLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [page, unreadOnly, reloadToken]);

  const markOne = async (notification: AppNotification) => {
    if (notification.is_read) return;

    const response = await markNotificationRead(notification.id);

    if (!response.success) {
      setActionError(response.message ?? 'Could not mark the notification as read.');
      return;
    }

    setActionError(null);
    void refresh();
    setReloadToken((token) => token + 1);
  };

  const markAll = async () => {
    setIsMarkingAll(true);
    const response = await markAllNotificationsRead();
    setIsMarkingAll(false);

    if (!response.success) {
      setActionError(response.message ?? 'Could not mark notifications as read.');
      return;
    }

    setActionError(null);
    void refresh();
    setReloadToken((token) => token + 1);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Notifications"
        description="Quotation, order and payment updates for your account."
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void markAll()}
              disabled={isMarkingAll}
              className={secondaryButtonClass}
            >
              <FiCheck aria-hidden="true" className="mr-1 h-4 w-4" />
              {isMarkingAll ? 'Marking…' : 'Mark all read'}
            </button>
          </div>
        }
      />

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-rule bg-plate p-4">
        <div>
          <label htmlFor="notification-unread-filter" className="block text-sm font-medium text-ink">
            Show
          </label>
          <select
            id="notification-unread-filter"
            value={unreadOnly ? 'unread' : 'all'}
            onChange={(event) => {
              setUnreadOnly(event.target.value === 'unread');
              setPage(1);
            }}
            className={`${inputClass(false)} mt-1 w-full sm:w-56`}
          >
            <option value="all">All notifications</option>
            <option value="unread">Unread only</option>
          </select>
        </div>
      </div>

      {actionError ? <Alert>{actionError}</Alert> : null}

      {isLoading && items === null ? <LoadingPanel label="Loading notifications" /> : null}

      {loadError ? (
        <Alert>
          <p>{loadError.message}</p>
          {loadError.needsLogin ? (
            <Link to={userType === 'admin' ? '/admin/login' : '/login'} className={`${linkClass} mt-2`}>
              Sign in
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setReloadToken((token) => token + 1)}
              className={`${secondaryButtonClass} mt-3`}
            >
              Try again
            </button>
          )}
        </Alert>
      ) : null}

      {!isLoading && !loadError && items !== null && items.length === 0 ? (
        <EmptyState
          title="No notifications"
          hint={
            unreadOnly
              ? 'You have read every notification.'
              : 'Updates about your quotations, orders and payments will appear here.'
          }
        />
      ) : null}

      {items !== null && items.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-rule bg-plate">
          <ul className="divide-y divide-rule">
            {items.map((notification) => {
              const href = notificationHref(notification, userType);

              return (
                <li
                  key={notification.id}
                  className={`p-4 sm:p-5 ${notification.is_read ? '' : 'bg-amber-50/40'}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-sm font-semibold text-ink">{notification.title}</h2>
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                          {formatStatusLabel(notification.type)}
                        </span>
                        {!notification.is_read ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                            Unread
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-gray-700">{notification.message}</p>
                      <p className="mt-1 text-xs text-gray-500">{formatWhen(notification.created_at)}</p>
                    </div>

                    <div className="flex flex-none items-center gap-3">
                      {!notification.is_read ? (
                        <button
                          type="button"
                          onClick={() => void markOne(notification)}
                          className="text-xs font-medium text-ink hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
                        >
                          Mark read
                        </button>
                      ) : null}
                      {href ? (
                        <Link
                          to={href}
                          onClick={() => void markOne(notification)}
                          className={linkClass}
                        >
                          Open
                          <FiExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {meta ? <Pagination meta={meta} onPage={setPage} disabled={isLoading} /> : null}
        </div>
      ) : null}
    </div>
  );
}
