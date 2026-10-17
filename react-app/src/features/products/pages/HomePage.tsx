/**
 * Home Page (Task 05).
 *
 * Public landing page for CoSupply: the hero, the category entry points, and
 * the newest published products. Everything here is served by the
 * unauthenticated catalog endpoints, so it works for a guest with no token.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  listCategories,
  listProducts,
  type PublicCategory,
  type PublicProduct,
} from '../../../api/catalog';
import {
  Alert,
  EmptyState,
  LoadingPanel,
  primaryButtonClass,
  secondaryButtonClass,
} from '../../../components/catalog-ui/CatalogUi';
import { ProductCard, describeCatalogError } from '../components/ProductUi';

export default function HomePage() {
  const [categories, setCategories] = useState<PublicCategory[]>([]);
  const [products, setProducts] = useState<PublicProduct[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

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

  return (
    <div className="space-y-10">
      <section className="rounded-lg bg-gradient-to-r from-blue-600 to-blue-800 p-8 text-white">
        <h1 className="text-3xl font-bold mb-2">Welcome to CoSupply</h1>
        <p className="text-blue-100 mb-4">
          Your trusted office supplies quotation platform
        </p>
        <p className="text-sm text-blue-200 max-w-2xl">
          Browse published products, compare display prices, build a cart, and request a
          quotation. Prices shown are display prices — final pricing is confirmed by the supplier
          in your quotation.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/products" className={`${primaryButtonClass} inline-block`}>
            Browse products
          </Link>
          <Link
            to="/categories"
            className={`${secondaryButtonClass} inline-block border border-blue-300 bg-white/10 text-white hover:bg-white/20`}
          >
            Browse categories
          </Link>
        </div>
      </section>

      <section aria-labelledby="home-categories-heading">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 id="home-categories-heading" className="text-lg font-semibold text-gray-900">
              Categories
            </h2>
            <p className="text-sm text-gray-500">Jump straight to the branch you need.</p>
          </div>
          <Link to="/categories" className="text-sm font-medium text-blue-600 hover:text-blue-800">
            All categories &rarr;
          </Link>
        </div>

        {isLoading && !categories.length ? <LoadingPanel label="Loading categories" /> : null}

        {!isLoading && categories.length === 0 && !loadError ? (
          <EmptyState title="No categories published yet" />
        ) : null}

        {categories.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {categories.map((category) => (
              <Link
                key={category.id}
                to={`/products?category_id=${category.id}`}
                className="group rounded-lg bg-white p-4 shadow transition hover:shadow-md"
              >
                <span className="block truncate text-sm font-medium text-gray-900 group-hover:text-blue-700">
                  {category.name_en}
                </span>
                <span className="mt-1 block truncate text-sm text-gray-500">
                  {category.name_mm}
                </span>
              </Link>
            ))}
          </div>
        ) : null}
      </section>

      <section aria-labelledby="home-products-heading">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 id="home-products-heading" className="text-lg font-semibold text-gray-900">
              Latest products
            </h2>
            <p className="text-sm text-gray-500">
              Newly published items from our suppliers.
            </p>
          </div>
          <Link to="/products" className="text-sm font-medium text-blue-600 hover:text-blue-800">
            All products &rarr;
          </Link>
        </div>

        {isLoading ? <LoadingPanel label="Loading products" /> : null}

        {!isLoading && loadError ? <Alert tone="error">{loadError}</Alert> : null}

        {!isLoading && !loadError && products !== null && products.length === 0 ? (
          <EmptyState
            title="No products published yet"
            hint="New products will appear here as soon as suppliers publish them."
          />
        ) : null}

        {!isLoading && products && products.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
