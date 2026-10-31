/**
 * Home Page — storefront landing.
 *
 * The composition follows the supplied storefront design: a promo carousel,
 * the product deals rail, the category ring index, featured suppliers, the
 * collection row, and the service promises. Everything data-bearing comes
 * from the public catalog endpoints; copy that states a policy (display
 * prices, quotation confirmation, cash on delivery) mirrors the product
 * specification and is never invented.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FiArrowRight,
  FiBox,
  FiChevronLeft,
  FiChevronRight,
} from 'react-icons/fi';
import {
  listCategories,
  listProducts,
  listSuppliers,
  type PublicCategory,
  type PublicProduct,
  type PublicSupplier,
} from '../../../api/catalog';
import {
  categoryFallbackImage,
  EmptyState,
  FALLBACK_BANNER,
  PricingNotice,
  SkeletonCard,
  primaryButtonClass,
} from '../../../components/catalog-ui/CatalogUi';
import { displayUnitPrice } from '../../../lib/cart-storage';
import { ProductCard, describeCatalogError } from '../components/ProductUi';
import { useI18n } from '../../../lib/i18n-context';

interface Slide {
  eyebrow: string;
  headline: string;
  offer: string;
  cta: { label: string; to: string };
}

const SLIDES: Slide[] = [
  {
    eyebrow: 'Office supplies for every desk in Myanmar',
    headline: 'Build your order list',
    offer: 'Priced by quotation',
    cta: { label: 'Shop the catalog', to: '/products' },
  },
  {
    eyebrow: 'One list, every department',
    headline: 'Stock the whole office',
    offer: 'Paper, ink, furniture & more',
    cta: { label: 'Browse categories', to: '/categories' },
  },
  {
    eyebrow: 'Cash on delivery, nationwide',
    headline: 'Pay when it arrives',
    offer: 'Quotation support over Viber',
    cta: { label: 'Start your order list', to: '/products' },
  },
];

/** The section header: muted title with a primary keyword, a quiet "View all",
 * and the 2px rule with its 300px primary underline. */
function SectionHeading({
  id,
  lead,
  emphasis,
  to,
  linkLabel = 'View all',
}: {
  id: string;
  lead: string;
  emphasis: string;
  to: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h2 id={id} className="text-[22px] font-semibold leading-tight text-muted sm:text-[24px]">
          {lead} <span className="text-primary">{emphasis}</span>
        </h2>
        <Link
          to={to}
          className="inline-flex flex-none items-center gap-2 text-sm font-medium text-ink hover:text-primary"
        >
          {linkLabel}
          <FiChevronRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      </div>
      <div className="relative h-0.5 w-full bg-white/70">
        <span aria-hidden="true" className="absolute left-0 top-0 h-[3px] w-[300px] max-w-full rounded-full bg-gradient-to-r from-primary via-sky-400 to-violet-400" />
      </div>
    </div>
  );
}

function discountPercent(product: PublicProduct): number | null {
  const unit = displayUnitPrice(product.price);
  const retail = product.price?.retail_price ?? null;
  if (unit === null || retail === null || unit >= retail || retail <= 0) return null;
  return Math.round(((retail - unit) / retail) * 100);
}

