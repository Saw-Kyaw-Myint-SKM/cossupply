import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { ApiResponse } from '../../../api/client';
import { listCategories, type Category } from '../api/categoriesApi';
import { listSuppliers, type Supplier } from '../api/suppliersApi';
import {
  deleteProduct,
  listProducts,
  updateProductStatus,
  type Product,
  type ProductStatus,
} from '../api/productsApi';
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
  formatStatusLabel,
  inputClass,
  linkClass,
  primaryButtonClass,
  secondaryButtonClass,
  smallButtonClass,
  type LoadErrorState,
} from '../../../components/catalog-ui/CatalogUi';

const PER_PAGE = 15;

type StatusFilter = '' | ProductStatus;

interface PendingStatus {
  id: number;
  status: ProductStatus;
}

interface StatusFailure {
  productLabel: string;
  messages: string[];
}

const QUICK_STATUS_ACTIONS: { status: ProductStatus; label: string }[] = [
  { status: 'PUBLISHED', label: 'Publish' },
  { status: 'HIDDEN', label: 'Hide' },
  { status: 'OUT_OF_STOCK', label: 'Out of stock' },
  { status: 'DRAFT', label: 'Draft' },
];

const STATUS_FIELD_LABELS: Record<string, string> = {
  supplier_id: 'Supplier',
  category_id: 'Category',
  photo: 'Photo',
  retail_price: 'Retail price',
  status: 'Status',
};

function productLabel(product: Product): string {
  return product.name_en || product.name_mm;
}

function formatMmk(value: number): string {
  return `${value.toLocaleString('en-US')} MMK`;
}

function statusActionLabel(status: ProductStatus): string {
  switch (status) {
    case 'PUBLISHED':
      return 'Publish';
    case 'HIDDEN':
      return 'Hide';
    case 'OUT_OF_STOCK':
      return 'Mark out of stock';
    case 'DRAFT':
      return 'Move to draft';
  }
}

/** Only publishing is non-destructive; the other transitions need a confirm step. */
function isDestructiveStatus(status: ProductStatus): boolean {
  return status !== 'PUBLISHED';
}

/** Render publish 422 errors (`supplier_id`/`category_id`/`photo`/`retail_price`) readably. */
function collectStatusMessages(response: ApiResponse<unknown>): string[] {
  const entries = Object.entries(response.errors ?? {});

  if (entries.length === 0) {
    return [response.message ?? 'The product could not be updated.'];
  }

  return entries.map(
    ([key, messages]) =>
      `${STATUS_FIELD_LABELS[key] ?? key}: ${messages[0] ?? 'is not valid.'}`,
  );
}

function supplierOptionLabel(supplier: Supplier): string {
  return supplier.status === 'ACTIVE'
    ? supplier.shop_name
    : `${supplier.shop_name} (${formatStatusLabel(supplier.status)})`;
}

function categoryOptionLabel(category: Category): string {
  return `${category.name_mm} (${category.name_en})`;
}

/**
 * Admin product list: filters, pagination, status quick actions, and delete
 * with an inline confirmation step.
 */
