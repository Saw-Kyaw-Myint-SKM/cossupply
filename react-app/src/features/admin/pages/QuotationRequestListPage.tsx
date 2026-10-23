/**
 * Admin quotation queue (Task 07).
 *
 * Status, assignment and text filters all run server-side. The queue is the
 * entry point to request processing: supplier contact, draft versions, PDFs
 * and email delivery all live on the detail page.
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
import { useAuth } from '../../../lib/auth-context';
import {
  QUOTATION_REQUEST_STATUSES,
  listAdminQuotationRequests,
  type AdminQuotationRequestSummary,
  type QuotationRequestStatus,
} from '../api/quotationAdminApi';

const PER_PAGE = 15;

type AssignmentFilter = '' | 'unassigned' | 'mine';

export default function QuotationRequestListPage() {
  const { admin } = useAuth();

  const [requests, setRequests] = useState<AdminQuotationRequestSummary[] | null>(null);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<LoadErrorState | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<QuotationRequestStatus | ''>('');
  const [assignment, setAssignment] = useState<AssignmentFilter>('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setLoadError(null);

      const response = await listAdminQuotationRequests({
        page,
        per_page: PER_PAGE,
        status: status || undefined,
        search: search || undefined,
        assigned_admin_id:
          assignment === 'mine' && admin ? admin.id : undefined,
        unassigned: assignment === 'unassigned',
      });

      if (cancelled) return;

      if (response.success && response.data) {
        setRequests(response.data.quotation_requests);
        setMeta(response.data.meta);

        if (
          response.data.quotation_requests.length === 0 &&
          page > 1 &&
          response.data.meta.last_page < page
        ) {
          setPage(Math.max(response.data.meta.last_page, 1));
        }
      } else {
        setLoadError(describeLoadError(response, 'the quotation queue'));
      }

      setLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [page, status, assignment, search, admin, reloadToken]);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const clearFilters = () => {
    setSearchInput('');
    setSearch('');
    setStatus('');
    setAssignment('');
    setPage(1);
  };

  const hasFilters = search !== '' || status !== '' || assignment !== '';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quotation requests"
        description="Process customer requests, contact suppliers, and send versioned final quotations."
        action={
          <Link to="/admin/dashboard" className={secondaryButtonClass}>
            Admin dashboard
          </Link>
        }
      />

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

      <section className="rounded-lg border border-rule bg-plate p-4">
        <form onSubmit={submitSearch} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px_auto]">
          <div>
            <label htmlFor="quotation-search" className="block text-sm font-medium text-gray-900">
              Search
            </label>
            <input
              id="quotation-search"
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Number, customer, phone, email"
              maxLength={100}
              className={`${inputClass(false)} mt-1`}
            />
          </div>

          <div>
            <label htmlFor="quotation-status" className="block text-sm font-medium text-gray-900">
              Status
            </label>
            <select
              id="quotation-status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as QuotationRequestStatus | '');
                setPage(1);
              }}
              className={`${inputClass(false)} mt-1`}
            >
              <option value="">All statuses</option>
              {QUOTATION_REQUEST_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {formatStatusLabel(value)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="quotation-assignment" className="block text-sm font-medium text-gray-900">
              Assignment
            </label>
            <select
              id="quotation-assignment"
              value={assignment}
              onChange={(event) => {
                setAssignment(event.target.value as AssignmentFilter);
                setPage(1);
              }}
              className={`${inputClass(false)} mt-1`}
            >
              <option value="">Everyone</option>
              <option value="unassigned">Unassigned</option>
              <option value="mine">Assigned to me</option>
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

      {loading ? (
        <LoadingPanel label="Loading quotation requests" />
      ) : requests && requests.length === 0 ? (
        <EmptyState
          title={hasFilters ? 'No requests match these filters' : 'No quotation requests yet'}
          hint={
            hasFilters
              ? 'Try a different status, assignment, or search term.'
              : 'Requests submitted by signed-in customers will appear here.'
          }
        />
      ) : requests ? (
        <section className="overflow-hidden rounded-lg border border-rule bg-plate">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-rule text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Number</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Items</th>
                  <th className="px-4 py-3">Assigned</th>
                  <th className="px-4 py-3">Received</th>
                  <th className="px-4 py-3 text-right">Open</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {requests.map((request) => (
                  <tr key={request.id} className="align-top">
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-ink">
                      {request.quotation_number}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{request.customer_name}</p>
                      {request.company_name ? (
                        <p className="text-xs text-gray-500">{request.company_name}</p>
                      ) : null}
                      <p className="text-xs text-gray-500">{request.phone}</p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={request.status} />
                    </td>
                    <td className="px-4 py-3 tabular-nums text-gray-700">
                      {request.item_count ?? 0}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {request.assigned_admin?.name ?? (
                        <span className="text-amber-800">Unassigned</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                      {new Date(request.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link to={`/admin/quotation-requests/${request.id}`} className={linkClass}>
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {meta ? (
            <Pagination meta={meta} onPage={setPage} disabled={loading} />
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
