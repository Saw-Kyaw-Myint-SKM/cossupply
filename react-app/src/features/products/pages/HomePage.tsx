/**
 * Home Page — storefront landing.
 *
 * The composition follows the supplied storefront design: a promo carousel,
 * the product deals rail, the category ring index, the customer benefits band,
 * the service flow, and the full contact page as the closing section.
 * Everything data-bearing comes
 * from the public catalog endpoints; copy that states a policy (display
 * prices, quotation confirmation, cash on delivery) mirrors the product
 * specification and is never invented.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowRight, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import {
  listCategories,
  listProducts,
  type PublicCategory,
  type PublicProduct,
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
import { CustomerBenefits } from '../components/CustomerBenefits';
import { ServiceFlow } from '../components/ServiceFlow';
import { ContactSection } from '../../content/components/ContactSection';
import { useI18n, type TranslationKey } from '../../../lib/i18n-context';

interface Slide {
  eyebrowKey: TranslationKey;
  headlineKey: TranslationKey;
  offerKey: TranslationKey;
  ctaKey: TranslationKey;
  to: string;
}

const SLIDES: readonly Slide[] = [
  {
    eyebrowKey: 'homeSlide1Eyebrow',
    headlineKey: 'homeSlide1Headline',
    offerKey: 'homeSlide1Offer',
    ctaKey: 'homeSlide1Cta',
    to: '/products',
  },
  {
    eyebrowKey: 'homeSlide2Eyebrow',
    headlineKey: 'homeSlide2Headline',
    offerKey: 'homeSlide2Offer',
    ctaKey: 'homeSlide2Cta',
    to: '/categories',
  },
  {
    eyebrowKey: 'homeSlide3Eyebrow',
    headlineKey: 'homeSlide3Headline',
    offerKey: 'homeSlide3Offer',
    ctaKey: 'homeSlide3Cta',
    to: '/products',
  },
];

/** The section header: muted title with a primary keyword, a quiet "View all",
 * and the 2px rule with its 300px primary underline. */
