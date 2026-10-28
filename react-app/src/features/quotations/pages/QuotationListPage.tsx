/**
 * My Quotations list (Task 06 foundation).
 *
 * Paginated list of the authenticated customer's quotation requests. Each row
 * links to `/quotations/{id}`, which is the Task 08 detail placeholder — the
 * link already routes correctly so the navigation contract does not have to
 * change later. Approved decisions: notifications are deferred to Task 11,
 * and the ledger keeps the same loading / empty / permission-error contract
 * as every other list (Definition of Done).
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listQuotationRequests, type QuotationRequestSummary } from '../api/quotationsApi';
import {
  EmptyState,
  LoadingPanel,
  PageHeader,
  Pagination,
  StatusBadge,
  describeCustomerLoadError,
  linkClass,
  primaryButtonClass,
  type LoadErrorState,
} from '../../../components/catalog-ui/CatalogUi';
import type { PaginationMeta } from '../../../api/query';
import { formatMMK } from '../../../lib/money';

const PER_PAGE = 10;

/**
 * "Oct 19, 2026, 2:45 PM"-style stamp; list pages elsewhere use the
 * browser default formatting (AdminDashboardPage), so keep that.
 */
function formatRequestDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

/** Date-only validity values stay on their calendar day in every timezone. */
function formatDateOnly(value: string): string {
  const [year, month, day] = value.split('-').map(Number);

  if (!year || !month || !day) return value;

  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function QuotationListPage() {
  const [requests, setRequests] = useState<QuotationRequestSummary[] | null>(null);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<LoadErrorState | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setLoadError(null);

      const response = await listQuotationRequests({ page, per_page: PER_PAGE });

      if (cancelled) return;

      if (response.success && response.data) {
        setRequests(response.data.quotation_requests);
        setMeta(response.data.meta);
      } else {
        setLoadError(describeCustomerLoadError(response, 'your quotations'));
      }

      setIsLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [page, reloadToken]);

  const header = (
    <PageHeader
      title="My quotations"
      description="Requests submitted from your order list. Open one to review the final quotation, accept it, or ask for a change."
    />
  );

  // Permission problems (expired customer token) get the retry-or-login panel.
  if (loadError && (loadError.needsLogin || requests === null)) {
    return (
      <div className="space-y-6">
        {header}
        <div className="rounded-lg border border-red-200 bg-red-50 p-6" role="alert">
          <h2 className="text-lg font-semibold text-red-800">Quotations are unavailable</h2>
          <p className="mt-1 text-sm text-red-700">{loadError.message}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setReloadToken((token) => token + 1)}
              className={primaryButtonClass}
            >
              Try again
            </button>
            {loadError.needsLogin ? (
              <Link to="/login" className={linkClass}>
                Go to login
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  if (isLoading && requests === null) {
    return (
      <div className="space-y-6">
        {header}
        <LoadingPanel label="Loading your quotations…" />
      </div>
    );
  }

  const rows = requests ?? [];

  if (rows.length === 0) {
    return (
      <div className="space-y-6">
        {header}
        <EmptyState
          title="No quotation requests yet"
          hint="Add products to your order list, then request a quotation — it shows up here."
        />
        <div className="text-center">
          <Link to="/cart" className={`${primaryButtonClass} inline-block`}>
            Open your order list
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

      {isLoading && rows.length > 0 ? (
        <p className="px-1 text-xs text-gray-500" aria-live="polite">
          Refreshing…
        </p>
      ) : null}

      <section
        className="rounded-lg border border-rule bg-plate"
        aria-busy={isLoading}
        aria-label="Quotation requests"
      >
        <ul className="divide-y divide-rule">
          {rows.map((row) => (
            <li key={row.id}>
              <Link
                to={`/quotations/${row.id}`}
                className="flex flex-col gap-2 p-4 motion-safe:transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-ink tabular-nums">
                      {row.quotation_number}
                    </span>
                    <StatusBadge status={row.status} />
                  </div>
                  <p className="mt-1 text-sm text-gray-600">
                    {row.customer_name} · {row.city}
                    {row.township ? `, ${row.township}` : ''}
                  </p>
                  <p className="text-xs text-gray-500 sm:sr-only">{row.phone}</p>
                </div>

                <div className="flex-none text-left sm:text-right">
                  {row.current_quotation ? (
                    <>
                      <p className="font-mono text-sm font-semibold tabular-nums text-ink">
                        {formatMMK(row.current_quotation.total_amount)} MMK
                      </p>
                      <p className="text-xs text-gray-500">
                        Version {row.current_quotation.version}
                        {row.current_quotation.valid_until
                          ? ` · valid until ${formatDateOnly(row.current_quotation.valid_until)}`
                          : ''}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-gray-700">
                      {row.item_count} {row.item_count === 1 ? 'line' : 'lines'}
                    </p>
                  )}
                  <p className="text-xs text-gray-500">
                    Requested {formatRequestDate(row.created_at)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>

        {meta && meta.last_page > 1 ? (
          <Pagination meta={meta} onPage={setPage} disabled={isLoading} />
        ) : null}
      </section>
    </div>
  );
}
