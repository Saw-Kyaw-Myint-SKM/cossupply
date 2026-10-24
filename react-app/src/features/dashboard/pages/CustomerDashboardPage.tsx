import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../lib/auth-context';
import {
  listQuotationRequests,
  type QuotationRequestSummary,
} from '../../quotations/api/quotationsApi';
import QuotationStatusBadge from '../../quotations/components/QuotationStatusBadge';
import {
  buildQuotationListMarkers,
  isActionable,
} from '../../quotations/lib/quotationView';
import { describeCustomerLoadError, linkClass } from '../../../components/catalog-ui/CatalogUi';

/**
 * Pick the quotation that most deserves the dashboard slot: the first
 * actionable SENT/VIEWED current version, else the newest row with any current
 * quotation (so accepted/expired history is still linkable).
 */
function pickDashboardQuotation(
  rows: QuotationRequestSummary[],
): QuotationRequestSummary | null {
  return (
    rows.find((row) => isActionable(row.current_status, row.is_expired)) ??
    rows.find(
      (row) =>
        row.current_quotation_id != null ||
        row.current_version != null ||
        Boolean(row.current_status),
    ) ??
    null
  );
}

/**
 * Customer Dashboard Page
 */
export default function CustomerDashboardPage() {
  const { user, logout } = useAuth();

  const [currentQuotation, setCurrentQuotation] =
    useState<QuotationRequestSummary | null>(null);
  const [quotationTotal, setQuotationTotal] = useState<number | null>(null);
  const [quotationLoading, setQuotationLoading] = useState(true);
  const [quotationError, setQuotationError] = useState<string | null>(null);
  const [quotationNeedsLogin, setQuotationNeedsLogin] = useState(false);
  const [quotationReload, setQuotationReload] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setQuotationLoading(true);
      setQuotationError(null);
      setQuotationNeedsLogin(false);

      const response = await listQuotationRequests({ page: 1, per_page: 20 });
      if (cancelled) return;

      if (response.success && response.data) {
        setCurrentQuotation(pickDashboardQuotation(response.data.quotation_requests));
        setQuotationTotal(response.data.meta.total);
      } else {
        const error = describeCustomerLoadError(response, 'your current quotation');
        setQuotationError(error.message);
        setQuotationNeedsLogin(error.needsLogin);
      }

      setQuotationLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [quotationReload]);

  const markers = currentQuotation ? buildQuotationListMarkers(currentQuotation) : null;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold text-ink mb-4">
          Welcome, {user?.name}!
        </h1>
        <p className="text-muted mb-4">
          This is your customer dashboard. From here you can manage your quotations and orders.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-ink mb-2">Quotations</h3>
          <p className="text-3xl font-bold text-ink">{quotationTotal ?? '—'}</p>
          <p className="text-sm text-subtle mt-1">Quotation requests</p>
          <Link to="/quotations" className="text-sm text-accent hover:text-accent/80 mt-2 inline-block">
            View all &rarr;
          </Link>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-ink mb-2">Orders</h3>
          <p className="text-3xl font-bold text-green-600">0</p>
          <p className="text-sm text-subtle mt-1">Total orders</p>
          <Link to="/orders" className="text-sm text-accent hover:text-accent/80 mt-2 inline-block">
            View all &rarr;
          </Link>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-ink mb-2">New Quotation</h3>
          <p className="text-muted text-sm mb-4">
            Add products to your order list and request a quotation.
          </p>
          <Link to="/cart" className="text-sm text-accent hover:text-accent/80">
            Open order list &rarr;
          </Link>
        </div>
      </div>

      {/* Current quotation: only shown from real list data, never fabricated. */}
      <section
        className="rounded-lg border border-rule bg-plate p-6"
        aria-labelledby="current-quotation-heading"
        aria-busy={quotationLoading}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="current-quotation-heading" className="text-lg font-semibold text-ink">
              Current quotation
            </h2>
            <p className="mt-1 text-sm text-muted">
              The quotation waiting for your review, if any.
            </p>
          </div>
          <Link to="/quotations" className={linkClass}>
            All quotations
          </Link>
        </div>

        {quotationLoading ? (
          <div className="mt-4 space-y-2" role="status" aria-live="polite">
            <span className="sr-only">Loading your current quotation…</span>
            <div aria-hidden="true" className="h-4 w-1/3 animate-pulse rounded bg-line motion-reduce:animate-none" />
            <div aria-hidden="true" className="h-3 w-1/2 animate-pulse rounded bg-paper motion-reduce:animate-none" />
          </div>
        ) : quotationError ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4" role="alert">
            <p className="text-sm text-red-800">{quotationError}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setQuotationReload((token) => token + 1)}
                className="rounded text-sm font-semibold text-red-800 underline underline-offset-2 hover:text-red-950 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                Try again
              </button>
              {quotationNeedsLogin ? (
                <Link to="/login" className={linkClass}>
                  Go to login
                </Link>
              ) : null}
            </div>
          </div>
        ) : currentQuotation ? (
          <div className="mt-4 rounded-lg border border-rule bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to={`/quotations/${currentQuotation.id}`}
                className="font-mono text-sm font-semibold text-ink tabular-nums underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
              >
                {currentQuotation.quotation_number}
              </Link>
              <QuotationStatusBadge status={currentQuotation.status} />
              {markers?.actionNeeded ? (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-600/20">
                  Action needed
                </span>
              ) : null}
              {markers?.expired ? (
                <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-600/20">
                  Expired
                </span>
              ) : null}
            </div>
            {markers?.hasCurrentVersion ? (
              <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm text-ink">
                <span>{markers.currentVersionLabel}</span>
                {currentQuotation.current_status ? (
                  <>
                    <span aria-hidden="true" className="text-subtle">
                      ·
                    </span>
                    <QuotationStatusBadge status={currentQuotation.current_status} />
                  </>
                ) : null}
                {markers.validityLabel ? (
                  <>
                    <span aria-hidden="true" className="text-subtle">
                      ·
                    </span>
                    <span className="text-xs text-subtle">{markers.validityLabel}</span>
                  </>
                ) : null}
              </p>
            ) : null}
            <Link
              to={`/quotations/${currentQuotation.id}`}
              className={`${linkClass} mt-3`}
            >
              {markers?.actionNeeded ? 'Review quotation' : 'View quotation'}
              <span aria-hidden="true"> →</span>
            </Link>
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-dashed border-rule p-4">
            <p className="text-sm font-medium text-ink">No quotation is waiting for you.</p>
            <p className="mt-1 text-sm text-subtle">
              Add products to your order list, then request a quotation to see it here.
            </p>
            <Link to="/cart" className={`${linkClass} mt-2`}>
              Open order list
            </Link>
          </div>
        )}
      </section>

      {/* Profile Info */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-ink mb-4">Profile Information</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-subtle">Name</dt>
            <dd className="mt-1 text-sm text-ink">{user?.name}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-subtle">Phone</dt>
            <dd className="mt-1 text-sm text-ink">{user?.phone}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-subtle">Email</dt>
            <dd className="mt-1 text-sm text-ink">{user?.email || 'Not provided'}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-subtle">Company</dt>
            <dd className="mt-1 text-sm text-ink">{user?.company_name || 'Not provided'}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-subtle">Account Type</dt>
            <dd className="mt-1 text-sm text-ink capitalize">{user?.customer_type}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-subtle">Status</dt>
            <dd className="mt-1">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                {user?.status}
              </span>
            </dd>
          </div>
        </dl>
        <div className="mt-6 pt-6 border-t border-rule">
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