function SectionHeading({
  id,
  lead,
  emphasis,
  to,
  linkLabel,
}: {
  id: string;
  lead: string;
  emphasis: string;
  to: string;
  linkLabel?: string;
}) {
  const { t } = useI18n();
  const label = linkLabel ?? t('viewAll');

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
          {label}
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
  const { displayName, t } = useI18n();
  const [categories, setCategories] = useState<PublicCategory[]>([]);
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
    ])
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

  // Auto-slide every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setSlide((prev) => (prev + 1) % SLIDES.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const deals =
    products?.filter((product) => discountPercent(product) !== null) ?? [];
  // Lead with deals, then top up with the rest so the rail always fills two
  // full rows of five on desktop.
  const featuredProducts =
    deals.length >= 3
      ? [
          ...deals,
          ...(products ?? []).filter((product) => discountPercent(product) === null),
        ]
      : (products ?? []);
  const hasDeals = deals.length >= 3;
  const activeSlide = SLIDES[slide];
  const slideImage =
    products?.[slide % Math.max(products.length, 1)]?.photo_url ?? FALLBACK_BANNER;
  const activeSlideHeadline = t(activeSlide.headlineKey);

  const goToSlide = (index: number) => {
    setSlide((index + SLIDES.length) % SLIDES.length);
  };

  return (
    <div className="space-y-12 lg:space-y-16">
      {/* Hero carousel */}
      <section
        aria-roledescription="carousel"
        aria-label={t('homeCarouselLabel')}
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
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-indigo-950/50 to-transparent" />
          <div className="absolute inset-0 bg-[radial-gradient(65%_85%_at_12%_100%,rgba(0,142,204,0.38),transparent_60%)]" />
          
          {/* Content — headline, gradient rule, offer, CTA. The rule carries
              the brand accent the old eyebrow pill used to provide. */}
          <div className="relative z-10 flex h-full items-end pb-[81px]">
            <div className="w-full max-w-[620px] px-6 sm:px-10 lg:px-14">
              <h1
                key={activeSlide.headlineKey}
                className="whitespace-nowrap text-[22px] font-extrabold leading-[1.1] tracking-[-0.02em] text-white drop-shadow-lg motion-safe:animate-rise-in max-[359px]:whitespace-normal sm:text-[34px] lg:text-[40px]"
              >
                {activeSlideHeadline}
              </h1>
              <span
                key={`rule-${activeSlide.headlineKey}`}
                aria-hidden="true"
                className="mt-4 mb-3 block h-[3px] w-10 origin-left rounded-full bg-gradient-to-r from-primary via-sky-400 to-violet-400 motion-safe:animate-rule-grow sm:w-14"
              />
              <p className="max-w-[44ch] text-[14px] leading-relaxed text-white/80 drop-shadow sm:text-[15px] lg:text-base">
                {t(activeSlide.offerKey)}
              </p>
              <Link
                to={activeSlide.to}
                className="group mt-4 inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-gradient-to-r from-primary to-sky-500 py-1.5 pl-4 pr-1.5 text-xs font-semibold text-white shadow-md shadow-primary/30 transition-all hover:brightness-105 hover:shadow-primary/40 active:scale-[0.98] sm:mt-6 sm:gap-2.5 sm:py-2 sm:pl-5 sm:pr-2 sm:text-sm"
              >
                {t(activeSlide.ctaKey)}
                <span
                  aria-hidden="true"
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15 transition-transform group-hover:translate-x-0.5 sm:h-7 sm:w-7"
                >
                  <FiArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </span>
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="absolute bottom-0 left-0 right-0 z-20">
          <div className="flex items-center justify-between border-t border-white/15 bg-white/10 px-6 py-3 backdrop-blur-xl">
            {/* Indicators */}
            <div className="flex items-center gap-2" role="group" aria-label={t('homeChooseSlide')}>
              {SLIDES.map((item, index) => (
                <button
                  key={item.headlineKey}
                  type="button"
                  onClick={() => setSlide(index)}
                  aria-label={t('homeShowSlide', { number: index + 1 })}
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
                aria-label={t('homePreviousSlide')}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 active:scale-95 transition-all"
              >
                <FiChevronLeft aria-hidden="true" className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => goToSlide(slide + 1)}
                aria-label={t('homeNextSlide')}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 active:scale-95 transition-all"
              >
                <FiChevronRight aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <p aria-live="polite" className="sr-only">
          {t('homeSlideStatus', {
            current: slide + 1,
            total: SLIDES.length,
            title: activeSlideHeadline,
          })}
        </p>
      </section>

      {/* Product deals rail. */}
      <section aria-labelledby="home-products-heading" className="space-y-6">
        <SectionHeading
          id="home-products-heading"
          lead={t(hasDeals ? 'homeDealsLead' : 'homeFreshLead')}
          emphasis={t(hasDeals ? 'homeDealsEmphasis' : 'homeFreshEmphasis')}
          to="/products"
        />

        <PricingNotice />

        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
            {Array.from({ length: 10 }, (_, index) => (
              <SkeletonCard key={index} compact />
            ))}
          </div>
        ) : null}

        {!isLoading && loadError ? (
          <div className="space-y-4">
            <EmptyState title={t('homeProductsUnavailable')} hint={loadError} />
            <div className="text-center">
              <Link to="/products" className={`${primaryButtonClass} inline-block`}>
                {t('homeTryFullCatalog')}
              </Link>
            </div>
          </div>
        ) : null}

        {!isLoading && !loadError && products !== null && products.length === 0 ? (
          <EmptyState
            title={t('homeNoProductsTitle')}
            hint={t('homeNoProductsHint')}
          />
        ) : null}

        {!isLoading && featuredProducts.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
            {featuredProducts.slice(0, 10).map((product) => (
              <ProductCard key={product.id} product={product} compact />
            ))}
          </div>
        ) : null}
      </section>

      {/* Category ring index. */}
      {categories.length > 0 ? (
        <section aria-labelledby="home-categories-heading" className="space-y-7">
          <SectionHeading
            id="home-categories-heading"
            lead={t('homeShopByLead')}
            emphasis={t('homeShopByEmphasis')}
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

      <CustomerBenefits />

      <ServiceFlow />

      {/* Closing contact section: the whole contact content lives here, so the
          header's Contact link can scroll to it instead of opening a page. */}
      <ContactSection />
    </div>
  );
}
