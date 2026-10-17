import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  deleteCategory,
  listCategories,
  type Category,
  type CategoryStatus,
} from '../api/categoriesApi';
import type { PaginationMeta } from '../api/catalogApiUtils';
import {
  Alert,
  LoadingPanel,
  PageHeader,
  Pagination,
  StatusBadge,
  dangerLinkClass,
  dangerSmallButtonClass,
  describeLoadError,
  describeRequestError,
  inputClass,
  linkClass,
  primaryButtonClass,
  secondaryButtonClass,
  smallButtonClass,
  type LoadErrorState,
} from '../../../components/catalog-ui/CatalogUi';

const PER_PAGE = 15;

type StatusFilter = '' | CategoryStatus;

function categoryLabel(category: Category): string {
  return category.name_en || category.name_mm;
}

/**
 * Admin category list: search, status/parent filters, pagination, edit links,
 * and delete with an inline confirmation step.
 */
export default function CategoryListPage() {
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [parentOptions, setParentOptions] = useState<Category[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<LoadErrorState | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('');
  const [parentId, setParentId] = useState('');
  const [page, setPage] = useState(1);

  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Parent options power the parent filter and the parent-name column.
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const response = await listCategories({ per_page: 100 });
      if (!cancelled && response.success && response.data) {
        setParentOptions(response.data.categories);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setLoadError(null);

      const response = await listCategories({
        page,
        per_page: PER_PAGE,
        search: search || undefined,
        status: status || undefined,
        parent_id: parentId || undefined,
      });

      if (cancelled) return;

      if (response.success && response.data) {
        setCategories(response.data.categories);
        setMeta(response.data.meta);

        // After deleting the last row of a page the API returns an empty page;
        // step back to the last page that still has rows.
        if (
          response.data.categories.length === 0 &&
          page > 1 &&
          response.data.meta.last_page < page
        ) {
          setPage(Math.max(response.data.meta.last_page, 1));
        }
      } else {
        setLoadError(describeLoadError(response, 'categories'));
      }

      setIsLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [page, search, status, parentId, reloadToken]);

  const parentNames = useMemo(() => {
    const names = new Map<number, string>();
    for (const option of parentOptions) {
      names.set(option.id, option.name_en || option.name_mm);
    }
    return names;
  }, [parentOptions]);

  const hasFilters = search !== '' || status !== '' || parentId !== '';

  const clearFilters = () => {
    setSearchInput('');
    setSearch('');
    setStatus('');
    setParentId('');
    setPage(1);
    setActionError(null);
  };

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
    setSuccessMessage(null);
    setActionError(null);
  };

  const handleStatusChange = (value: string) => {
    setStatus(value as StatusFilter);
    setPage(1);
    setSuccessMessage(null);
    setActionError(null);
  };

  const handleParentChange = (value: string) => {
    setParentId(value);
    setPage(1);
    setSuccessMessage(null);
    setActionError(null);
  };

  const handleDelete = async (category: Category) => {
    setActionError(null);
    setSuccessMessage(null);
    setIsDeleting(true);

    const response = await deleteCategory(category.id);

    setIsDeleting(false);
    setConfirmingId(null);

    if (response.success) {
      setSuccessMessage(response.message ?? `Deleted “${categoryLabel(category)}”.`);
      setReloadToken((token) => token + 1);
      return;
    }

    if (response.status === 404) {
      setActionError('That category no longer exists. The list has been refreshed.');
      setReloadToken((token) => token + 1);
      return;
    }

    if (response.status === 409) {
      setActionError(
        `${
          response.message ?? 'This category cannot be deleted.'
        } Deactivate it instead, or remove the child categories and products that reference it.`,
      );
      return;
    }

    setActionError(describeRequestError(response, 'The category could not be deleted.'));
  };

  const header = (
    <PageHeader
      title="Categories"
      description="Organize products into categories and subcategories."
      action={
        <Link to="/admin/categories/new" className={primaryButtonClass}>
          New category
        </Link>
      }
    />
  );

  if (loadError && (loadError.needsLogin || categories === null)) {
    return (
      <div className="space-y-6">
        {header}
        <div className="rounded-lg border border-red-200 bg-red-50 p-6" role="alert">
          <h2 className="text-lg font-semibold text-red-800">Categories are unavailable</h2>
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

  if (isLoading && categories === null) {
    return (
      <div className="space-y-6">
        {header}
        <LoadingPanel label="Loading categories…" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

      {successMessage ? (
        <Alert tone="success">
          <p className="text-sm font-medium">{successMessage}</p>
        </Alert>
      ) : null}

      {actionError ? (
        <Alert tone="error">
          <p className="text-sm font-medium">{actionError}</p>
        </Alert>
      ) : null}

      <section className="rounded-lg bg-white p-4 shadow sm:p-6">
        <form
          onSubmit={handleSearchSubmit}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
          role="search"
          aria-label="Filter categories"
        >
          <div className="lg:col-span-2">
            <label htmlFor="category-search" className="block text-sm font-medium text-gray-700">
              Search
            </label>
            <div className="mt-1 flex gap-2">
              <input
                id="category-search"
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Name (Burmese or English)"
                className={`${inputClass(false)} min-w-0 flex-1`}
              />
              <button type="submit" className={secondaryButtonClass}>
                Search
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="category-status-filter"
              className="block text-sm font-medium text-gray-700"
            >
              Status
            </label>
            <select
              id="category-status-filter"
              value={status}
              onChange={(event) => handleStatusChange(event.target.value)}
              className={`${inputClass(false)} mt-1`}
            >
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="category-parent-filter"
              className="block text-sm font-medium text-gray-700"
            >
              Parent category
            </label>
            <select
              id="category-parent-filter"
              value={parentId}
              onChange={(event) => handleParentChange(event.target.value)}
              className={`${inputClass(false)} mt-1`}
            >
              <option value="">All categories</option>
              {parentOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name_mm} ({option.name_en})
                </option>
              ))}
            </select>
          </div>
        </form>
      </section>

      <section className="rounded-lg bg-white shadow" aria-busy={isLoading || undefined}>
        {loadError ? (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-amber-800">{loadError.message}</p>
              <button
                type="button"
                onClick={() => setReloadToken((token) => token + 1)}
                className={secondaryButtonClass}
              >
                Try again
              </button>
            </div>
          </div>
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

        {categories !== null && categories.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <h2 className="text-base font-semibold text-gray-900">
              {hasFilters ? 'No categories match your filters' : 'No categories yet'}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {hasFilters
                ? 'Try a different search term or clear the filters.'
                : 'Create the first category to start organizing products.'}
            </p>
            <div className="mt-4">
              {hasFilters ? (
                <button type="button" onClick={clearFilters} className={secondaryButtonClass}>
                  Clear filters
                </button>
              ) : (
                <Link to="/admin/categories/new" className={primaryButtonClass}>
                  New category
                </Link>
              )}
            </div>
          </div>
        ) : null}

        {categories !== null && categories.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                      Category
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                      Parent
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                      Order
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
                  {categories.map((category) => (
                    <tr key={category.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {category.image_url ? (
                            <img
                              src={category.image_url}
                              alt=""
                              className="h-10 w-10 flex-none rounded-md object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <span
                              aria-hidden="true"
                              className="flex h-10 w-10 flex-none items-center justify-center rounded-md bg-gray-100 text-sm font-medium text-gray-400"
                            >
                              {category.name_en.charAt(0).toUpperCase() || '#'}
                            </span>
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-gray-900">
                              {category.name_mm}
                            </p>
                            <p className="truncate text-sm text-gray-500">{category.name_en}</p>
                            <p className="truncate text-xs text-gray-400">{category.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                        {category.parent_id === null
                          ? 'Top level'
                          : parentNames.get(category.parent_id) ?? `Category #${category.parent_id}`}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                        {category.sort_order}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <StatusBadge status={category.status} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {confirmingId === category.id ? (
                          <span className="inline-flex items-center gap-2">
                            <span className="text-xs text-gray-700">
                              Delete “{categoryLabel(category)}”?
                            </span>
                            <button
                              type="button"
                              className={dangerSmallButtonClass}
                              disabled={isDeleting}
                              onClick={() => void handleDelete(category)}
                            >
                              {isDeleting ? 'Deleting…' : 'Confirm'}
                            </button>
                            <button
                              type="button"
                              className={smallButtonClass}
                              disabled={isDeleting}
                              onClick={() => setConfirmingId(null)}
                            >
                              Cancel
                            </button>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-3">
                            <Link
                              to={`/admin/categories/${category.id}/edit`}
                              className={linkClass}
                              aria-label={`Edit ${categoryLabel(category)}`}
                            >
                              Edit
                            </Link>
                            <button
                              type="button"
                              className={dangerLinkClass}
                              onClick={() => {
                                setConfirmingId(category.id);
                                setActionError(null);
                                setSuccessMessage(null);
                              }}
                              aria-label={`Delete ${categoryLabel(category)}`}
                            >
                              Delete
                            </button>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {meta ? (
              <Pagination meta={meta} onPage={setPage} disabled={isLoading || isDeleting} />
            ) : null}
          </>
        ) : null}
      </section>
    </div>
  );
}
