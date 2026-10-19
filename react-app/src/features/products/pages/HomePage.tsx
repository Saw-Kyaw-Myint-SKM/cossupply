/**
 * Home Page (Task 05).
 *
 * Public landing page for CoSupply: the catalog-entry hero (headline, search,
 * category chip rail), the category index, and the newest published products.
 * Everything here is served by the unauthenticated catalog endpoints, so it
 * works for a guest with no token.
 */
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiArrowRight, FiSearch } from 'react-icons/fi';
import {
  listCategories,
  listProducts,
  type PublicCategory,
  type PublicProduct,
} from '../../../api/catalog';
import {
  EmptyState,
  PricingNotice,
  SkeletonCard,
  primaryButtonClass,
  secondaryButtonClass,
} from '../../../components/catalog-ui/CatalogUi';
import { ProductCard, describeCatalogError } from '../components/ProductUi';

export default function HomePage() {
  const [categories, setCategories] = useState<PublicCategory[]>([]);
  const [products, setProducts] = useState<PublicProduct[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [term, setTerm] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);

    Promise.all([listCategories({ per_page: 8 }), listProducts({ per_page: 8 })])
      .then(([categoryResponse, productResponse]) => {
        if (cancelled) return;

        if (categoryResponse.success && categoryResponse.data) {
          setCategories(categoryResponse.data.categories);
        }

        if (productResponse.success && productResponse.data) {
          setProducts(productResponse.data.products);
        } else if (!productResponse.success) {
          setLoadError(describeCatalogError(productResponse, 'products'));
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = term.trim();
    navigate(query ? `/products?search=${encodeURIComponent(query)}` : '/products');
  };

  return (
    <div className="space-y-12">
      {/*
       * The hero does catalog work: a headline, the search field with the
       * accent focus ring, and the branch chips. Open composition on paper —
       * no gradient slab, no card.
       */}
      <section className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
            Office supplies for every desk in Myanmar,
            <span className="text-accent"> priced by quotation.</span>
          </h1>
          <p className="mt-3 max-w-lg text-gray-600">
            Browse the catalog, build an order list, and request a quotation. Your supplier
            confirms the final price — nothing on this page is a bill.
          </p>

          <form
            role="search"
            onSubmit={submitSearch}
            className="mt-6 flex w-full max-w-xl items-stretch overflow-hidden rounded-lg border border-gray-300 bg-plate shadow-sm focus-within:border-accent focus-within:ring-2 focus-within:ring-accent motion-safe:transition-colors"
          >
            <label htmlFor="hero-search" className="sr-only">
              Search the catalog
            </label>
            <div className="flex w-full items-center">
              <FiSearch aria-hidden="true" className="ml-3 h-4 w-4 flex-none text-gray-400" />
              <input
                id="hero-search"
                type="search"
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="What does the office need? A4 paper, ink, chairs…"
                maxLength={100}
                className="w-full bg-transparent px-2.5 py-3 text-sm text-ink outline-none"
              />
            </div>
            <button
              type="submit"
              className="flex-none bg-primary px-5 text-white hover:bg-primary-hover active:scale-[.99] motion-safe:transition-colors"
            >
              Search
            </button>
          </form>
        </div>

        <div className="lg:col-span-5 lg:pl-8">
          <div className="border-l border-rule pl-8">
            <h2 className="text-sm font-semibold text-ink">Jump to a branch</h2>
            {categories.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {categories.slice(0, 6).map((category) => (
                  <Link
                    key={category.id}
                    to={`/products?category_id=${category.id}`}
                    className="rounded-full border border-gray-300 bg-plate px-3 py-1.5 text-sm text-gray-700 hover:border-accent hover:text-accent active:scale-[.99] motion-safe:transition-colors"
                  >
                    {category.name_en}
                  </Link>
                ))}
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="block h-8 w-24 animate-pulse rounded-full bg-gray-100" />
                <span className="block h-8 w-28 animate-pulse rounded-full bg-gray-100" />
                <span className="block h-8 w-20 animate-pulse rounded-full bg-gray-100" />
              </div>
            )}
            <Link
              to="/categories"
              className="inline-flex items-center gap-1 mt-4 text-sm font-medium text-ink hover:text-accent"
            >
              All categories
              <FiArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="home-products-heading" className="space-y-4">
        <div className="flex items-end justify-between gap-4 border-b border-rule pb-3">
          <div>
            <h2 id="home-products-heading" className="text-lg font-semibold text-ink">
              Latest products
            </h2>
            <p className="text-sm text-gray-500">Newly published items from our suppliers.</p>
          </div>
          <Link
            to="/products"
            className="inline-flex items-center gap-1 text-sm font-medium text-ink hover:text-accent"
          >
            All products
            <FiArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        </div>

        <PricingNotice />

        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }, (_, index) => (
              <SkeletonCard key={index} />
            ))}
          </div>
        ) : null}

        {!isLoading && loadError ? (
          <div className="space-y-4">
            <EmptyState title="Products could not be loaded" hint={loadError} />
            <div className="text-center">
              <Link to="/products" className={`${primaryButtonClass} inline-block`}>
                Try the full catalog
              </Link>
            </div>
          </div>
        ) : null}

        {!isLoading && !loadError && products !== null && products.length === 0 ? (
          <EmptyState
            title="No products published yet"
            hint="New products will appear here as soon as suppliers publish them."
          />
        ) : null}

        {!isLoading && products && products.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : null}

        <div className="text-center">
          <Link
            to="/products"
            className={`${secondaryButtonClass} inline-flex items-center gap-1.5`}
          >
            Browse the full catalog
            <FiArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
