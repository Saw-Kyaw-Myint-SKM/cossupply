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
import { useI18n } from '../../../lib/i18n-context';
import { alternateCatalogName } from '../../../lib/localization';

export default function CategoryListPage() {
  const { t, locale, displayName } = useI18n();
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

  if (isLoading) return <LoadingPanel label={t('loadingCategories')} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('categoriesTitle')}
        description={t('categoriesDescription')}
      />

      {loadError ? <Alert tone="error">{loadError}</Alert> : null}

      {!loadError && categories && categories.length === 0 ? (
        <EmptyState
          title={t('noCategoriesYet')}
          hint={t('categoriesComingSoon')}
        />
      ) : null}

      {!loadError && categories && categories.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <Link
              key={category.id}
              to={`/products?category_id=${category.id}`}
              className="glass-card glass-card-hover group flex overflow-hidden active:scale-[.99]"
            >
              <img
                src={category.image_url ?? categoryFallbackImage(category.id)}
                alt={displayName(category)}
                loading="lazy"
                decoding="async"
                className="h-28 w-28 flex-none object-cover sm:h-32 sm:w-32"
              />

              <div className="flex min-w-0 flex-1 flex-col p-4">
                <h2 className="text-sm font-semibold text-ink">{displayName(category)}</h2>
                {alternateCatalogName(category, locale) ? (
                  <p className="mt-0.5 truncate text-sm text-subtle">
                    <span className="sr-only">{t('otherLanguageName')}: </span>
                    {alternateCatalogName(category, locale)}
                  </p>
                ) : null}
                {category.description ? (
                  <p className="mt-1 line-clamp-2 text-xs leading-4 text-muted">
                    {category.description}
                  </p>
                ) : null}
                <span className="mt-auto inline-flex items-center gap-1 pt-2 text-sm font-medium text-ink group-hover:text-accent motion-safe:transition-colors">
                  {t('viewProducts')}
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
