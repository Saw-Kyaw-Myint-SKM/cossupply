/**
 * Category Page (Task 05).
 *
 * Lists the ACTIVE categories as a light catalog index — not a grid of heavy
 * cards. Each tile deep-links into the product list with `category_id`
 * applied, which is why the product list keeps its filters in the URL.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowRight } from 'react-icons/fi';
import { listCategories, type PublicCategory } from '../../../api/catalog';
import {
  Alert,
  categoryFallbackImage,
  EmptyState,
  LoadingPanel,
  PageHeader,
} from '../../../components/catalog-ui/CatalogUi';
import { describeCatalogError } from '../components/ProductUi';

export default function CategoryListPage() {
  const [categories, setCategories] = useState<PublicCategory[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    listCategories({ per_page: 100 })
      .then((response) => {
        if (cancelled) return;

        if (response.success && response.data) {
          setCategories(response.data.categories);
        } else {
          setCategories(null);
          setLoadError(describeCatalogError(response, 'categories'));
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading) return <LoadingPanel label="Loading categories" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categories"
        description="Choose a category to see the published products inside it."
      />

      {loadError ? <Alert tone="error">{loadError}</Alert> : null}

      {!loadError && categories && categories.length === 0 ? (
        <EmptyState
          title="No categories yet"
          hint="Categories will appear here as soon as they are activated."
        />
      ) : null}

      {!loadError && categories && categories.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <Link
              key={category.id}
              to={`/products?category_id=${category.id}`}
              className="group flex overflow-hidden rounded-lg border border-rule bg-plate hover:border-accent/40 active:scale-[.99] motion-safe:transition-colors"
            >
              <img
                src={category.image_url ?? categoryFallbackImage(category.id)}
                alt=""
                loading="lazy"
                decoding="async"
                className="h-28 w-28 flex-none object-cover sm:h-32 sm:w-32"
              />

              <div className="flex min-w-0 flex-1 flex-col p-4">
                <h2 className="text-sm font-semibold text-ink">{category.name_en}</h2>
                <p className="mt-0.5 truncate text-sm text-subtle">{category.name_mm}</p>
                {category.description ? (
                  <p className="mt-1 line-clamp-2 text-xs leading-4 text-muted">
                    {category.description}
                  </p>
                ) : null}
                <span className="mt-auto inline-flex items-center gap-1 pt-2 text-sm font-medium text-ink group-hover:text-accent motion-safe:transition-colors">
                  View products
                  <FiArrowRight aria-hidden="true" className="h-4 w-4 motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
