/**
 * Header notification bell and recent-notification tray (Task 11).
 *
 * The bell reads the app-root provider; it never polls on its own. Selecting
 * an item marks it read and navigates to the record for the current role.
 *
 * Visual language: a quiet "ledger" tray. Each event carries a tinted type
 * chip, and unread items are marked with a thin cyan rail instead of a full
 * tinted row, so the list stays calm while unread state remains obvious.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FiAlertCircle,
  FiArrowRight,
  FiBell,
  FiCheck,
  FiCheckCircle,
  FiCreditCard,
  FiFileText,
  FiPackage,
  FiRefreshCw,
  FiTruck,
  FiXCircle,
} from 'react-icons/fi';
import type { IconType } from 'react-icons';
import { useAuth } from '../../../lib/auth-context';
import { useNotifications } from '../notification-context';
import { useI18n } from '../../../lib/i18n-context';
import { notificationHref, type AppNotification } from '../api/notificationsApi';

/**
 * Relative time reads friendlier in a compact tray ("3d ago"), while the
 * absolute timestamp stays available on hover for precision. The labels come
 * from the app catalog because Chrome ships no Burmese relative-time data.
 */
type NotificationTimeKey =
  | 'timeJustNow'
  | 'timeMinutesAgo'
  | 'timeHoursAgo'
  | 'timeDaysAgo'
  | 'timeWeeksAgo'
  | 'timeMonthsAgo'
  | 'timeYearsAgo';

function notificationTime(
  value: string,
  locale: 'en' | 'my',
): { key: NotificationTimeKey; count: number; full: string } {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { key: 'timeJustNow', count: 0, full: '' };
  }

  const full = date.toLocaleString(locale === 'my' ? 'my-MM' : 'en-US');
  const diff = Math.abs(date.getTime() - Date.now());

  if (diff < 60_000) return { key: 'timeJustNow', count: 0, full };
  if (diff < 3_600_000) {
    return { key: 'timeMinutesAgo', count: Math.floor(diff / 60_000), full };
  }
  if (diff < 86_400_000) {
    return { key: 'timeHoursAgo', count: Math.floor(diff / 3_600_000), full };
  }
  if (diff < 604_800_000) {
    return { key: 'timeDaysAgo', count: Math.floor(diff / 86_400_000), full };
  }
  if (diff < 2_592_000_000) {
    return { key: 'timeWeeksAgo', count: Math.floor(diff / 604_800_000), full };
  }
  if (diff < 31_536_000_000) {
    return { key: 'timeMonthsAgo', count: Math.floor(diff / 2_592_000_000), full };
  }

  return { key: 'timeYearsAgo', count: Math.floor(diff / 31_536_000_000), full };
}

type NotificationCategoryKey =
  | 'notificationTypeQuotation'
  | 'notificationTypeOrder'
  | 'notificationTypePayment'
  | 'notificationTypeSupplier'
  | 'notificationTypeCancellation'
  | 'notificationTypeUpdate';

interface NotificationVisual {
  Icon: IconType;
  chipClass: string;
  labelClass: string;
  categoryKey: NotificationCategoryKey;
}

