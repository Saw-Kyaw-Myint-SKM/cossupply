/**
 * Product List Page (Task 05).
 *
 * Guest-facing catalog with server-side search and filters for category,
 * supplier, name/sku, and stock status. All filter state lives in the URL so
 * a category deep link from `/categories` (and any shared link) reproduces
 * exactly the same view. Pagination is NOT in the URL: results load as an
 * infinite scroll, appending the next page when a sentinel scrolls near the
 * viewport — like leafing through a paper catalog instead of turning pages.
 *
 * Desktop (`lg+`): a sticky left filter rail — search on top, then category,
 * supplier, and availability radio lists, each resting on its "All" state and
 * tinting the active pick in accent-soft. Below `lg` the same fields live in
 * a bottom sheet from a "Filters · N" chip; the sheet keeps native selects so
 * neither instance shares radio `name`s or input ids with the rail.
 */
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FiFilter, FiLoader, FiSearch, FiTrash2, FiX } from 'react-icons/fi';
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
  PageHeader,
  SkeletonCard,
  inputClass,
  secondaryButtonClass,
} from '../../../components/catalog-ui/CatalogUi';
import { ProductCard, describeCatalogError } from '../components/ProductUi';
import { useI18n } from '../../../lib/i18n-context';

const STOCK_FILTERS: Array<{ value: StockStatus | ''; label: string; dot?: string }> = [
  { value: '', label: 'All availability', dot: 'bg-subtle' },
  { value: 'IN_STOCK', label: 'In stock', dot: 'bg-green-600' },
  { value: 'LOW_STOCK', label: 'Low stock', dot: 'bg-amber-500' },
  { value: 'PRE_ORDER', label: 'Pre-order', dot: 'bg-blue-600' },
  { value: 'SUPPLIER_CONFIRMATION_REQUIRED', label: 'Supplier confirmation required', dot: 'bg-violet-500' },
  { value: 'OUT_OF_STOCK', label: 'Out of stock', dot: 'bg-red-500' },
];

interface RadioOption {
  value: string;
  label: string;
  /** Semantic dot shown before the radio (availability colors). */
  dot?: string;
}

/**
 * One row of a rail radio list: native input kept for keyboard/AT, custom
 * dot as the visual, accent-soft tint when this row is the current pick.
 */