export default function HomePage() {
  const { displayName } = useI18n();
  const [categories, setCategories] = useState<PublicCategory[]>([]);
  const [suppliers, setSuppliers] = useState<PublicSupplier[]>([]);
  const [products, setProducts] = useState<PublicProduct[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);

    Promise.all([
      listCategories({ per_page: 12 }),
      listProducts({ per_page: 10 }),
      listSuppliers({ per_page: 6 }),
    ])
      .then(([categoryResponse, productResponse, supplierResponse]) => {
        if (cancelled) return;

        if (categoryResponse.success && categoryResponse.data) {
          setCategories(categoryResponse.data.categories);
        }

        if (supplierResponse.success && supplierResponse.data) {
          setSuppliers(supplierResponse.data.suppliers);
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

  // Auto-slide every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setSlide((prev) => (prev + 1) % SLIDES.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const deals =
    products?.filter((product) => discountPercent(product) !== null) ?? [];
  const featuredProducts = deals.length >= 3 ? deals : (products ?? []);
  const hasDeals = deals.length >= 3;
  const activeSlide = SLIDES[slide];
  const slideImage =
    products?.[slide % Math.max(products.length, 1)]?.photo_url ?? FALLBACK_BANNER;

  const goToSlide = (index: number) => {
    setSlide((index + SLIDES.length) % SLIDES.length);
  };

  return (
    <div className="space-y-12 lg:space-y-16">
      {/* Hero carousel */}
      <section
        aria-roledescription="carousel"
        aria-label="Store highlights"
        className="relative overflow-hidden rounded-3xl shadow-glass ring-1 ring-white/60"
      >
        <div className="relative h-[280px] sm:h-[320px] lg:h-[380px]">
          {slideImage ? (
            <img
              src={slideImage}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 h-full w-full bg-gradient-to-br from-indigo-600 via-violet-600 to-sky-500" />
          )}
          
          {/* Overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/85 via-indigo-950/45 to-transparent" />
          <div className="absolute inset-0 bg-[radial-gradient(65%_85%_at_12%_100%,rgba(0,142,204,0.38),transparent_60%)]" />
          
          {/* Content */}
          <div className="relative z-10 flex h-full items-center">
            <div className="w-full px-8 sm:px-12 lg:px-16 max-w-xl">
              <p className="text-xs font-semibold text-sky-300 mb-2 tracking-wider uppercase">{activeSlide.eyebrow}</p>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white leading-tight mb-3 drop-shadow-lg">
                {activeSlide.headline}
              </h1>
              <p className="text-base sm:text-lg text-gray-100 mb-5 drop-shadow">{activeSlide.offer}</p>
              <Link
                to={activeSlide.cta.to}
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-sky-500 px-5 py-1.5 text-sm font-semibold text-white shadow-lg shadow-primary/30 hover:shadow-primary/40 hover:brightness-105 active:scale-[0.98] transition-all"
              >
                {activeSlide.cta.label}
                <FiArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="absolute bottom-0 left-0 right-0 z-20">
          <div className="flex items-center justify-between border-t border-white/15 bg-white/10 px-6 py-3 backdrop-blur-xl">
            {/* Indicators */}
            <div className="flex items-center gap-2" role="group" aria-label="Choose a slide">
              {SLIDES.map((item, index) => (
                <button
                  key={item.headline}
                  type="button"
                  onClick={() => setSlide(index)}
                  aria-label={`Show slide ${index + 1}`}
                  aria-current={index === slide ? 'true' : undefined}
                  className="flex items-center justify-center"
                >
                  <span
                    aria-hidden="true"
                    className={`block h-1 rounded-full transition-all ${
                      index === slide ? 'w-8 bg-cyan-300' : 'w-4 bg-white/40 hover:bg-white/60'
                    }`}
                  />
                </button>
              ))}
            </div>

            {/* Arrows */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => goToSlide(slide - 1)}
                aria-label="Previous slide"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 active:scale-95 transition-all"
              >
                <FiChevronLeft aria-hidden="true" className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => goToSlide(slide + 1)}
                aria-label="Next slide"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 active:scale-95 transition-all"
              >
                <FiChevronRight aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <p aria-live="polite" className="sr-only">
          Slide {slide + 1} of {SLIDES.length}: {activeSlide.headline}
        </p>
      </section>

      {/* Product deals rail. */}
      <section aria-labelledby="home-products-heading" className="space-y-6">
        <SectionHeading
          id="home-products-heading"
          lead={hasDeals ? 'Grab the best deals on' : 'Fresh from'}
          emphasis={hasDeals ? 'office essentials' : 'our suppliers'}
          to="/products"
          linkLabel="View all"
        />

        <PricingNotice />

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 5 }, (_, index) => (
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

        {!isLoading && featuredProducts.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {featuredProducts.slice(0, 5).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : null}
      </section>

      {/* Category ring index. */}
      {categories.length > 0 ? (
        <section aria-labelledby="home-categories-heading" className="space-y-7">
          <SectionHeading
            id="home-categories-heading"
            lead="Shop by"
            emphasis="category"
            to="/categories"
          />

          <div className="grid grid-cols-4 gap-x-3 gap-y-6 sm:gap-x-4 lg:grid-cols-7">
            {categories.slice(0, 7).map((category) => (
              <Link
                key={category.id}
                to={`/products?category_id=${category.id}`}
                className="group flex flex-col items-center gap-4"
              >
                <div className="relative flex h-[76px] w-[76px] items-center justify-center overflow-hidden rounded-full border border-white/70 bg-white/60 p-2 shadow-glass backdrop-blur-md motion-safe:transition-colors group-hover:border-primary/40 group-hover:bg-white/85 sm:h-[132px] sm:w-[132px] sm:p-3">
                  <img
                    src={category.image_url ?? categoryFallbackImage(category.id)}
                    alt={displayName(category)}
                    loading="lazy"
                    decoding="async"
                    className="absolute h-full w-full object-cover"
                  />
                </div>
                <span className="text-center text-[11px] leading-snug text-ink group-hover:text-primary sm:text-[13px]">
                  {displayName(category)}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* Featured suppliers. */}
      {suppliers.length > 0 ? (
        <section aria-labelledby="home-suppliers-heading" className="space-y-7">
          <SectionHeading
            id="home-suppliers-heading"
            lead="Featured"
            emphasis="suppliers"
            to="/products"
            linkLabel="Browse all"
          />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {suppliers.slice(0, 3).map((supplier) => {
              const supplierProducts = (products ?? []).filter(
                (product) => product.supplier_id === supplier.id,
              );
              const photo = supplierProducts.find((product) => product.photo_url)?.photo_url;
              const bestDiscount = supplierProducts.reduce<number | null>((best, product) => {
                const percent = discountPercent(product);
                if (percent === null) return best;
                return best === null ? percent : Math.max(best, percent);
              }, null);
              const tag = supplier.verified ? 'Verified supplier' : 'Supplier';

              return (
                <Link
                  key={supplier.id}
                  to={`/products?supplier_id=${supplier.id}`}
                  className="group relative flex min-h-[206px] items-start overflow-hidden rounded-2xl bg-gradient-to-br from-night via-indigo-950 to-slate-950 p-6 text-white shadow-glass ring-1 ring-white/10 motion-safe:transition-shadow hover:shadow-glass-hover"
                >
                  <span
                    aria-hidden="true"
                    className="absolute -top-20 right-0 h-[250px] w-[250px] rounded-full border-[22px] border-white/5"
                  />
                  <div className="relative z-10 flex max-w-[200px] flex-col gap-5">
                    <span className="w-fit rounded-md bg-white/15 px-2.5 py-1.5 text-[9px] uppercase tracking-wide">
                      {tag}
                    </span>
                    <p className="line-clamp-2 break-words text-[22px] font-extrabold leading-[1.15] lg:text-[26px]">
                      {supplier.shop_name}
                    </p>
                    <p className="text-[15px] font-medium text-white/90 lg:text-[19px]">
                      {bestDiscount !== null
                        ? `Up to ${bestDiscount}% OFF`
                        : supplier.delivery_area
                          ? `Delivers to ${supplier.delivery_area}`
                          : 'Browse their catalog'}
                    </p>
                  </div>

                  <div className="absolute right-4 top-8 z-10 hidden h-[140px] w-[140px] items-center justify-center sm:flex">
                    {photo ? (
                      <img
                        src={photo}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-contain"
                      />
                    ) : supplier.logo_url ? (
                      <img
                        src={supplier.logo_url}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-24 w-24 rounded-xl bg-white object-contain p-2"
                      />
                    ) : (
                      <FiBox aria-hidden="true" className="h-16 w-16 text-white/25" />
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Last call for the full catalog. */}
      <div className="text-center">
        <Link
          to="/products"
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:brightness-105 motion-safe:transition-all"
        >
          Browse the full catalog
          <FiArrowRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
