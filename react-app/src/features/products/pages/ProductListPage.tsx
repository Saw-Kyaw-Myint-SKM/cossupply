/**
 * Product List Page (Task 05).
 *
 * Guest-facing catalog with server-side search and filters for category,
 * supplier, name/sku, and stock status. All filter state lives in the URL so
 * a category deep link from `/categories` (and any shared link) reproduces
 * exactly the same view.
 */
import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  listCategories,
  listProducts,
  listSuppliers,
  type PublicCategory,
  type PublicProduct,
  type PublicSupplier,
  type StockStatus,
} from '../../../api/catalog';
import type { PaginationMeta } from '../../../api/query';
import {
  Alert,
  EmptyState,
  LoadingPanel,
  Pagination,
  PageHeader,
  secondaryButtonClass,
} from '../../../components/catalog-ui/CatalogUi';
import { ProductCard, describeCatalogError } from '../components/ProductUi';

const STOCK_FILTERS: Array<{ value: StockStatus | ''; label: string }> = [
  { value: '', label: 'Any availability' },
  { value: 'IN_STOCK', label: 'In stock' },
  { value: 'LOW_STOCK', label: 'Low stock' },
  { value: 'PRE_ORDER', label: 'Pre-order' },
  { value: 'SUPPLIER_CONFIRMATION_REQUIRED', label: 'Supplier confirmation required' },
  { value: 'OUT_OF_STOCK', label: 'Out of stock' },
];

const inputClass =
  'mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500';

export default function ProductListPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get('search') ?? '';
  const categoryId = searchParams.get('category_id') ?? '';
  const supplierId = searchParams.get('supplier_id') ?? '';
  const stockStatus = (searchParams.get('stock_status') ?? '') as StockStatus | '';
  const page = Number(searchParams.get('page') ?? '1') || 1;

  const [searchInput, setSearchInput] = useState(search);

  // Keep the text field in step with the URL, so back/forward and
  // "clear filters" never leave a stale term in the input.
  useEffect(() => {
    setSearchInput(search);
  }, [search]);
  const [products, setProducts] = useState<PublicProduct[] | null>(null);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [categories, setCategories] = useState<PublicCategory[]>([]);
  const [suppliers, setSuppliers] = useState<PublicSupplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    listCategories({ per_page: 100 }).then((response) => {
      if (cancelled) return;
      if (response.success && response.data) setCategories(response.data.categories);
    });

    listSuppliers({ per_page: 100 }).then((response) => {
      if (cancelled) return;
      if (response.success && response.data) setSuppliers(response.data.suppliers);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);

    listProducts({
      page,
      per_page: 12,
      search: search || undefined,
      category_id: categoryId || undefined,
      supplier_id: supplierId || undefined,
      stock_status: stockStatus || undefined,
    })
      .then((response) => {
        if (cancelled) return;

        if (response.success && response.data) {
          setProducts(response.data.products);
          setMeta(response.data.meta);
        } else {
          setProducts(null);
          setMeta(null);
          setLoadError(describeCatalogError(response, 'products'));
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [page, search, categoryId, supplierId, stockStatus]);

  const updateParams = (changes: Record<string, string>, keepPage = false) => {
    const next = new URLSearchParams(searchParams);

    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }

    if (!keepPage) next.delete('page');
    setSearchParams(next);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateParams({ search: searchInput.trim() });
  };

  const hasFilters = Boolean(search || categoryId || supplierId || stockStatus);

  const clearFilters = () => {
    setSearchInput('');
    setSearchParams(new URLSearchParams());
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description="Browse published products from verified suppliers. Prices shown are display prices and are confirmed in your quotation."
      />

      <section className="rounded-lg bg-white p-4 shadow sm:p-6">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <label htmlFor="catalog-search" className="block text-sm font-medium text-gray-700">
              Search
            </label>
            <div className="flex gap-2">
              <input
                id="catalog-search"
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Name, SKU, brand or model"
                maxLength={100}
                className={`${inputClass} min-w-0 flex-1`}
              />
              <button type="submit" className={secondaryButtonClass}>
                Search
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="filter-category" className="block text-sm font-medium text-gray-700">
              Category
            </label>
            <select
              id="filter-category"
              value={categoryId}
              onChange={(event) => updateParams({ category_id: event.target.value })}
              className={inputClass}
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name_en}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filter-supplier" className="block text-sm font-medium text-gray-700">
              Supplier
            </label>
            <select
              id="filter-supplier"
              value={supplierId}
              onChange={(event) => updateParams({ supplier_id: event.target.value })}
              className={inputClass}
            >
              <option value="">All suppliers</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.shop_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filter-stock" className="block text-sm font-medium text-gray-700">
              Availability
            </label>
            <select
              id="filter-stock"
              value={stockStatus}
              onChange={(event) => updateParams({ stock_status: event.target.value })}
              className={inputClass}
            >
              {STOCK_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </form>

        {hasFilters ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-600">
              Filters are applied to the published catalog only.
            </p>
            <button type="button" onClick={clearFilters} className={secondaryButtonClass}>
              Clear filters
            </button>
          </div>
        ) : null}
      </section>

      <section className="rounded-lg bg-white shadow" aria-busy={isLoading || undefined}>
        {isLoading ? <LoadingPanel label="Loading products" /> : null}

        {!isLoading && loadError ? (
          <div className="p-6">
            <Alert tone="error">{loadError}</Alert>
          </div>
        ) : null}

        {!isLoading && !loadError && products !== null && products.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No products match your filters"
              hint={hasFilters ? 'Try clearing a filter or searching for something broader.' : 'No products have been published yet.'}
            />
            {hasFilters ? (
              <div className="mt-4 text-center">
                <button type="button" onClick={clearFilters} className={secondaryButtonClass}>
                  Clear filters
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {!isLoading && !loadError && products && products.length > 0 ? (
          <>
            <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 sm:p-6">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
            {meta ? <Pagination meta={meta} onPage={(next) => updateParams({ page: String(next) }, true)} /> : null}
          </>
        ) : null}
      </section>
    </div>
  );
}
