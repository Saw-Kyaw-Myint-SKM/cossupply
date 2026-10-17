import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { listSuppliers, type Supplier, type SupplierStatus } from '../api/suppliersApi';
import type { PaginationMeta } from '../api/catalogApiUtils';
import {
  Alert,
  LoadingPanel,
  PageHeader,
  Pagination,
  StatusBadge,
  describeLoadError,
  inputClass,
  linkClass,
  primaryButtonClass,
  secondaryButtonClass,
  type LoadErrorState,
} from '../components/CatalogUi';

const PER_PAGE = 15;

type StatusFilter = '' | SupplierStatus;

/**
 * Admin supplier list: search, status filter, pagination, and edit links.
 *
 * Suppliers are never deleted (the API has no delete endpoint); they are
 * deactivated by changing `status` Inactive/Suspended on the edit page.
 */
export default function SupplierListPage() {
  const [suppliers, setSuppliers] = useState<Supplier[] | null>(null);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<LoadErrorState | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setLoadError(null);

      const response = await listSuppliers({
        page,
        per_page: PER_PAGE,
        search: search || undefined,
        status: status || undefined,
      });

      if (cancelled) return;

      if (response.success && response.data) {
        setSuppliers(response.data.suppliers);
        setMeta(response.data.meta);
      } else {
        setLoadError(describeLoadError(response, 'suppliers'));
      }

      setIsLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [page, search, status, reloadToken]);

  const hasFilters = search !== '' || status !== '';

  const clearFilters = () => {
    setSearchInput('');
    setSearch('');
    setStatus('');
    setPage(1);
  };

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const handleStatusChange = (value: string) => {
    setStatus(value as StatusFilter);
    setPage(1);
  };

  const header = (
    <PageHeader
      title="Suppliers"
      description="Supplier contacts, terms, and status. Suppliers are never deleted — set a supplier to Inactive or Suspended to deactivate it."
      action={
        <Link to="/admin/suppliers/new" className={primaryButtonClass}>
          New supplier
        </Link>
      }
    />
  );

  if (loadError && (loadError.needsLogin || suppliers === null)) {
    return (
      <div className="space-y-6">
        {header}
        <div className="rounded-lg border border-red-200 bg-red-50 p-6" role="alert">
          <h2 className="text-lg font-semibold text-red-800">Suppliers are unavailable</h2>
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
              <Link to="/admin/login" className={linkClass}>
                Go to admin login
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  if (isLoading && suppliers === null) {
    return (
      <div className="space-y-6">
        {header}
        <LoadingPanel label="Loading suppliers…" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

      <section className="rounded-lg bg-white p-4 shadow sm:p-6">
        <form
          onSubmit={handleSearchSubmit}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
          role="search"
          aria-label="Filter suppliers"
        >
          <div className="lg:col-span-3">
            <label htmlFor="supplier-search" className="block text-sm font-medium text-gray-700">
              Search
            </label>
            <div className="mt-1 flex gap-2">
              <input
                id="supplier-search"
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Shop, company, or phone"
                className={`${inputClass(false)} min-w-0 flex-1`}
              />
              <button type="submit" className={secondaryButtonClass}>
                Search
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="supplier-status-filter"
              className="block text-sm font-medium text-gray-700"
            >
              Status
            </label>
            <select
              id="supplier-status-filter"
              value={status}
              onChange={(event) => handleStatusChange(event.target.value)}
              className={`${inputClass(false)} mt-1`}
            >
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </div>
        </form>
      </section>

      <section className="rounded-lg bg-white shadow" aria-busy={isLoading || undefined}>
        {loadError ? (
          <Alert tone="warning" className="rounded-b-none border-x-0 border-t-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-medium">{loadError.message}</p>
              <button
                type="button"
                onClick={() => setReloadToken((token) => token + 1)}
                className={secondaryButtonClass}
              >
                Try again
              </button>
            </div>
          </Alert>
        ) : null}

        {isLoading ? (
          <div
            className="flex items-center gap-2 border-b border-gray-100 px-4 py-2 text-sm text-gray-500"
            role="status"
          >
            <span
              className="h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600 motion-reduce:animate-none"
              aria-hidden="true"
            />
            Updating list…
          </div>
        ) : null}

        {suppliers !== null && suppliers.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <h2 className="text-base font-semibold text-gray-900">
              {hasFilters ? 'No suppliers match your filters' : 'No suppliers yet'}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {hasFilters
                ? 'Try a different search term or clear the filters.'
                : 'Add the first supplier to start creating products for the catalog.'}
            </p>
            <div className="mt-4">
              {hasFilters ? (
                <button type="button" onClick={clearFilters} className={secondaryButtonClass}>
                  Clear filters
                </button>
              ) : (
                <Link to="/admin/suppliers/new" className={primaryButtonClass}>
                  New supplier
                </Link>
              )}
            </div>
          </div>
        ) : null}

        {suppliers !== null && suppliers.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                      Supplier
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                      Contact
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                      Location
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                      Products
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-gray-600">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {suppliers.map((supplier) => (
                    <tr key={supplier.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {supplier.logo_url ? (
                            <img
                              src={supplier.logo_url}
                              alt=""
                              className="h-10 w-10 flex-none rounded-md object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <span
                              aria-hidden="true"
                              className="flex h-10 w-10 flex-none items-center justify-center rounded-md bg-gray-100 text-sm font-medium text-gray-400"
                            >
                              {supplier.shop_name.charAt(0).toUpperCase() || '#'}
                            </span>
                          )}
                          <div className="min-w-0">
                            <Link
                              to={`/admin/suppliers/${supplier.id}/edit`}
                              className="truncate text-sm font-medium text-blue-700 hover:text-blue-900"
                              aria-label={`Edit ${supplierLabel(supplier)}`}
                            >
                              {supplier.shop_name}
                            </Link>
                            {supplier.company_name ? (
                              <p className="truncate text-sm text-gray-500">
                                {supplier.company_name}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="whitespace-nowrap text-sm text-gray-900">
                          {supplier.contact_person}
                        </p>
                        <p className="whitespace-nowrap text-sm text-gray-500">{supplier.phone}</p>
                        {supplier.viber_phone ? (
                          <p className="whitespace-nowrap text-xs text-gray-400">
                            Viber {supplier.viber_phone}
                          </p>
                        ) : (
                          <p className="whitespace-nowrap text-xs font-medium text-amber-700">
                            No Viber number
                          </p>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                        {supplier.city}
                        {supplier.township ? (
                          <span className="block text-xs text-gray-400">{supplier.township}</span>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                        {supplier.products_count !== undefined ? supplier.products_count : '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <StatusBadge status={supplier.status} />
                        {supplier.verified ? (
                          <span className="mt-1 block w-fit rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20">
                            Verified
                          </span>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <Link
                          to={`/admin/suppliers/${supplier.id}/edit`}
                          className={linkClass}
                          aria-label={`Edit ${supplierLabel(supplier)}`}
                        >
                          Edit
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="border-t border-gray-100 px-4 py-3 text-xs text-gray-500">
              To deactivate a supplier, open Edit and set Status to Inactive or Suspended.
              Suppliers are never deleted.
            </p>

            {meta ? <Pagination meta={meta} onPage={setPage} disabled={isLoading} /> : null}
          </>
        ) : null}
      </section>
    </div>
  );
}

function supplierLabel(supplier: Supplier): string {
  return supplier.shop_name || supplier.company_name || `Supplier #${supplier.id}`;
}