/** Pick an icon, tint, and category label from the event type so the tray is scannable at a glance. */
function notificationVisual(type: string): NotificationVisual {
  const value = type.toUpperCase();

  if (value.includes('CANCEL') || value.includes('REJECT')) {
    return {
      Icon: FiXCircle,
      chipClass: 'bg-error-soft text-error ring-error/15',
      labelClass: 'text-error',
      categoryKey: 'notificationTypeCancellation',
    };
  }
  if (value.includes('PAYMENT') || value.includes('CASH_COLLECTION')) {
    return {
      Icon: FiCreditCard,
      chipClass: 'bg-success-soft text-success ring-success/15',
      labelClass: 'text-success',
      categoryKey: 'notificationTypePayment',
    };
  }
  if (value.includes('DELIVER') || value.includes('OUT_FOR')) {
    return {
      Icon: FiTruck,
      chipClass: 'bg-amber-50 text-warm-hover ring-warm/15',
      labelClass: 'text-warm-hover',
      categoryKey: 'notificationTypeOrder',
    };
  }
  if (value.includes('SUPPLIER')) {
    return {
      Icon: FiAlertCircle,
      chipClass: 'bg-purple-50 text-purple-700 ring-purple-500/15',
      labelClass: 'text-purple-700',
      categoryKey: 'notificationTypeSupplier',
    };
  }
  if (value.includes('ACCEPT')) {
    return {
      Icon: FiCheckCircle,
      chipClass: 'bg-success-soft text-success ring-success/15',
      labelClass: 'text-success',
      categoryKey: value.includes('QUOTATION')
        ? 'notificationTypeQuotation'
        : 'notificationTypeOrder',
    };
  }
  if (value.includes('CHANGE')) {
    return {
      Icon: FiRefreshCw,
      chipClass: 'bg-amber-50 text-warm-hover ring-warm/15',
      labelClass: 'text-warm-hover',
      categoryKey: 'notificationTypeQuotation',
    };
  }
  if (value.includes('QUOTATION') || value.includes('REQUEST')) {
    return {
      Icon: FiFileText,
      chipClass: 'bg-primary-light text-primary ring-primary/15',
      labelClass: 'text-primary',
      categoryKey: 'notificationTypeQuotation',
    };
  }
  if (value.includes('ORDER') || value.includes('CONFIRM')) {
    return {
      Icon: FiPackage,
      chipClass: 'bg-amber-50 text-warm-hover ring-warm/15',
      labelClass: 'text-warm-hover',
      categoryKey: 'notificationTypeOrder',
    };
  }

  return {
    Icon: FiBell,
    chipClass: 'bg-paper text-muted ring-gray-200',
    labelClass: 'text-muted',
    categoryKey: 'notificationTypeUpdate',
  };
}

