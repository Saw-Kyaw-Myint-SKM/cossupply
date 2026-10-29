/**
 * Admin customer directory (Task 12).
 *
 * Read-only list of registered customers with quotation/order counts. There
 * is deliberately no create/edit action here: registration and profile edits
 * belong to the customer, and the backend exposes no admin write route.
 */
import { useEffect, useState, type FormEvent } from 'react';
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
  primaryButtonClass,
  secondaryButtonClass,
  type LoadErrorState,
} from '../../../components/catalog-ui/CatalogUi';
import type { PaginationMeta } from '../../../api/query';
import {
  listCustomers,
  type CustomerStatus,
  type CustomerType,
  type DirectoryCustomer,
} from '../api/customersApi';

const PER_PAGE = 20;

function formatWhen(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
}

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<DirectoryCustomer[] | null>(null);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<CustomerStatus | ''>('');
  const [customerType, setCustomerType] = useState<CustomerType | ''>('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<LoadErrorState | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setLoadError(null);

      const response = await listCustomers({
        page,
        per_page: PER_PAGE,
        status: status || undefined,
        customer_type: customerType || undefined,
        search: search || undefined,
      });

      if (cancelled) return;

      if (response.success && response.data) {
        setCustomers(response.data.customers);
        setMeta(response.data.meta);
      } else {
        setLoadError(describeLoadError(response, 'the customer directory'));
      }

      setIsLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [page, status, customerType, search, reloadToken]);

  const hasFilters = search !== '' || status !== '' || customerType !== '';

  const clearFilters = () => {
    setSearchInput('');
    setSearch('');
    setStatus('');
    setCustomerType('');
    setPage(1);
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Customers"
        description="Read-only directory of registered buyers, with their quotation and order history. Customer accounts are created and edited by the customer, not by Admin."
      />

      <div className="rounded-lg border border-rule bg-plate p-4">
        <form
          onSubmit={submitSearch}
          role="search"
          aria-label="Filter customers"
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          <div className="lg:col-span-2">
            <label htmlFor="customer-search" className="block text-sm font-medium text-ink">
              Search name, phone, email or company
            </label>
            <div className="mt-1 flex gap-2">
              <input
                id="customer-search"
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                maxLength={100}
                className={`${inputClass(false)} min-w-0 flex-1`}
                placeholder="09123456789"
              />
              <button type="submit" className={secondaryButtonClass}>
                Search
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="customer-status-filter" className="block text-sm font-medium text-ink">
              Status
            </label>
            <select
              id="customer-status-filter"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as CustomerStatus | '');
                setPage(1);
              }}
              className={`${inputClass(false)} mt-1`}
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>

          <div>
            <label htmlFor="customer-type-filter" className="block text-sm font-medium text-ink">
              Account type
            </label>
            <select
              id="customer-type-filter"
              value={customerType}
              onChange={(event) => {
                setCustomerType(event.target.value as CustomerType | '');
                setPage(1);
              }}
              className={`${inputClass(false)} mt-1`}
            >
              <option value="">All types</option>
              <option value="individual">Individual</option>
              <option value="business">Business</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={clearFilters}
              className={secondaryButtonClass}
              disabled={!hasFilters}
            >
              Clear filters
            </button>
          </div>
        </form>
      </div>

      {isLoading && customers === null ? <LoadingPanel label="Loading customers" /> : null}

      {loadError ? (
        <Alert>
          <p>{loadError.message}</p>
          {loadError.needsLogin ? null : (
            <button
              type="button"
              onClick={() => setReloadToken((token) => token + 1)}
              className={`${primaryButtonClass} mt-3`}
            >
              Try again
            </button>
          )}
        </Alert>
      ) : null}

      {!isLoading && !loadError && customers !== null && customers.length === 0 ? (
        <EmptyState
          title={hasFilters ? 'No customers match your filters' : 'No customers yet'}
          hint={
            hasFilters
              ? 'Try a different search term or clear the filters.'
              : 'Buyers appear here after they register an account.'
          }
        />
      ) : null}

      {customers !== null && customers.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-rule bg-plate">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-rule text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Customer</th>
                  <th scope="col" className="px-4 py-3 font-medium">Contact</th>
                  <th scope="col" className="px-4 py-3 font-medium">Type</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Quotations</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Orders</th>
                  <th scope="col" className="px-4 py-3 font-medium">Joined</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {customers.map((customer) => (
                  <tr key={customer.id} className="align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{customer.name}</p>
                      {customer.company_name ? (
                        <p className="text-xs text-gray-500">{customer.company_name}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <p className="whitespace-nowrap text-ink">{customer.phone}</p>
                      <p className="whitespace-nowrap text-xs text-gray-500">
                        {customer.email ?? 'No email'}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-ink">
                      {formatStatusLabel(customer.customer_type)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-ink">
                      {customer.quotation_requests_count}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-ink">
                      {customer.orders_count}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">
                      {formatWhen(customer.created_at)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <StatusBadge status={customer.status.toUpperCase()} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="border-t border-rule px-4 py-3 text-xs text-gray-500">
            This directory is read-only. Customers manage their own profile and addresses; Admin
            cannot reset passwords or edit customer accounts.
          </p>

          {meta ? <Pagination meta={meta} onPage={setPage} disabled={isLoading} /> : null}
        </div>
      ) : null}
    </div>
  );
}
