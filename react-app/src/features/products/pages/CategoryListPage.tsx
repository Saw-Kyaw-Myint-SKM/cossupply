/**
 * Category Page (Task 05).
 *
 * Lists the ACTIVE categories so guests can navigate the catalog by branch.
 * Each card deep-links into the product list with `category_id` applied, which
 * is why the product list keeps its filters in the URL.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listCategories, type PublicCategory } from '../../../api/catalog';
import {
  Alert,
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
              className="group flex flex-col overflow-hidden rounded-lg bg-white shadow transition hover:shadow-md"
            >
              {category.image_url ? (
                <img
                  src={category.image_url}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-32 w-full object-cover"
                />
              ) : (
                <div className="flex h-32 w-full items-center justify-center bg-gray-100 text-sm text-gray-400">
                  No image
                </div>
              )}

              <div className="flex flex-1 flex-col p-4">
                <h2 className="text-sm font-semibold text-gray-900 group-hover:text-blue-700">
                  {category.name_en}
                </h2>
                <p className="mt-1 text-sm text-gray-500">{category.name_mm}</p>
                {category.description ? (
                  <p className="mt-2 line-clamp-2 text-sm text-gray-600">{category.description}</p>
                ) : null}
                <span className="mt-auto pt-3 text-sm font-medium text-blue-600">
                  View products &rarr;
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
