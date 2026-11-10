/**
 * My Orders (Task 09).
 *
 * Orders are created only by accepting a quotation, so this page is a
 * read-only ledger. Status filtering and pagination run server-side; the
 * customer can open one order to see its frozen item, delivery and COD
 * snapshots.
 *
 * The list is rendered as a grid of "order ticket" cards instead of table
 * rows: each card carries its status at a glance (badge, left status stripe
 * and a four-step progress track) while staying one single link target.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowRight, FiFilter, FiMapPin, FiX } from 'react-icons/fi';
import {
  Alert,
  EmptyState,
  PageHeader,
  StatusBadge,
  describeCustomerLoadError,
  linkClass,
  primaryButtonClass,
  secondaryButtonClass,
  type LoadErrorState,
} from '../../../components/catalog-ui/CatalogUi';
import type { PaginationMeta } from '../../../api/query';
import { useI18n } from '../../../lib/i18n-context';
import { formatMMK } from '../../../lib/money';
import {
  ORDER_STATUSES,
  listOrders,
  type OrderStatus,
  type OrderSummary,
} from '../api/ordersApi';
import {
  formatOrderDate,
  orderProgress,
  orderStatusHint,
  orderStatusLabel,
  ORDER_PROGRESS_STEP_KEYS,
  type OrderProgressTone,
} from '../lib/orderDisplay';

const PER_PAGE = 9;
const SKELETON_COUNT = 6;

/** The 3px left stripe encodes the status family, not decoration. */
const STATUS_STRIPE_CLASSES: Record<OrderProgressTone, string> = {
  progress: 'bg-primary',
  done: 'bg-success',
  issue: 'bg-error',
  muted: 'bg-line',
};

/**
 * Four-step track. `stage` is the number of steps already reached, so the
 * card fills the first N dots without needing to know the current status.
 */