export default function ProductListPage() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [categoryOptions, setCategoryOptions] = useState<Category[]>([]);
  const [supplierOptions, setSupplierOptions] = useState<Supplier[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<LoadErrorState | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [statusFailure, setStatusFailure] = useState<StatusFailure | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('');
  const [categoryId, setCategoryId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [page, setPage] = useState(1);

  const [pendingStatus, setPendingStatus] = useState<PendingStatus | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filter option lists.
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const [categoriesResponse, suppliersResponse] = await Promise.all([
        listCategories({ per_page: 100 }),
        listSuppliers({ per_page: 100 }),
      ]);

      if (cancelled) return;

      if (categoriesResponse.success && categoriesResponse.data) {
        setCategoryOptions(categoriesResponse.data.categories);
      }
      if (suppliersResponse.success && suppliersResponse.data) {
        setSupplierOptions(suppliersResponse.data.suppliers);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setLoadError(null);

      const response = await listProducts({
        page,
        per_page: PER_PAGE,
        search: search || undefined,
        status: status || undefined,
        category_id: categoryId || undefined,
        supplier_id: supplierId || undefined,
      });

      if (cancelled) return;

      if (response.success && response.data) {
        setProducts(response.data.products);
        setMeta(response.data.meta);

        // After deleting the last row of a page the API returns an empty page;
        // step back to the last page that still has rows.
        if (
          response.data.products.length === 0 &&
          page > 1 &&
          response.data.meta.last_page < page
        ) {
          setPage(Math.max(response.data.meta.last_page, 1));
        }
      } else {
        setLoadError(describeLoadError(response, 'products'));
      }

      setIsLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [page, search, status, categoryId, supplierId, reloadToken]);

  const hasFilters = search !== '' || status !== '' || categoryId !== '' || supplierId !== '';
  const actionsBusy = updatingId !== null || isDeleting;

  const clearFilters = () => {
    setSearchInput('');
    setSearch('');
    setStatus('');
    setCategoryId('');
    setSupplierId('');
    setPage(1);
    setActionError(null);
    setStatusFailure(null);
  };

  const resetActionFeedback = () => {
    setSuccessMessage(null);
    setActionError(null);
    setStatusFailure(null);
    setPendingStatus(null);
  };

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
    resetActionFeedback();
  };

  const applyStatusChange = async (product: Product, nextStatus: ProductStatus) => {
    setPendingStatus(null);
    setUpdatingId(product.id);
    setSuccessMessage(null);
    setActionError(null);
    setStatusFailure(null);

    const response = await updateProductStatus(product.id, nextStatus);

    setUpdatingId(null);

    if (response.success && response.data) {
      const updated = response.data.product;
      setProducts((previous) =>
        previous ? previous.map((item) => (item.id === updated.id ? updated : item)) : previous,
      );
      setSuccessMessage(`“${productLabel(product)}” is now ${formatStatusLabel(nextStatus)}.`);
      return;
    }

    if (response.status === 401) {
      setLoadError({
        message: 'Your admin session has expired. Sign in again to change product status.',
        needsLogin: true,
      });
      return;
    }

    if (response.status === 422) {
      setStatusFailure({
        productLabel: productLabel(product),
        messages: collectStatusMessages(response),
      });
      return;
    }

    setActionError(describeRequestError(response, 'The product status could not be updated.'));
  };

  const requestStatusChange = (product: Product, nextStatus: ProductStatus) => {
    setSuccessMessage(null);
    setActionError(null);
    setStatusFailure(null);

    if (isDestructiveStatus(nextStatus)) {
      setPendingStatus({ id: product.id, status: nextStatus });
      setConfirmingId(null);
      return;
    }

    void applyStatusChange(product, nextStatus);
  };

  const handleDelete = async (product: Product) => {
    setActionError(null);
    setSuccessMessage(null);
    setStatusFailure(null);
    setIsDeleting(true);

    const response = await deleteProduct(product.id);

    setIsDeleting(false);
    setConfirmingId(null);

    if (response.success) {
      setSuccessMessage(response.message ?? `Deleted “${productLabel(product)}”.`);
      setReloadToken((token) => token + 1);
      return;
    }

    if (response.status === 404) {
      setActionError('That product no longer exists. The list has been refreshed.');
      setReloadToken((token) => token + 1);
      return;
    }

    if (response.status === 409) {
      setActionError(
        `${
          response.message ?? 'This product cannot be deleted.'
        } Hide it or mark it out of stock instead.`,
      );
      return;
    }

    setActionError(describeRequestError(response, 'The product could not be deleted.'));
  };

  const header = (
    <PageHeader
      title="Products"
      description="Manage products, prices, and stock. Publishing needs an active supplier, an active category, a photo, and a retail price above zero."
      action={
        <Link to="/admin/products/new" className={primaryButtonClass}>
          New product
        </Link>
      }
    />
  );

  if (loadError && (loadError.needsLogin || products === null)) {
    return (
      <div className="space-y-6">
        {header}
        <div className="rounded-lg border border-red-200 bg-red-50 p-6" role="alert">
          <h2 className="text-lg font-semibold text-red-800">Products are unavailable</h2>
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

  if (isLoading && products === null) {
    return (
      <div className="space-y-6">
        {header}
        <LoadingPanel label="Loading products…" />
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

      {statusFailure ? (
        <Alert tone="error">
          <p className="text-sm font-medium">
            Could not update “{statusFailure.productLabel}”.
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
            {statusFailure.messages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <section className="rounded-lg bg-white p-4 shadow sm:p-6">
        <form
          onSubmit={handleSearchSubmit}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5"
          role="search"
          aria-label="Filter products"
        >
          <div className="lg:col-span-2">
            <label htmlFor="product-search" className="block text-sm font-medium text-gray-700">
              Search
            </label>
            <div className="mt-1 flex gap-2">
              <input
                id="product-search"
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Name, SKU, brand, or model"
                className={`${inputClass(false)} min-w-0 flex-1`}
              />
              <button type="submit" className={secondaryButtonClass}>
                Search
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="product-status-filter"
              className="block text-sm font-medium text-gray-700"
            >
              Status
            </label>
            <select
              id="product-status-filter"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as StatusFilter);
                setPage(1);
                resetActionFeedback();
              }}
              className={`${inputClass(false)} mt-1`}
            >
              <option value="">All statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
              <option value="HIDDEN">Hidden</option>
              <option value="OUT_OF_STOCK">Out of stock</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="product-category-filter"
              className="block text-sm font-medium text-gray-700"
            >
              Category
            </label>
            <select
              id="product-category-filter"
              value={categoryId}
              onChange={(event) => {
                setCategoryId(event.target.value);
                setPage(1);
                resetActionFeedback();
              }}
              className={`${inputClass(false)} mt-1`}
            >
              <option value="">All categories</option>
              {categoryOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {categoryOptionLabel(option)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="product-supplier-filter"
              className="block text-sm font-medium text-gray-700"
            >
              Supplier
            </label>
            <select
              id="product-supplier-filter"
              value={supplierId}
              onChange={(event) => {
                setSupplierId(event.target.value);
                setPage(1);
                resetActionFeedback();
              }}
              className={`${inputClass(false)} mt-1`}
            >
              <option value="">All suppliers</option>
              {supplierOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {supplierOptionLabel(option)}
                </option>
              ))}
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

        {products !== null && products.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <h2 className="text-base font-semibold text-gray-900">
              {hasFilters ? 'No products match your filters' : 'No products yet'}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {hasFilters
                ? 'Try a different search term or clear the filters.'
                : 'Add the first product to start building the catalog.'}
            </p>
            <div className="mt-4">
              {hasFilters ? (
                <button type="button" onClick={clearFilters} className={secondaryButtonClass}>
                  Clear filters
                </button>
              ) : (
                <Link to="/admin/products/new" className={primaryButtonClass}>
                  New product
                </Link>
              )}
            </div>
          </div>
        ) : null}

        {products !== null && products.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                      Product
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                      Supplier
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                      Category
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                      Price
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                      Stock
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
                  {products.map((product) => {
                    const rowBusy = actionsBusy;
                    return (
                      <tr key={product.id} className="align-top hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {product.photo_url ? (
                              <img
                                src={product.photo_url}
                                alt=""
                                className="h-10 w-10 flex-none rounded-md object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <span
                                aria-hidden="true"
                                className="flex h-10 w-10 flex-none items-center justify-center rounded-md bg-gray-100 text-sm font-medium text-gray-400"
                              >
                                {(product.name_en || product.name_mm).charAt(0).toUpperCase() || '#'}
                              </span>
                            )}
                            <div className="min-w-0">
                              <Link
                                to={`/admin/products/${product.id}/edit`}
                                className="truncate text-sm font-medium text-blue-700 hover:text-blue-900"
                                aria-label={`Edit ${productLabel(product)}`}
                              >
                                {product.name_mm}
                              </Link>
                              <p className="truncate text-sm text-gray-500">
                                {product.name_en ?? '—'}
                              </p>
                              <p className="truncate text-xs text-gray-400">
                                {product.sku ? `SKU ${product.sku}` : `#${product.id}`}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                          {product.supplier?.shop_name ??
                            (product.supplier_id ? `Supplier #${product.supplier_id}` : '—')}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                          {product.category
                            ? product.category.name_en || product.category.name_mm
                            : product.category_id
                              ? `Category #${product.category_id}`
                              : '—'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                          {product.price ? formatMmk(product.price.retail_price) : '—'}
                          {product.price?.discount_price ? (
                            <span className="block text-xs text-gray-500">
                              Discount {formatMmk(product.price.discount_price)}
                            </span>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          {product.stock ? (
                            <>
                              <StatusBadge status={product.stock.stock_status} />
                              {product.stock.stock_quantity !== null ? (
                                <span className="mt-1 block text-xs text-gray-500">
                                  {product.stock.stock_quantity} in stock
                                </span>
                              ) : null}
                            </>
                          ) : (
                            <span className="text-sm text-gray-500">—</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <StatusBadge status={product.status} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex flex-col items-end gap-1.5">
                            {pendingStatus !== null && pendingStatus.id === product.id ? (
                              <span className="inline-flex flex-wrap items-center justify-end gap-2">
                                <span className="text-xs text-gray-700">
                                  {statusActionLabel(pendingStatus.status)} “
                                  {productLabel(product)}”?
                                </span>
                                <button
                                  type="button"
                                  className={dangerSmallButtonClass}
                                  disabled={rowBusy}
                                  onClick={() => void applyStatusChange(product, pendingStatus.status)}
                                >
                                  Confirm
                                </button>
                                <button
                                  type="button"
                                  className={smallButtonClass}
                                  disabled={rowBusy}
                                  onClick={() => setPendingStatus(null)}
                                >
                                  Cancel
                                </button>
                              </span>
                            ) : confirmingId === product.id ? (
                              <span className="inline-flex flex-wrap items-center justify-end gap-2">
                                <span className="text-xs text-gray-700">
                                  Delete “{productLabel(product)}”?
                                </span>
                                <button
                                  type="button"
                                  className={dangerSmallButtonClass}
                                  disabled={rowBusy}
                                  onClick={() => void handleDelete(product)}
                                >
                                  {isDeleting ? 'Deleting…' : 'Confirm'}
                                </button>
                                <button
                                  type="button"
                                  className={smallButtonClass}
                                  disabled={rowBusy}
                                  onClick={() => setConfirmingId(null)}
                                >
                                  Cancel
                                </button>
                              </span>
                            ) : (
                              <>
                                <div className="flex flex-wrap justify-end gap-1.5">
                                  {QUICK_STATUS_ACTIONS.filter(
                                    (action) => action.status !== product.status,
                                  ).map((action) => (
                                    <button
                                      key={action.status}
                                      type="button"
                                      className={smallButtonClass}
                                      disabled={rowBusy}
                                      onClick={() => requestStatusChange(product, action.status)}
                                      aria-label={`${action.label} ${productLabel(product)}`}
                                    >
                                      {updatingId === product.id ? 'Updating…' : action.label}
                                    </button>
                                  ))}
                                </div>
                                <div className="flex flex-wrap items-center justify-end gap-3">
                                  <Link
                                    to={`/admin/products/${product.id}/edit`}
                                    className={linkClass}
                                    aria-label={`Edit ${productLabel(product)}`}
                                  >
                                    Edit
                                  </Link>
                                  <button
                                    type="button"
                                    className={dangerLinkClass}
                                    onClick={() => {
                                      setConfirmingId(product.id);
                                      setPendingStatus(null);
                                      setActionError(null);
                                      setSuccessMessage(null);
                                      setStatusFailure(null);
                                    }}
                                    aria-label={`Delete ${productLabel(product)}`}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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
