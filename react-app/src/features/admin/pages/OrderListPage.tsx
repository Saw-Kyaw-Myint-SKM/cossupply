/**
 * Admin order queue (Task 09).
 *
 * Entry point to the supplier-confirmation workflow. Status, payment status
 * and text filters all run server-side. The list shows the frozen order
 * snapshot only; actions live on the detail page.
 */
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  Alert,
  EmptyState,
  LoadingPanel,
  PageHeader,
  Pagination,
  StatusBadge,
  describeLoadError,
  formatStatusLabel,
  inputClass,
  linkClass,
  primaryButtonClass,
  secondaryButtonClass,
  type LoadErrorState,
} from '../../../components/catalog-ui/CatalogUi';
import type { PaginationMeta } from '../../../api/query';
import { formatMMK } from '../../../lib/money';
import { listAdminOrders } from '../api/orderAdminApi';
import { ORDER_STATUSES, PAYMENT_STATUSES } from '../../orders/api/ordersApi';
import type { OrderStatus, OrderSummary, PaymentStatus } from '../../orders/api/ordersApi';
import { formatOrderDate } from '../../orders/lib/orderDisplay';

const PER_PAGE = 15;

export default function OrderListPage() {
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | ''>('');
  const [paymentFilter, setPaymentFilter] = useState<PaymentStatus | ''>('');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<LoadErrorState | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setLoadError(null);

      const response = await listAdminOrders({
        page,
        per_page: PER_PAGE,
        status: statusFilter,
        payment_status: paymentFilter,
        search: appliedSearch,
      });

      if (cancelled) return;

      if (response.success && response.data) {
        setOrders(response.data.orders);
        setMeta(response.data.meta);
      } else {
        setLoadError(describeLoadError(response, 'orders'));
      }

      setIsLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [page, statusFilter, paymentFilter, appliedSearch, reloadToken]);

  const resetFilters = () => {
    setStatusFilter('');
    setPaymentFilter('');
    setSearch('');
    setAppliedSearch('');
    setPage(1);
  };

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setAppliedSearch(search.trim());
    setPage(1);
  };

  const hasFilters = statusFilter !== '' || paymentFilter !== '' || appliedSearch !== '';

  const header = (
    <PageHeader
      title="Orders"
      description="Orders created from accepted quotations. Confirm supplier availability before preparation starts."
    />
  );

  if (loadError && (loadError.needsLogin || orders === null)) {
    return (
      <div className="space-y-6">
        {header}
        <Alert tone="error">
          <div>
            <p className="font-semibold">Orders are unavailable</p>
            <p className="mt-1">{loadError.message}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setReloadToken((token) => token + 1)}
                className={primaryButtonClass}
              >
                Try again
              </button>
              {loadError.needsLogin ? (
                <Link to="/admin/login" className={linkClass}>
                  Go to admin login
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
        <LoadingPanel label="Loading orders…" />
      </div>
    );
  }

  const rows = orders ?? [];

  return (
    <div className="space-y-6">
      {header}

      <form
        onSubmit={submitSearch}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-rule bg-plate p-4"
      >
        <div className="min-w-0 flex-1 sm:max-w-xs">
          <label htmlFor="order-search" className="block text-sm font-medium text-ink">
            Search
          </label>
          <input
            id="order-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            maxLength={100}
            placeholder="Order number, customer, phone…"
            className={`${inputClass(false)} mt-1`}
          />
        </div>

        <div>
          <label htmlFor="order-status" className="block text-sm font-medium text-ink">
            Order status
          </label>
          <select
            id="order-status"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
            className={`${inputClass(false)} mt-1 w-full sm:w-56`}
          >
            <option value="">All statuses</option>
            {ORDER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {formatStatusLabel(status)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="order-payment-status" className="block text-sm font-medium text-ink">
            Payment status
          </label>
          <select
            id="order-payment-status"
            value={paymentFilter}
            onChange={(event) => {
              setPaymentFilter(event.target.value);
              setPage(1);
            }}
            className={`${inputClass(false)} mt-1 w-full sm:w-52`}
          >
            <option value="">All payments</option>
            {PAYMENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {formatStatusLabel(status)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button type="submit" className={primaryButtonClass}>
            Search
          </button>
          {hasFilters ? (
            <button type="button" onClick={resetFilters} className={secondaryButtonClass}>
              Clear
            </button>
          ) : null}
        </div>
      </form>

      {isLoading ? (
        <p className="px-1 text-xs text-gray-500" aria-live="polite">
          Refreshing orders…
        </p>
      ) : null}

      {loadError ? (
        <Alert tone="warning">
          <div>
            <p>{loadError.message}</p>
            <button
              type="button"
              onClick={() => setReloadToken((token) => token + 1)}
              className={`${secondaryButtonClass} mt-2`}
            >
              Reload orders
            </button>
          </div>
        </Alert>
      ) : null}

      {!loadError && rows.length === 0 ? (
        <EmptyState
          title={hasFilters ? 'No orders match these filters' : 'No orders yet'}
          hint={
            hasFilters
              ? 'Clear the filters or search for a different order number.'
              : 'An order appears here as soon as a customer accepts a quotation.'
          }
        />
      ) : null}

      {rows.length > 0 ? (
        <section
          className="overflow-hidden rounded-lg border border-rule bg-plate"
          aria-busy={isLoading}
          aria-label="Order queue"
        >
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-rule text-sm">
              <thead className="bg-paper text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Order
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Customer
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Total
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Placed
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {rows.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link
                        to={`/admin/orders/${order.id}`}
                        className="font-mono font-semibold tabular-nums text-ink hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
                      >
                        {order.order_number}
                      </Link>
                      <p className="text-xs text-gray-500">
                        {typeof order.item_count === 'number'
                          ? `${order.item_count} ${order.item_count === 1 ? 'line' : 'lines'}`
                          : 'Order'}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-ink">{order.customer_name}</p>
                      <p className="text-xs text-gray-500">{order.phone}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <StatusBadge status={order.order_status} />
                        <StatusBadge status={order.payment_status} />
                        <StatusBadge status={order.delivery_status} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-ink">
                      {formatMMK(order.total_amount)} MMK
                    </td>
                    <td className="px-4 py-3 text-gray-600">{formatOrderDate(order.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {meta ? <Pagination meta={meta} onPage={setPage} disabled={isLoading} /> : null}
        </section>
      ) : null}
    </div>
  );
}
