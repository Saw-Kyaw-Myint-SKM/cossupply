/**
 * Admin order queue (Task 09).
 *
 * The first operational screen after a customer accepts a quotation. Status and
 * search filters run server-side; every row opens the supplier-confirmation
 * detail. No delivery or payment actions live here — those arrive in Task 10.
 */
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  Alert,
  EmptyState,
  LoadingPanel,
  PageHeader,
  Pagination,
  describeLoadError,
  inputClass,
  linkClass,
  primaryButtonClass,
  secondaryButtonClass,
  type LoadErrorState,
} from '../../../components/catalog-ui/CatalogUi';
import { formatMMK } from '../../../lib/money';
import type { PaginationMeta } from '../../../api/query';
import {
  listAdminOrders,
  type AdminOrderSummary,
} from '../api/ordersApi';
import OrderStatusBadge from '../components/OrderStatusBadge';
import {
  ORDER_STATUSES,
  formatOrderDate,
  orderStatusLabel,
} from '../lib/orderStatus';

const PER_PAGE = 15;

export default function OrderListPage() {
  const [orders, setOrders] = useState<AdminOrderSummary[] | null>(null);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<LoadErrorState | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setLoadError(null);

      const response = await listAdminOrders({
        page,
        per_page: PER_PAGE,
        order_status: status || undefined,
        search: search || undefined,
      });

      if (cancelled) return;

      if (response.success && response.data) {
        setOrders(response.data.orders);
        setMeta(response.data.meta);

        if (
          response.data.orders.length === 0 &&
          page > 1 &&
          response.data.meta.last_page < page
        ) {
          setPage(Math.max(response.data.meta.last_page, 1));
        }
      } else {
        setLoadError(describeLoadError(response, 'the order queue'));
      }

      setLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [page, status, search, reloadToken]);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  };

  const clearFilters = () => {
    setSearchInput('');
    setSearch('');
    setStatus('');
    setPage(1);
  };

  const hasFilters = search !== '' || status !== '';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders"
        description="Accepted quotations become orders here. Confirm supplier availability, then move confirmed orders into preparation."
        action={
          <div className="flex flex-wrap gap-2">
            <Link to="/admin/quotations" className={secondaryButtonClass}>
              Quotation queue
            </Link>
            <Link to="/admin/dashboard" className={secondaryButtonClass}>
              Admin dashboard
            </Link>
          </div>
        }
      />

      <section
        className="rounded-lg border border-rule bg-plate p-4"
        aria-label="Filter orders"
      >
        <form
          onSubmit={submitSearch}
          className="grid gap-3 md:grid-cols-[minmax(0,1fr)_240px_auto]"
        >
          <div>
            <label htmlFor="order-search" className="block text-sm font-medium text-gray-900">
              Search
            </label>
            <input
              id="order-search"
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Order number, quotation number, customer, phone"
              maxLength={100}
              className={`${inputClass(false)} mt-1`}
            />
          </div>

          <div>
            <label htmlFor="order-status" className="block text-sm font-medium text-gray-900">
              Order status
            </label>
            <select
              id="order-status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              className={`${inputClass(false)} mt-1`}
            >
              <option value="">All statuses</option>
              {ORDER_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {orderStatusLabel(value)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end gap-2">
            <button type="submit" className={primaryButtonClass}>
              Filter
            </button>
            {hasFilters ? (
              <button type="button" onClick={clearFilters} className={secondaryButtonClass}>
                Clear
              </button>
            ) : null}
          </div>
        </form>
      </section>

      {loadError ? (
        <Alert tone="error">
          <p>{loadError.message}</p>
          {loadError.needsLogin ? (
            <Link to="/admin/login" className={`${linkClass} mt-2`}>
              Sign in again
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

      {loading ? (
        <LoadingPanel label="Loading orders" />
      ) : orders && orders.length === 0 ? (
        <EmptyState
          title={hasFilters ? 'No orders match these filters' : 'No orders yet'}
          hint={
            hasFilters
              ? 'Try a different status or search term.'
              : 'Orders appear here automatically after a customer accepts a quotation.'
          }
        />
      ) : orders ? (
        <section className="overflow-hidden rounded-lg border border-rule bg-plate">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule px-4 py-3">
            <h2 className="text-base font-semibold text-ink">Order queue</h2>
            <p className="text-sm text-gray-600" aria-live="polite">
              {meta
                ? `${meta.total.toLocaleString('en-US')} ${
                    meta.total === 1 ? 'order' : 'orders'
                  }`
                : `${orders.length} shown`}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-rule text-sm">
              <caption className="sr-only">Orders matching the current filters</caption>
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    Order
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Customer
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Order status
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Payment
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Delivery
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Total
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Created
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Open
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {orders.map((order) => (
                  <tr key={order.id} className="align-top hover:bg-gray-50/70">
                    <td className="whitespace-nowrap px-4 py-3">
                      <Link
                        to={`/admin/orders/${order.id}`}
                        className="font-medium text-ink hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
                      >
                        {order.order_number}
                      </Link>
                      <p className="mt-0.5 text-xs text-gray-500">{order.quotation_number}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{order.customer_name}</p>
                      <p className="text-xs text-gray-500">{order.phone}</p>
                    </td>
                    <td className="px-4 py-3">
                      <OrderStatusBadge status={order.order_status} />
                    </td>
                    <td className="px-4 py-3">
                      <OrderStatusBadge kind="payment" status={order.payment_status} />
                    </td>
                    <td className="px-4 py-3">
                      <OrderStatusBadge kind="delivery" status={order.delivery_status} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums font-medium text-ink">
                      {formatMMK(order.total_amount)} MMK
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                      <time dateTime={order.created_at}>{formatOrderDate(order.created_at)}</time>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link to={`/admin/orders/${order.id}`} className={linkClass}>
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {meta ? <Pagination meta={meta} onPage={setPage} disabled={loading} /> : null}
        </section>
      ) : null}
    </div>
  );
}