function ProgressTrack({
  stage,
  tone,
  label,
}: {
  stage: number;
  tone: OrderProgressTone;
  label: string;
}) {
  const { t } = useI18n();
  const reachedDot = tone === 'done' ? 'border-success bg-success' : 'border-primary bg-primary';
  const reachedLine = tone === 'done' ? 'bg-success' : 'bg-primary';

  return (
    <ol aria-label={label} className="flex items-start">
      {ORDER_PROGRESS_STEP_KEYS.map((key, index) => {
        const isReached = index < stage;
        const isNext = tone === 'progress' && index === stage;

        return (
          <li key={key} className="relative flex flex-1 flex-col items-center text-center">
            {index > 0 ? (
              <span
                aria-hidden="true"
                className={`absolute right-1/2 top-[5px] h-0.5 w-full -translate-y-1/2 ${
                  index < stage ? reachedLine : 'bg-line/60'
                }`}
              />
            ) : null}
            <span
              aria-hidden="true"
              className={`relative z-10 h-2.5 w-2.5 rounded-full border-2 ${
                isReached
                  ? reachedDot
                  : isNext
                    ? 'border-primary bg-white ring-4 ring-primary/15'
                    : 'border-line bg-white'
              }`}
            />
            <span
              className={`mt-1.5 text-[11px] leading-snug ${
                isReached
                  ? 'font-semibold text-ink'
                  : isNext
                    ? 'font-medium text-primary'
                    : 'text-subtle'
              }`}
            >
              {t(key)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function OrderCardSkeleton() {
  return (
    <li aria-hidden="true" className="glass-card flex flex-col p-5 pl-6">
      <div className="flex items-baseline justify-between gap-3">
        <div className="h-4 w-28 animate-pulse rounded bg-line/70" />
        <div className="h-3 w-20 animate-pulse rounded bg-paper" />
      </div>
      <div className="mt-3 h-5 w-24 animate-pulse rounded-full bg-paper" />
      <div className="mt-3 space-y-2">
        <div className="h-3 w-full animate-pulse rounded bg-paper" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-paper" />
      </div>
      <div className="mt-4 h-[4.25rem] animate-pulse rounded-xl bg-paper" />
      <div className="mt-4 h-3 w-1/2 animate-pulse rounded bg-paper" />
      <div className="mt-5 flex items-center gap-1.5">
        <div className="h-5 w-24 animate-pulse rounded-full bg-paper" />
        <div className="h-5 w-24 animate-pulse rounded-full bg-paper" />
      </div>
      <div className="mt-auto flex items-end justify-between gap-3 border-t border-line/50 pt-3">
        <div className="h-6 w-28 animate-pulse rounded bg-line/70" />
        <div className="h-4 w-20 animate-pulse rounded bg-paper" />
      </div>
    </li>
  );
}

export default function OrderListPage() {
  const { locale, t } = useI18n();
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | ''>('');

  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<LoadErrorState | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  // The translator changes with the locale. Keep the latest one readable from
  // async callbacks without re-running the query on a language switch, since
  // the order data itself is locale-independent.
  const tRef = useRef(t);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  // Every reset starts a new generation, so a late response from the previous
  // filter can never append into the new list.
  const generationRef = useRef(0);
  const loadingMoreRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const generation = ++generationRef.current;
    let cancelled = false;

    loadingMoreRef.current = false;
    setIsLoading(true);
    setIsLoadingMore(false);
    setLoadError(null);
    setLoadMoreError(null);
    setOrders(null);
    setMeta(null);

    void listOrders({ page: 1, per_page: PER_PAGE, status: statusFilter }).then((response) => {
      if (cancelled || generation !== generationRef.current) return;

      if (response.success && response.data) {
        setOrders(response.data.orders);
        setMeta(response.data.meta);
      } else {
        setLoadError(describeCustomerLoadError(response, tRef.current('ordersLoadSubject')));
      }

      setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [statusFilter, reloadToken]);

  const hasMore = meta !== null && meta.current_page < meta.last_page;

  const loadMore = useCallback(() => {
    if (loadingMoreRef.current || !meta || meta.current_page >= meta.last_page) return;
    if (isLoading || loadError) return;

    loadingMoreRef.current = true;
    const generation = generationRef.current;
    const nextPage = meta.current_page + 1;

    setIsLoadingMore(true);
    setLoadMoreError(null);

    void listOrders({ page: nextPage, per_page: PER_PAGE, status: statusFilter }).then(
      (response) => {
        if (generation !== generationRef.current) return;

        loadingMoreRef.current = false;
        setIsLoadingMore(false);

        if (response.success && response.data) {
          const nextOrders = response.data.orders;

          setOrders((current) => {
            const seen = new Set((current ?? []).map((order) => order.id));
            return [...(current ?? []), ...nextOrders.filter((order) => !seen.has(order.id))];
          });
          setMeta(response.data.meta);
        } else {
          setLoadMoreError(
            describeCustomerLoadError(response, tRef.current('ordersLoadSubject')).message,
          );
        }
      },
    );
  }, [isLoading, loadError, meta, statusFilter]);

  // Infinite scroll: request the next page as soon as the sentinel nears the
  // viewport. The visible button in the footer stays as a keyboard and
  // screen-reader fallback (and as the retry action after an error).
  useEffect(() => {
    const node = sentinelRef.current;

    if (node === null || !hasMore || isLoading || isLoadingMore || loadMoreError) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore();
      },
      { rootMargin: '320px 0px' },
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [hasMore, isLoading, isLoadingMore, loadMore, loadMoreError]);

  const header = (
    <PageHeader title={t('myOrders')} description={t('ordersDescription')} />
  );

  const filter = (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <label
        htmlFor="order-status-filter"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink"
      >
        <FiFilter aria-hidden="true" className="h-4 w-4 text-primary" />
        {t('status')}
      </label>
      <select
        id="order-status-filter"
        value={statusFilter}
        onChange={(event) => {
          setStatusFilter(event.target.value);
        }}
        className="w-full rounded-full border border-line/60 bg-white/75 py-2 pl-4 pr-9 text-sm font-medium text-ink shadow-sm backdrop-blur transition-colors hover:border-primary/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 sm:w-auto sm:min-w-56"
      >
        <option value="">{t('allStatuses')}</option>
        {ORDER_STATUSES.map((status) => (
          <option key={status} value={status}>
            {orderStatusLabel(status, t)}
          </option>
        ))}
      </select>
      {statusFilter ? (
        <button
          type="button"
          onClick={() => {
            setStatusFilter('');
          }}
          className="inline-flex items-center gap-1 rounded-full bg-primary-light px-3 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <FiX aria-hidden="true" className="h-3.5 w-3.5" />
          {t('clearFilter')}
        </button>
      ) : null}
    </div>
  );

  if (loadError && (loadError.needsLogin || orders === null)) {
    return (
      <div className="space-y-6">
        {header}
        <Alert tone="error">
          <div>
            <p className="font-semibold">{t('ordersUnavailable')}</p>
            <p className="mt-1">{loadError.message}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setReloadToken((token) => token + 1)}
                className={primaryButtonClass}
              >
                {t('tryAgain')}
              </button>
              {loadError.needsLogin ? (
                <Link to="/login" className={linkClass}>
                  {t('goToLogin')}
                </Link>
              ) : null}
            </div>
          </div>
        </Alert>
      </div>
    );
  }

  const showSkeletons = isLoading && orders === null;
  const rows = orders ?? [];

  return (
    <div className="space-y-6">
      {header}
      {filter}

      {loadError ? (
        <Alert tone="warning">
          <div>
            <p>{loadError.message}</p>
            <button
              type="button"
              onClick={() => setReloadToken((token) => token + 1)}
              className={`${primaryButtonClass} mt-3`}
            >
              {t('reloadOrders')}
            </button>
          </div>
        </Alert>
      ) : null}

      {showSkeletons ? (
        <ul
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
          aria-busy="true"
          aria-label={t('loadingOrders')}
        >
          {Array.from({ length: SKELETON_COUNT }, (_, index) => (
            <OrderCardSkeleton key={index} />
          ))}
        </ul>
      ) : null}

      {!showSkeletons && !loadError && rows.length === 0 ? (
        <EmptyState
          title={statusFilter ? t('noOrdersForStatus') : t('noOrdersYet')}
          hint={statusFilter ? t('noOrdersForStatusHint') : t('noOrdersYetHint')}
        />
      ) : null}

      {!showSkeletons && rows.length > 0 ? (
        <section
          aria-busy={isLoading || isLoadingMore}
          aria-label={t('yourOrders')}
          className="space-y-4"
        >
          <ul role="list" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((order) => {
              const progress = orderProgress(order.order_status);

              return (
                <li key={order.id}>
                  <Link
                    to={`/orders/${order.id}`}
                    className="glass-card glass-card-hover group relative flex h-full flex-col overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-[.99]"
                  >
                    <span
                      aria-hidden="true"
                      className={`absolute inset-y-0 left-0 w-[3px] ${STATUS_STRIPE_CLASSES[progress.tone]}`}
                    />

                    <div className="flex flex-1 flex-col p-5 pl-6">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <span className="font-mono text-sm font-semibold tabular-nums tracking-tight text-ink">
                          {order.order_number}
                        </span>
                        <span className="text-xs text-subtle">
                          {t('placedOn', {
                            date: formatOrderDate(order.created_at, locale, t),
                          })}
                        </span>
                      </div>

                      <div className="mt-2.5">
                        <StatusBadge status={order.order_status} />
                      </div>

                      <p className="mt-2 text-sm leading-relaxed text-muted">
                        {orderStatusHint(order.order_status, t)}
                      </p>

                      {progress.stage !== null ? (
                        <div className="mt-4 rounded-xl border border-line/40 bg-white/50 px-3 py-2.5">
                          <ProgressTrack
                            stage={progress.stage}
                            tone={progress.tone}
                            label={t('orderStatus')}
                          />
                        </div>
                      ) : null}

                      <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                        <FiMapPin aria-hidden="true" className="h-3.5 w-3.5 flex-none text-primary" />
                        <span className="font-medium text-ink">
                          {t('deliverToCity', { city: order.city })}
                          {order.township ? `, ${order.township}` : ''}
                        </span>
                        <span aria-hidden="true" className="text-line">
                          •
                        </span>
                        <span>
                          {typeof order.item_count === 'number'
                            ? t('itemCount', {
                                count: order.item_count,
                                noun: order.item_count === 1 ? t('line') : t('lines'),
                              })
                            : t('order')}
                        </span>
                      </div>

                      <div className="mt-auto pt-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <StatusBadge status={order.payment_status} />
                          <StatusBadge status={order.delivery_status} />
                        </div>

                        <div className="mt-3 flex items-end justify-between gap-3 border-t border-line/50 pt-3">
                          <div>
                            <p className="text-[11px] font-medium text-subtle">{t('total')}</p>
                            <p className="mt-0.5 font-mono text-lg font-bold tabular-nums text-ink">
                              {formatMMK(order.total_amount)}
                              <span className="ml-1 text-xs font-semibold text-muted">
                                {t('mmk')}
                              </span>
                            </p>
                          </div>
                          <span className="inline-flex items-center gap-1 pb-0.5 text-sm font-semibold text-primary">
                            {t('viewOrder')}
                            <FiArrowRight
                              aria-hidden="true"
                              className="h-4 w-4 motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5"
                            />
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>

          <div
            ref={sentinelRef}
            className="flex flex-col items-center gap-3 pt-2 pb-2 text-center"
          >
            {loadMoreError ? (
              <Alert tone="warning">
                <div>
                  <p>{loadMoreError}</p>
                  <button
                    type="button"
                    onClick={loadMore}
                    className={`${primaryButtonClass} mt-3`}
                  >
                    {t('tryAgain')}
                  </button>
                </div>
              </Alert>
            ) : isLoadingMore ? (
              <>
                <div
                  className="h-8 w-8 animate-spin rounded-full border-2 border-primary/20 border-b-primary motion-reduce:animate-none"
                  aria-hidden="true"
                />
                <p className="text-sm text-muted" role="status" aria-live="polite">
                  {t('loadingMoreOrders')}
                </p>
              </>
            ) : hasMore ? (
              <button type="button" onClick={loadMore} className={secondaryButtonClass}>
                {t('loadMoreOrders')}
              </button>
            ) : (
              <p className="w-full border-t border-line/50 pt-4 text-sm text-muted">
                {t('allOrdersLoaded')}
              </p>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
