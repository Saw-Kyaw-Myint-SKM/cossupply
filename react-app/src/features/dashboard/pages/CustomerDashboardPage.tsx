import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../lib/auth-context';
import { listQuotationRequests, type QuotationRequestSummary } from '../../quotations/api/quotationsApi';
import { listOrders } from '../../orders/api/ordersApi';
import { StatusBadge, linkClass, secondaryButtonClass } from '../../../components/catalog-ui/CatalogUi';
import { formatMMK } from '../../../lib/money';

const CLOSED_STATUSES = ['ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED'];

/**
 * Customer dashboard.
 *
 * Quotations and orders are both live from Tasks 08–09: the cards count open
 * requests and total orders, and the recent-quotations list links straight to
 * a sent quotation.
 */
export default function CustomerDashboardPage() {
  const { user, logout } = useAuth();

  const [requests, setRequests] = useState<QuotationRequestSummary[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [orderCount, setOrderCount] = useState<number | null>(null);
  const [orderCountError, setOrderCountError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setLoadError(null);

      const response = await listQuotationRequests({ page: 1, per_page: 100 });

      if (cancelled) return;

      if (response.success && response.data) {
        setRequests(response.data.quotation_requests);
      } else {
        setLoadError(
          response.status === 401
            ? 'Your session expired. Sign in again to see your quotations.'
            : response.message ?? 'Could not load your quotations.',
        );
      }

      setIsLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  useEffect(() => {
    let cancelled = false;

    const loadOrders = async () => {
      setOrderCountError(null);

      const response = await listOrders({ page: 1, per_page: 1 });

      if (cancelled) return;

      if (response.success && response.data) {
        setOrderCount(response.data.meta.total);
      } else {
        setOrderCountError(
          response.status === 401
            ? 'Your session expired. Sign in again to see your orders.'
            : response.message ?? 'Could not load your orders.',
        );
      }
    };

    void loadOrders();

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const openRequests =
    requests?.filter((request) => !CLOSED_STATUSES.includes(request.status)) ?? [];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Welcome, {user?.name}!
        </h1>
        <p className="text-gray-600 mb-4">
          This is your customer dashboard. From here you can manage your quotations and orders.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Quotations</h3>
          <p className="text-3xl font-bold text-ink">{isLoading && requests === null ? '…' : openRequests.length}</p>
          <p className="text-sm text-gray-500 mt-1">Active quotations</p>
          <Link to="/quotations" className="text-sm text-accent hover:text-accent/80 mt-2 inline-block">
            View all &rarr;
          </Link>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Orders</h3>
          <p className="text-3xl font-bold text-green-600">
            {orderCount === null ? '…' : orderCount}
          </p>
          <p className="text-sm text-gray-500 mt-1">Total orders</p>
          {orderCountError ? (
            <p className="text-xs text-red-700 mt-1" role="alert">
              {orderCountError}
            </p>
          ) : null}
          <Link to="/orders" className="text-sm text-accent hover:text-accent/80 mt-2 inline-block">
            View all &rarr;
          </Link>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">New Quotation</h3>
          <p className="text-gray-600 text-sm mb-4">
            Add products to your order list and request a quotation.
          </p>
          <Link to="/cart" className="text-sm text-accent hover:text-accent/80">
            Open order list &rarr;
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Recent quotations</h2>
          <Link to="/quotations" className={linkClass}>
            All quotations
          </Link>
        </div>

        {isLoading && requests === null ? (
          <p className="text-sm text-gray-500" role="status" aria-live="polite">
            Loading your quotations…
          </p>
        ) : null}

        {loadError ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
            <p>{loadError}</p>
            <button
              type="button"
              onClick={() => setReloadToken((token) => token + 1)}
              className={`${secondaryButtonClass} mt-3`}
            >
              Try again
            </button>
          </div>
        ) : null}

        {!isLoading && !loadError && requests !== null && requests.length === 0 ? (
          <p className="text-sm text-gray-500">
            No quotations yet. Add products to your order list, then request a quotation.
          </p>
        ) : null}

        {requests !== null && requests.length > 0 ? (
          <ul className="divide-y divide-gray-200">
            {requests.slice(0, 3).map((request) => (
              <li key={request.id}>
                <Link
                  to={`/quotations/${request.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 hover:text-ink focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
                >
                  <div>
                    <p className="font-mono text-sm font-semibold text-ink">
                      {request.quotation_number}
                    </p>
                    <p className="text-xs text-gray-500">
                      {request.item_count} {request.item_count === 1 ? 'line' : 'lines'} ·{' '}
                      {new Date(request.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    {request.current_quotation ? (
                      <p className="font-mono text-sm tabular-nums text-ink">
                        {formatMMK(request.current_quotation.total_amount)} MMK
                      </p>
                    ) : null}
                    <StatusBadge status={request.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {/* Profile Info */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Profile Information</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Name</dt>
            <dd className="mt-1 text-sm text-gray-900">{user?.name}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Phone</dt>
            <dd className="mt-1 text-sm text-gray-900">{user?.phone}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Email</dt>
            <dd className="mt-1 text-sm text-gray-900">{user?.email || 'Not provided'}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Company</dt>
            <dd className="mt-1 text-sm text-gray-900">{user?.company_name || 'Not provided'}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Account Type</dt>
            <dd className="mt-1 text-sm text-gray-900 capitalize">{user?.customer_type}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Status</dt>
            <dd className="mt-1">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                {user?.status}
              </span>
            </dd>
          </div>
        </dl>
        <div className="mt-6 pt-6 border-t border-gray-200">
          <button
            onClick={logout}
            className="text-sm text-red-600 hover:text-red-800"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
