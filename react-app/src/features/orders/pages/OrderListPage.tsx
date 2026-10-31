/**
 * My Orders (Task 09).
 *
 * Orders are created only by accepting a quotation, so this page is a
 * read-only ledger. Status filtering and pagination run server-side; the
 * customer can open one order to see its frozen item, delivery and COD
 * snapshots.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowRight } from 'react-icons/fi';
import {
  Alert,
  EmptyState,
  LoadingPanel,
  PageHeader,
  Pagination,
  StatusBadge,
  describeCustomerLoadError,
  inputClass,
  linkClass,
  primaryButtonClass,
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
import { formatOrderDate, orderStatusLabel } from '../lib/orderDisplay';

const PER_PAGE = 10;

export default function OrderListPage() {
  const { locale, t } = useI18n();
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | ''>('');

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<LoadErrorState | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setLoadError(null);

      const response = await listOrders({
        page,
        per_page: PER_PAGE,
        status: statusFilter,
      });

      if (cancelled) return;

      if (response.success && response.data) {
        setOrders(response.data.orders);
        setMeta(response.data.meta);
      } else {
        setLoadError(describeCustomerLoadError(response, t('ordersLoadSubject')));
      }

      setIsLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [page, reloadToken, statusFilter, t]);

  const header = (
    <PageHeader title={t('myOrders')} description={t('ordersDescription')} />
  );

  const filter = (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-rule bg-plate p-4">
      <div>
        <label htmlFor="order-status-filter" className="block text-sm font-medium text-ink">
          {t('status')}
        </label>
        <select
          id="order-status-filter"
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value);
            setPage(1);
          }}
          className={`${inputClass(false)} mt-1 w-full sm:w-64`}
        >
          <option value="">{t('allStatuses')}</option>
          {ORDER_STATUSES.map((status) => (
            <option key={status} value={status}>
              {orderStatusLabel(status, t)}
            </option>
          ))}
        </select>
      </div>
      {statusFilter ? (
        <button
          type="button"
          onClick={() => {
            setStatusFilter('');
            setPage(1);
          }}
          className={linkClass}
        >
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

  if (isLoading && orders === null) {
    return (
      <div className="space-y-6">
        {header}
        <LoadingPanel label={t('loadingOrders')} />
      </div>
    );
  }

  const rows = orders ?? [];

  return (
    <div className="space-y-6">
      {header}
      {filter}

      {isLoading ? (
        <p className="px-1 text-xs text-gray-500" aria-live="polite">
          {t('refreshingOrders')}
        </p>
      ) : null}

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

      {!loadError && rows.length === 0 ? (
        <EmptyState
          title={statusFilter ? t('noOrdersForStatus') : t('noOrdersYet')}
          hint={statusFilter ? t('noOrdersForStatusHint') : t('noOrdersYetHint')}
        />
      ) : null}

      {rows.length > 0 ? (
        <section
          className="overflow-hidden rounded-lg border border-rule bg-plate"
          aria-busy={isLoading}
          aria-label={t('yourOrders')}
        >
          <ul className="divide-y divide-rule">
            {rows.map((order) => (
              <li key={order.id}>
                <Link
                  to={`/orders/${order.id}`}
                  className="flex flex-col gap-3 p-4 motion-safe:transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent sm:flex-row sm:items-center sm:justify-between sm:gap-6"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold tabular-nums text-ink">
                        {order.order_number}
                      </span>
                      <StatusBadge status={order.order_status} />
                    </div>
                    <p className="mt-1 text-sm text-gray-600">
                      {typeof order.item_count === 'number'
                        ? t('itemCount', {
                            count: order.item_count,
                            noun: order.item_count === 1 ? t('line') : t('lines'),
                          })
                        : t('order')}{' '}
                      · {t('placedOn', { date: formatOrderDate(order.created_at, locale, t) })}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {t('deliverToCity', { city: order.city })}
                      {order.township ? `, ${order.township}` : ''}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-4 sm:flex-none sm:justify-end">
                    <div className="text-left sm:text-right">
                      <p className="font-mono text-sm font-semibold tabular-nums text-ink">
                        {formatMMK(order.total_amount)} {t('mmk')}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 sm:justify-end">
                        <StatusBadge status={order.payment_status} />
                        <StatusBadge status={order.delivery_status} />
                      </div>
                    </div>
                    <FiArrowRight aria-hidden="true" className="h-4 w-4 flex-none text-gray-400" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {meta ? (
            <Pagination meta={meta} onPage={setPage} disabled={isLoading} />
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