function FilterRadio({
  name,
  option,
  checked,
  onPick,
}: {
  name: string;
  option: RadioOption;
  checked: boolean;
  onPick: (value: string) => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm motion-safe:transition-colors ${
        checked ? 'bg-accent-soft font-medium text-accent' : 'text-ink hover:bg-paper'
      }`}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={() => onPick(option.value)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={`h-3.5 w-3.5 flex-none rounded-full border ${
          checked
            ? 'border-accent bg-accent shadow-[inset_0_0_0_2px_var(--color-plate)]'
            : 'border-line bg-plate'
        } peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2`}
      />
      {option.dot ? (
        <span aria-hidden="true" className={`h-2 w-2 flex-none rounded-full ${option.dot}`} />
      ) : null}
      <span className="truncate">{option.label}</span>
    </label>
  );
}

/** Section heading inside the rail: quiet, no all-caps chrome. */
function RailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-t border-rule pt-3 first:border-0 first:pt-0">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

/**
 * A rail radio list that rests on the first five rows (its "All" state
 * included) behind a "See more…" key. Expanding shows everything and flips
 * to "Show less"; a deep-linked selection past the fold keeps the list open
 * so the current pick is always visible.
 */
function RailRadioList({
  name,
  label,
  options,
  value,
  onPick,
  scroll = false,
}: {
  name: string;
  label: string;
  options: RadioOption[];
  value: string;
  onPick: (value: string) => void;
  scroll?: boolean;
}) {
  const VISIBLE_ROWS = 5;
  const [expanded, setExpanded] = useState(false);

  const selectedIndex = options.findIndex((option) => option.value === value);
  const selectedPastFold = selectedIndex >= VISIBLE_ROWS;
  const showAll = expanded || selectedPastFold;
  const visible = showAll ? options : options.slice(0, VISIBLE_ROWS);
  const hiddenCount = Math.max(options.length - VISIBLE_ROWS, 0);

  return (
    <div role="radiogroup" aria-label={label}>
      <div
        className={`space-y-0.5 ${scroll && showAll ? 'no-scrollbar max-h-60 overflow-y-auto pr-1' : ''}`}
      >
        {visible.map((option) => (
          <FilterRadio
            key={option.value || `all-${name}`}
            name={name}
            option={option}
            checked={value === option.value}
            onPick={onPick}
          />
        ))}
      </div>

      {options.length > VISIBLE_ROWS ? (
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={showAll}
          className="mt-1 inline-flex items-center gap-1 px-2.5 py-1 text-sm font-medium text-accent hover:text-accent/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
        >
          {showAll
            ? 'Show less'
            : hiddenCount > 0
              ? `See more… (${hiddenCount} more)`
              : 'See more…'}
        </button>
      ) : null}
    </div>
  );
}

/** Quiet load-more marker under the in-view catalog. */
function LoadingMoreRow({ label }: { label: string }) {
  return (
    <div
      role="status"
      className="flex justify-center py-6 text-sm text-subtle"
      aria-live="polite"
    >
      <FiLoader
        aria-hidden="true"
        className="mr-2 h-4 w-4 self-center animate-spin motion-reduce:animate-none"
      />
      {label}
    </div>
  );
}

export default function ProductListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { displayName } = useI18n();

  const search = searchParams.get('search') ?? '';
  const categoryId = searchParams.get('category_id') ?? '';
  const supplierId = searchParams.get('supplier_id') ?? '';
  const stockStatus = (searchParams.get('stock_status') ?? '') as StockStatus | '';

  const [searchInput, setSearchInput] = useState(search);

  // Keep the text field in step with the URL, so back/forward and
  // "clear filters" never leave a stale term in the input.
  useEffect(() => {
    setSearchInput(search);
  }, [search]);
  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [categories, setCategories] = useState<PublicCategory[]>([]);
  const [suppliers, setSuppliers] = useState<PublicSupplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  /**
   * The scroll cursor: which filter-set × page is on screen. Deliberately
   * not URL state — filters deep-link, scroll depth is reading position,
   * like leafing through a paper catalog. Seeded on mount from the URL so
   * a deep link never fetches the unfiltered page first.
   */
  const filterKey = `${search}|${categoryId}|${supplierId}|${stockStatus}`;
  const [request, setRequest] = useState<{ filterKey: string; page: number }>(() => ({
    filterKey,
    page: 1,
  }));

  // A new filter set rewinds the cursor to page 1; an identical key is
  // left untouched so unrelated renders never refetch.
  useEffect(() => {
    setRequest((current) =>
      current.filterKey === filterKey ? current : { filterKey, page: 1 },
    );
  }, [filterKey]);

  // Synchronous guard for the IntersectionObserver path: two intersect
  // callbacks must never spawn two cursor bumps before a state flush.
  const fetchBusyRef = useRef(false);

  // When the filter set changes (except the first mount), bring the top of
  // the results column back into view so the fresh list replaces the old
  // where the reader's eyes already are.
  const resultsRef = useRef<HTMLElement | null>(null);
  const firstFilterRun = useRef(true);
  useEffect(() => {
    if (firstFilterRun.current) {
      firstFilterRun.current = false;
      return;
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    resultsRef.current?.scrollIntoView({
      block: 'start',
      behavior: reduced ? 'auto' : 'smooth',
    });
  }, [filterKey]);

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
    const first = request.page === 1;

    fetchBusyRef.current = true;
    if (first) {
      setIsLoading(true);
      setLoadError(null);
    } else {
      setLoadingMore(true);
    }

    listProducts({
      page: request.page,
      per_page: 12,
      search: search || undefined,
      category_id: categoryId || undefined,
      supplier_id: supplierId || undefined,
      stock_status: stockStatus || undefined,
    })
      .then((response) => {
        if (cancelled) return;

        if (response.success && response.data) {
          const fresh = response.data.products;
          setMeta(response.data.meta);
          setLoadError(null);
          setProducts((previous) =>
            first || previous.length === 0 ? fresh : [...previous, ...fresh],
          );
        } else if (first) {
          setProducts([]);
          setMeta(null);
          setLoadError(describeCatalogError(response, 'products'));
        } else {
          // A page beyond the first failing keeps the list intact;
          // "Try again" re-runs the same cursor without touching the URL.
          setLoadError(describeCatalogError(response, 'more products'));
        }
      })
      .finally(() => {
        if (cancelled) return;
        fetchBusyRef.current = false;
        setIsLoading(false);
        setLoadingMore(false);
      });

    return () => {
      cancelled = true;
    };
  }, [request]); // filterKey gates the query values; request carries the page.

  // The sentinel: start fetching the next page while the reader is still
  // ~600px away, so cards are usually painting by the time they arrive.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const hasMore = meta !== null && !loadError && meta.current_page < meta.last_page;

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore || isLoading) return;

    const onIntersect = (entries: IntersectionObserverEntry[]) => {
      if (!entries[0]?.isIntersecting || fetchBusyRef.current) return;
      fetchBusyRef.current = true;
      setRequest((current) => ({ ...current, page: current.page + 1 }));
    };

    const observer = new IntersectionObserver(onIntersect, {
      rootMargin: '600px 0px',
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, isLoading]);

  const updateParams = (changes: Record<string, string>) => {
    const next = new URLSearchParams(searchParams);

    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }

    // The URL never carries page state anymore; drop leftovers from old links.
    next.delete('page');
    setSearchParams(next);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateParams({ search: searchInput.trim() });
  };

  const hasFilters = Boolean(search || categoryId || supplierId || stockStatus);
  const activeFilterCount = [
    Boolean(search),
    Boolean(categoryId),
    Boolean(supplierId),
    Boolean(stockStatus),
  ].filter(Boolean).length;

  const clearFilters = () => {
    setSearchInput('');
    setSearchParams(new URLSearchParams());
    setSheetOpen(false);
  };

  useEffect(() => {
    if (!sheetOpen) return;

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSheetOpen(false);
    };

    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [sheetOpen]);

  const categoryOptions: RadioOption[] = [
    { value: '', label: 'All categories' },
    ...categories.map((category) => ({
      value: String(category.id),
      label: displayName(category),
    })),
  ];

  const supplierOptions: RadioOption[] = [
    { value: '', label: 'All suppliers' },
    ...suppliers.map((supplier) => ({
      value: String(supplier.id),
      label: supplier.shop_name,
    })),
  ];

  /* The mobile sheet keeps the select-based fields (distinct ids and radio
   * names from the rail, so both can coexist in the document). */
  const sheetFields = (
    <>
      <div className="lg:col-span-2">
        <label htmlFor="sheet-search" className="block text-xs font-medium text-muted">
          Search
        </label>
        <div className="mt-1 flex overflow-hidden rounded-md border border-line bg-plate focus-within:border-accent focus-within:ring-2 focus-within:ring-accent motion-safe:transition-colors">
          <FiSearch aria-hidden="true" className="ml-3 h-4 w-4 flex-none self-center text-subtle" />
          <input
            id="sheet-search"
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Name, SKU, brand or model"
            maxLength={100}
            className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm text-ink outline-none"
          />
          <button
            type="submit"
            className="flex-none bg-primary px-3 text-white hover:bg-primary-hover active:scale-[.99]"
          >
            Search
          </button>
        </div>
      </div>

      <div>
        <label htmlFor="sheet-category" className="block text-xs font-medium text-muted">
          Category
        </label>
        <select
          id="sheet-category"
          value={categoryId}
          onChange={(event) => updateParams({ category_id: event.target.value })}
          className={inputClass(false) + ' mt-1'}
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {displayName(category)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="sheet-supplier" className="block text-xs font-medium text-muted">
          Supplier
        </label>
        <select
          id="sheet-supplier"
          value={supplierId}
          onChange={(event) => updateParams({ supplier_id: event.target.value })}
          className={inputClass(false) + ' mt-1'}
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
        <label htmlFor="sheet-stock" className="block text-xs font-medium text-muted">
          Availability
        </label>
        <select
          id="sheet-stock"
          value={stockStatus}
          onChange={(event) => updateParams({ stock_status: event.target.value })}
          className={inputClass(false) + ' mt-1'}
        >
          {STOCK_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description="Browse published products from verified suppliers. Prices shown are display prices and are confirmed in your quotation."
      />

      <div className="grid items-start gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        {/* Left filter rail: sticky while the grid scrolls. The header +
            search stay pinned; only the option lists scroll inside. */}
        <aside
          aria-label="Product filters"
          className="glass-panel sticky top-24 hidden max-h-[calc(100vh-8rem)] flex-col p-4 lg:flex"
        >
          <div className="mb-3 flex flex-none items-center justify-between">
            <h2 className="text-base font-semibold text-ink">Filters</h2>
            {hasFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                aria-label="Clear all filters"
                title="Clear all filters"
                className="flex h-8 w-8 items-center justify-center rounded-md text-accent hover:bg-accent-soft active:scale-[.99] motion-safe:transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
              >
                <FiTrash2 aria-hidden="true" className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          <form onSubmit={handleSubmit} className="mb-4 flex-none">
            <label htmlFor="rail-search" className="sr-only">
              Search the catalog
            </label>
            <div className="flex overflow-hidden rounded-lg border border-white/70 bg-white/70 backdrop-blur-md focus-within:border-accent focus-within:ring-2 focus-within:ring-accent motion-safe:transition-colors">
              <FiSearch aria-hidden="true" className="ml-3 h-4 w-4 flex-none self-center text-subtle" />
              <input
                id="rail-search"
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Name, SKU, brand…"
                maxLength={100}
                className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm text-ink outline-none"
              />
              <button
                type="submit"
                aria-label="Search"
                className="flex-none bg-primary px-2.5 text-white hover:bg-primary-hover active:scale-[.99]"
              >
                <FiSearch aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
          </form>

          <div className="no-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
            <RailSection title="Category">
              <RailRadioList
                name="rail-category"
                label="Category"
                options={categoryOptions}
                value={categoryId}
                onPick={(value) => updateParams({ category_id: value })}
              />
            </RailSection>

            <RailSection title="Supplier">
              {/* Once expanded, long supplier lists scroll inside the rail,
                  never the page. */}
              <RailRadioList
                name="rail-supplier"
                label="Supplier"
                options={supplierOptions}
                value={supplierId}
                onPick={(value) => updateParams({ supplier_id: value })}
                scroll
              />
            </RailSection>

            <RailSection title="Availability">
              <RailRadioList
                name="rail-stock"
                label="Availability"
                options={STOCK_FILTERS.map((option) => ({
                  value: option.value,
                  label: option.label,
                  dot: option.dot,
                }))}
                value={stockStatus}
                onPick={(value) => updateParams({ stock_status: value })}
              />
            </RailSection>
          </div>
        </aside>

        {/* Results column. `scroll-mt` keeps the sticky header + filter bar
            from covering the first row when the filter set changes. */}
        <section
          ref={resultsRef}
          className="min-w-0 scroll-mt-[7.5rem] space-y-6 lg:scroll-mt-24"
        >
          {/* Mobile filter bar: pinned below the site header so the filter
              and clear actions stay reachable while the grid scrolls. */}
          <div className="sticky top-[68px] z-30 -mx-4 flex items-center justify-between gap-3 border-b border-white/60 bg-white/95 px-4 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)] backdrop-blur-xl sm:-mx-6 sm:px-6 lg:hidden">
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/70 bg-white/70 px-3 py-1.5 text-sm font-medium text-ink shadow-glass backdrop-blur-md active:scale-[.99]"
            >
              <FiFilter aria-hidden="true" className="h-4 w-4" />
              Filters{activeFilterCount > 0 ? ` · ${activeFilterCount}` : ''}
            </button>
            {hasFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="text-sm font-medium text-ink hover:text-accent"
              >
                Clear filters
              </button>
            ) : null}
          </div>

          {/* First-load failure: the error is the whole story. A page-2+
              failure is reported further down, beside "Try again". */}
          {loadError && !products.length ? <Alert tone="error">{loadError}</Alert> : null}

          {meta && !isLoading && !loadError ? (
            <p className="text-sm text-muted" aria-live="polite">
              <span className="font-medium text-ink tabular-nums">{meta.total}</span>{' '}
              {meta.total === 1 ? 'product' : 'products'}
              {hasFilters ? ' match your filters' : ' in the catalog'}
            </p>
          ) : null}

          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }, (_, index) => (
                <SkeletonCard key={index} />
              ))}
            </div>
          ) : null}

          {!isLoading && !loadError && products.length === 0 ? (
            <div className="space-y-4">
              <EmptyState
                title="No products match your filters"
                hint={
                  hasFilters
                    ? 'Try clearing a filter or searching for something broader.'
                    : 'No products have been published yet.'
                }
              />
              {hasFilters ? (
                <div className="text-center">
                  <button type="button" onClick={clearFilters} className={secondaryButtonClass}>
                    Clear filters
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {!isLoading && !loadError && products.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : null}

          {/* The scroller's floor: fetching the next page begins while the
              reader is ~600px away; the spinner row shows if they arrive
              sooner. Replenished silently, replaced on failure. */}
          {!loadError || products.length === 0 ? (
            <div ref={sentinelRef} aria-hidden="true" className="h-1" />
          ) : null}

          {loadingMore ? <LoadingMoreRow label="Bringing up more products…" /> : null}

          {meta && !isLoading && !loadError && !hasMore ? (
            <p className="text-center text-sm text-subtle">
              End of catalog — {meta.total}{' '}
              {meta.total === 1 ? 'product' : 'products'} shown
            </p>
          ) : null}

          {/* Load-more failure: the list stays put; one retry re-reads the
              same cursor. */}
          {loadError && products.length > 0 && !isLoading ? (
            <div className="flex flex-col items-center gap-2 py-6">
              <p className="text-center text-sm text-red-600">{loadError}</p>
              <button
                type="button"
                onClick={() => setRequest((current) => ({ ...current }))}
                className={secondaryButtonClass}
              >
                Try again
              </button>
            </div>
          ) : null}
        </section>
      </div>

      {/* Mobile filters sheet: slides up from the bottom edge, Esc closes. */}
      {sheetOpen ? (
        <div className="fixed inset-0 z-50 bg-ink/40 lg:hidden" onClick={() => setSheetOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Filters"
            className="motion-safe:animate-sheet-in flex max-h-[85vh] flex-col overflow-y-auto rounded-t-2xl border-t border-white/60 bg-white/90 p-4 backdrop-blur-xl"
            style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-ink">Filters</h2>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label="Close filters"
                className="flex h-10 w-10 items-center justify-center rounded-md text-ink active:bg-paper"
              >
                <FiX aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3">
              {sheetFields}
            </form>

            <div className="mt-4 flex items-center gap-2">
              {hasFilters ? (
                <button type="button" onClick={clearFilters} className={secondaryButtonClass + ' flex-1'}>
                  Clear filters
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className={secondaryButtonClass + ' flex-[2]'}
              >
                Show {meta ? `${meta.total} ` : ''}products
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