export function NotificationBell() {
  const { userType } = useAuth();
  const {
    notifications,
    unreadCount,
    isLoading,
    error,
    refresh,
    markRead,
    markAllRead,
  } = useNotifications();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const panelId = useId();

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  const openNotification = async (notification: AppNotification) => {
    if (!notification.is_read) {
      await markRead(notification.id);
    }

    setOpen(false);

    const href = notificationHref(notification, userType);
    if (href) navigate(href);
  };

  const showSkeleton = isLoading && notifications.length === 0;

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={
          unreadCount > 0 ? t('unreadCount', { count: unreadCount }) : t('notifications')
        }
        className={`relative inline-flex h-10 w-10 items-center justify-center rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-safe:transition-all ${
          open ? 'bg-white/80 text-ink shadow-sm' : 'text-slate-600 hover:bg-white/70 hover:text-ink'
        }`}
      >
        <FiBell aria-hidden="true" className="h-5 w-5" />
        {unreadCount > 0 ? (
          <span
            key={unreadCount}
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 inline-flex min-w-[1.125rem] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-[1.125rem] text-white ring-2 ring-white motion-safe:animate-badge-pop"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          tabIndex={-1}
          aria-label={t('notifications')}
          className="fixed inset-x-3 top-[4.75rem] z-50 origin-top overflow-hidden rounded-[22px] border border-gray-200/80 bg-white/[0.98] shadow-[0_24px_60px_-20px_rgba(15,23,42,0.4)] outline-none backdrop-blur-xl motion-safe:animate-rise-in sm:absolute sm:inset-x-auto sm:right-0 sm:top-[calc(100%+0.5rem)] sm:w-[22rem] sm:origin-top-right"
        >
          <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">{t('notifications')}</p>
              <p aria-live="polite" className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                {unreadCount > 0 ? (
                  <>
                    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-primary" />
                    {t('unreadCount', { count: unreadCount })}
                  </>
                ) : notifications.length > 0 ? (
                  t('allCaughtUp')
                ) : null}
              </p>
            </div>

            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="inline-flex flex-none items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold text-primary hover:bg-primary-light focus:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-safe:transition-colors"
              >
                <FiCheck aria-hidden="true" className="h-3.5 w-3.5" />
                {t('markAllRead')}
              </button>
            ) : null}
          </div>

          {error ? (
            <div
              role="alert"
              className="mx-3 mb-2 flex items-start justify-between gap-2 rounded-xl bg-error-soft px-3 py-2 text-xs text-error"
            >
              <span className="min-w-0">{error}</span>
              <button
                type="button"
                onClick={() => void refresh()}
                className="flex-none font-semibold text-error underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-error"
              >
                {t('tryAgain')}
              </button>
            </div>
          ) : null}

          {showSkeleton ? (
            <div
              className="space-y-1.5 px-2.5 pb-2.5 pt-1"
              role="status"
              aria-label={t('loadingNotifications')}
            >
              {[0, 1, 2].map((row) => (
                <div
                  key={row}
                  className="flex animate-pulse items-start gap-2.5 rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-2"
                >
                  <span className="h-8 w-8 flex-none rounded-lg bg-gray-100" />
                  <span className="min-w-0 flex-1 space-y-1.5 py-0.5">
                    <span className="block h-3 w-2/3 rounded bg-gray-100" />
                    <span className="block h-2.5 w-full rounded bg-gray-100" />
                    <span className="block h-2 w-1/4 rounded bg-gray-100" />
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          {!showSkeleton && !error && notifications.length === 0 ? (
            <div className="px-6 pb-7 pt-3 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-light text-primary ring-1 ring-inset ring-primary/15">
                <FiBell aria-hidden="true" className="h-5 w-5" />
              </span>
              <p className="mt-3 text-sm font-semibold text-ink">{t('allCaughtUp')}</p>
              <p className="mx-auto mt-1 max-w-[16rem] text-xs leading-relaxed text-muted">
                {t('notificationEmptyHint')}
              </p>
            </div>
          ) : null}

          {notifications.length > 0 ? (
            <ul className="max-h-[22rem] space-y-1.5 overflow-y-auto px-2.5 pb-2.5 pt-1">
              {notifications.map((notification) => {
                const { Icon, chipClass, labelClass, categoryKey } = notificationVisual(
                  notification.type,
                );
                const time = notificationTime(notification.created_at, locale);

                return (
                  <li key={notification.id}>
                    <button
                      type="button"
                      onClick={() => void openNotification(notification)}
                      className={`relative flex w-full items-start gap-2.5 overflow-hidden rounded-xl border px-3 py-2.5 text-left hover:-translate-y-px hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 motion-safe:transition-all ${
                        notification.is_read
                          ? 'border-gray-200/70 bg-gray-50/60 hover:border-gray-300 hover:bg-gray-50'
                          : 'border-primary/25 bg-primary-light/25 hover:border-primary/40 hover:bg-primary-light/40'
                      }`}
                    >
                      {!notification.is_read ? (
                        <span
                          aria-hidden="true"
                          className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-primary"
                        />
                      ) : null}

                      <span
                        aria-hidden="true"
                        className={`mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-lg ring-1 ring-inset ${chipClass}`}
                      >
                        <Icon className="h-[15px] w-[15px]" />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span
                            className={`line-clamp-1 text-[13px] leading-snug ${
                              notification.is_read
                                ? 'font-medium text-ink'
                                : 'font-semibold text-ink'
                            }`}
                          >
                            {notification.title}
                          </span>
                          <span
                            title={time.full}
                            className="flex-none text-[10px] font-medium text-subtle"
                          >
                            {t(time.key, { count: time.count })}
                          </span>
                        </span>

                        <span
                          title={notification.message}
                          className="mt-0.5 line-clamp-1 text-xs leading-snug text-gray-600"
                        >
                          {notification.message}
                        </span>

                        <span
                          className={`mt-1 flex items-center gap-1.5 font-semibold ${
                            locale === 'my' ? 'text-[11px] leading-[1.6]' : 'text-[10px] leading-none'
                          }`}
                        >
                          <span className={labelClass}>{t(categoryKey)}</span>
                          {!notification.is_read ? (
                            <>
                              <span
                                aria-hidden="true"
                                className="h-0.5 w-0.5 rounded-full bg-gray-300"
                              />
                              <span className="text-primary">{t('unread')}</span>
                            </>
                          ) : null}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}

          <Link
            to="/notifications"
            onClick={() => setOpen(false)}
            className="group flex items-center justify-between gap-2 border-t border-gray-100 bg-gray-50/70 px-4 py-3 text-xs font-semibold text-ink hover:bg-primary-light/60 hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary motion-safe:transition-colors"
          >
            {t('viewAllNotifications')}
            <FiArrowRight
              aria-hidden="true"
              className="h-4 w-4 text-subtle group-hover:text-primary motion-safe:transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        </div>
      ) : null}
    </div>
  );
}
