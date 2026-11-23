/**
 * Home Page — storefront landing.
 *
 * The composition follows the supplied storefront design: an editorial hero
 * carousel, the product deals rail, the category ring index, the customer
 * benefits band, the service flow, and the full contact page as the closing
 * section. Everything data-bearing comes
 * from the public catalog endpoints; copy that states a policy (display
 * prices, quotation confirmation, cash on delivery) mirrors the product
 * specification and is never invented.
 */
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowRight, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import {
  listCategories,
  listProducts,
  type PublicCategory,
  type PublicProduct,
} from '../../../api/catalog';
import { listBanners, type PublicBanner } from '../../../api/banners';
import {
  categoryFallbackImage,
  EmptyState,
  PricingNotice,
  SkeletonCard,
  primaryButtonClass,
} from '../../../components/catalog-ui/CatalogUi';
import { displayUnitPrice } from '../../../lib/cart-storage';
import {
  DEFAULT_BANNER_THEME,
  bannerGlow,
  bannerGrid,
  getBannerTheme,
  type BannerTheme,
} from '../../../lib/banner-themes';
import { ProductCard, describeCatalogError } from '../components/ProductUi';
import { CustomerBenefits } from '../components/CustomerBenefits';
import { ServiceFlow } from '../components/ServiceFlow';
import { ContactSection } from '../../content/components/ContactSection';
import { useI18n, type TranslationKey } from '../../../lib/i18n-context';

/** One normalised hero message, whether it came from the DB or the fallback. */
interface HeroSlide {
  key: string;
  title: string;
  subtitle: string | null;
  ctaLabel: string;
  linkUrl: string | null;
  imageUrl: string | null;
  theme: BannerTheme;
}

/** Internal links use the router; absolute links open in a new tab. */
function HeroCta({
  to,
  className,
  style,
  arrowClassName,
  children,
}: {
  to: string;
  className: string;
  style: CSSProperties;
  arrowClassName: string;
  children: ReactNode;
}) {
  const content = (
    <>
      {children}
      <span
        aria-hidden="true"
        className={`flex h-6 w-6 items-center justify-center rounded-full transition-transform group-hover:translate-x-0.5 sm:h-7 sm:w-7 ${arrowClassName}`}
      >
        <FiArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
      </span>
    </>
  );

  if (/^https?:\/\//i.test(to)) {
    return (
      <a href={to} target="_blank" rel="noopener noreferrer" className={className} style={style}>
        {content}
      </a>
    );
  }

  return (
    <Link to={to} className={className} style={style}>
      {content}
    </Link>
  );
}

const AUTOPLAY_MS = 5000;

/**
 * Pause the carousel for visitors who ask their system to reduce motion.
 * `matchMedia` is absent during the server render used by the tests.
 */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);

    update();
    query.addEventListener?.('change', update);

    return () => query.removeEventListener?.('change', update);
  }, []);

  return reduced;
}

interface FallbackSlide {
  key: string;
  headlineKey: TranslationKey;
  offerKey: TranslationKey;
  ctaKey: TranslationKey;
  to: string;
  theme: BannerTheme;
}

/** Rotating copy shown when the admin has not published any banner yet. */
const FALLBACK_SLIDES: readonly FallbackSlide[] = [
  {
    key: 'fallback-1',
    headlineKey: 'homeSlide1Headline',
    offerKey: 'homeSlide1Offer',
    ctaKey: 'homeSlide1Cta',
    to: '/products',
    theme: 'ink',
  },
  {
    key: 'fallback-2',
    headlineKey: 'homeSlide2Headline',
    offerKey: 'homeSlide2Offer',
    ctaKey: 'homeSlide2Cta',
    to: '/categories',
    theme: 'violet',
  },
  {
    key: 'fallback-3',
    headlineKey: 'homeSlide3Headline',
    offerKey: 'homeSlide3Offer',
    ctaKey: 'homeSlide3Cta',
    to: '/products',
    theme: 'ocean',
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
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 id={id} className="text-[22px] font-semibold leading-tight text-muted sm:text-[24px]">
          {lead} <span className="text-primary">{emphasis}</span>
        </h2>
        {/* A real pill, not a quiet text link: this is the way out of the
            five-card rail into the full catalog, so it has to read as an
            action on a small phone. */}
        <Link
          to={to}
          className="group inline-flex flex-none items-center gap-1.5 rounded-full border border-primary/30 bg-white/85 px-3.5 py-1.5 text-sm font-semibold text-primary shadow-sm ring-1 ring-white/70 backdrop-blur transition-colors hover:border-primary hover:bg-primary hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          {label}
          <FiArrowRight
            aria-hidden="true"
            className="h-4 w-4 motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5"
          />
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
  const { displayName, locale, t } = useI18n();
  const [categories, setCategories] = useState<PublicCategory[]>([]);
  const [products, setProducts] = useState<PublicProduct[] | null>(null);
  const [banners, setBanners] = useState<PublicBanner[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [slide, setSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [progressKey, setProgressKey] = useState(0);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);

    Promise.all([
      listCategories({ per_page: 12 }),
      listProducts({ per_page: 10 }),
      listBanners(),
    ])
      .then(([categoryResponse, productResponse, bannerResponse]) => {
        if (cancelled) return;

        if (categoryResponse.success && categoryResponse.data) {
          setCategories(categoryResponse.data.categories);
        }

        if (productResponse.success && productResponse.data) {
          setProducts(productResponse.data.products);
        } else if (!productResponse.success) {
          setLoadError(describeCatalogError(productResponse, 'products'));
        }

        if (bannerResponse.success && bannerResponse.data) {
          setBanners(bannerResponse.data.banners);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
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

  // Locale-aware text pick with a fallback to the other language, so a banner
  // never renders blank just because one translation is missing.
  const localized = (mm: string | null, en: string | null): string => {
    const mmText = mm?.trim() ?? '';
    const enText = en?.trim() ?? '';
    return locale === 'my' ? mmText || enText : enText || mmText;
  };

  const dbSlides: HeroSlide[] = (banners ?? []).map((banner) => ({
    key: `banner-${banner.id}`,
    title: localized(banner.title_mm, banner.title_en),
    subtitle: localized(banner.subtitle_mm, banner.subtitle_en) || null,
    ctaLabel:
      localized(banner.cta_label_mm, banner.cta_label_en) || t('homeBannerCtaFallback'),
    linkUrl: banner.link_url,
    imageUrl: banner.image_url,
    theme: banner.background_style ?? DEFAULT_BANNER_THEME,
  }));

  const fallbackSlides: HeroSlide[] = FALLBACK_SLIDES.map((item) => ({
    key: item.key,
    title: t(item.headlineKey),
    subtitle: t(item.offerKey),
    ctaLabel: t(item.ctaKey),
    linkUrl: item.to,
    imageUrl: null,
    theme: item.theme,
  }));

  const slides = dbSlides.length > 0 ? dbSlides : fallbackSlides;
  const slideCount = slides.length;
  const activeIndex = slideCount > 0 ? slide % slideCount : 0;
  const activeSlide = slides[activeIndex];
  const activeTheme = getBannerTheme(activeSlide.theme);
  const hasAnyImage = slides.some((item) => item.imageUrl !== null);
  const sourceKey =
    dbSlides.length > 0 ? dbSlides.map((item) => item.key).join('|') : 'fallback';

  // Restart from the first slide whenever the source changes (for example
  // when the DB banners arrive after the fallback set).
  useEffect(() => {
    setSlide(0);
  }, [sourceKey]);

  // Advance once per slide. Pausing on hover/focus (and reduced motion) stops
  // the timer; resuming restarts a full progress segment.
  useEffect(() => {
    if (prefersReducedMotion || isPaused || slideCount <= 1) return;

    setProgressKey((key) => key + 1);
    const timer = setTimeout(() => {
      setSlide((previous) => (previous + 1) % slideCount);
    }, AUTOPLAY_MS);

    return () => clearTimeout(timer);
  }, [prefersReducedMotion, isPaused, slideCount, activeIndex]);

  const goToSlide = (index: number) => {
    if (slideCount === 0) return;
    setSlide(((index % slideCount) + slideCount) % slideCount);
    setProgressKey((key) => key + 1);
  };

  return (
    <div className="space-y-12 lg:space-y-16">
      {/* Hero carousel — admin-managed banners with their own palettes, or the
          fallback set when the catalog has no active banner yet. */}
      <section
        aria-roledescription="carousel"
        aria-label={t('homeCarouselLabel')}
        className="relative overflow-hidden rounded-3xl shadow-glass ring-1 ring-black/5"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {/* One background layer per slide, crossfading so each banner keeps its
            own palette and, on mobile, its own image. */}
        {slides.map((item, index) => {
          const itemTheme = getBannerTheme(item.theme);
          const isActive = index === activeIndex;

          return (
            <div
              key={item.key}
              aria-hidden="true"
              className={`pointer-events-none absolute inset-0 transition-opacity duration-700 ease-out ${
                isActive ? 'opacity-100' : 'opacity-0'
              }`}
              style={{ backgroundImage: itemTheme.background }}
            >
              {item.imageUrl ? (
                <>
                  <img
                    src={item.imageUrl}
                    alt=""
                    loading={index === 0 ? 'eager' : 'lazy'}
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover lg:hidden"
                  />
                  <div
                    className="absolute inset-0 lg:hidden"
                    style={{ backgroundImage: itemTheme.imageScrim }}
                  />
                </>
              ) : null}
              <div
                className={`absolute inset-0 ${item.imageUrl ? 'hidden lg:block' : ''}`}
                style={{ backgroundImage: bannerGrid(itemTheme) }}
              />
              <div
                className={`absolute inset-0 ${item.imageUrl ? 'hidden lg:block' : ''}`}
                style={{ backgroundImage: bannerGlow(itemTheme) }}
              />
            </div>
          );
        })}

        {hasAnyImage ? null : (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-2 top-1/2 -translate-y-1/2 select-none font-black leading-none tracking-tighter text-[clamp(7rem,22vw,18rem)] lg:right-6"
            style={{ color: activeTheme.numeral }}
          >
            {String(activeIndex + 1).padStart(2, '0')}
          </span>
        )}

        <div
          className={`relative z-10 px-5 py-8 sm:px-10 sm:py-12 lg:px-12 lg:py-12 ${
            hasAnyImage
              ? 'flex min-h-[380px] flex-col justify-end gap-8 lg:grid lg:min-h-0 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:gap-10'
              : ''
          }`}
        >
          <div
            key={activeSlide.key}
            className={`motion-safe:animate-rise-in ${
              hasAnyImage ? 'max-w-2xl' : 'max-w-3xl'
            }`}
            onFocusCapture={() => setIsPaused(true)}
            onBlurCapture={() => setIsPaused(false)}
          >
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.24em]"
              style={{ color: activeTheme.accent }}
            >
              {t('homeHeroOverline')}
            </p>
            <h1
              id="home-hero-heading"
              className={`mt-5 max-w-[20ch] font-extrabold tracking-[-0.02em] ${
                hasAnyImage
                  ? 'text-[clamp(1.9rem,3.6vw,3.1rem)]'
                  : 'text-[clamp(2rem,4.2vw,3.6rem)]'
              } ${locale === 'my' ? 'leading-[1.5]' : 'leading-[1.04]'}`}
              style={{ color: activeTheme.heading }}
            >
              {activeSlide.title}
            </h1>
            <span
              aria-hidden="true"
              className="mt-5 mb-4 block h-[2px] w-14 origin-left rounded-full motion-safe:animate-rule-grow"
              style={{ backgroundColor: activeTheme.accent }}
            />
            {activeSlide.subtitle ? (
              <p
                className="max-w-[56ch] text-[15px] leading-relaxed sm:text-base"
                style={{ color: activeTheme.body }}
              >
                {activeSlide.subtitle}
              </p>
            ) : null}
            {activeSlide.linkUrl ? (
              <HeroCta
                to={activeSlide.linkUrl}
                style={{ backgroundColor: activeTheme.accent, color: activeTheme.ctaText }}
                arrowClassName={activeTheme.isLight ? 'bg-black/10' : 'bg-white/15'}
                className="group mt-6 inline-flex items-center gap-1.5 rounded-full py-2 pl-4 pr-1.5 text-[13px] font-semibold shadow-lg transition-transform hover:-translate-y-0.5 active:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:gap-2 sm:py-2.5 sm:pl-6 sm:pr-2 sm:text-sm"
              >
                {activeSlide.ctaLabel}
              </HeroCta>
            ) : null}
          </div>

          {hasAnyImage ? (
            <div className="relative mx-auto hidden h-[340px] w-full max-w-xl lg:block lg:max-w-none">
              {slides.map((item, index) => {
                const itemTheme = getBannerTheme(item.theme);
                const isActive = index === activeIndex;

                return (
                  <div
                    key={item.key}
                    aria-hidden={!isActive}
                    className={`absolute inset-0 transition-opacity duration-700 ease-out ${
                      isActive ? 'opacity-100' : 'opacity-0'
                    }`}
                  >
                    <div
                      aria-hidden="true"
                      className="absolute -inset-3 rounded-[30px]"
                      style={{ border: `1px solid ${itemTheme.accent}45` }}
                    />
                    {item.imageUrl ? (
                      <div
                        className={`relative h-full w-full overflow-hidden rounded-2xl shadow-2xl ${
                          itemTheme.isLight ? 'ring-1 ring-black/10' : 'ring-1 ring-white/15'
                        }`}
                      >
                        <img
                          src={item.imageUrl}
                          alt=""
                          loading={index === 0 ? 'eager' : 'lazy'}
                          decoding="async"
                          className="h-full w-full object-cover"
                        />
                        <div
                          aria-hidden="true"
                          className={`pointer-events-none absolute inset-0 ring-1 ring-inset ${
                            itemTheme.isLight ? 'ring-black/5' : 'ring-white/10'
                          }`}
                        />
                      </div>
                    ) : (
                      <div
                        className="flex h-full w-full items-center justify-center rounded-2xl"
                        style={{
                          backgroundImage: itemTheme.background,
                          boxShadow: itemTheme.isLight
                            ? 'inset 0 0 0 1px rgba(0, 0, 0, 0.08)'
                            : 'inset 0 0 0 1px rgba(255, 255, 255, 0.12)',
                        }}
                      >
                        <span
                          className="font-black text-[7rem] leading-none tracking-tighter"
                          style={{ color: itemTheme.numeral }}
                        >
                          {String(index + 1).padStart(2, '0')}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

        {slideCount > 1 ? (
          <div
            className="relative z-20 flex items-center gap-4 border-t px-5 py-3 sm:px-8"
            style={{
              borderColor: activeTheme.isLight
                ? 'rgba(0, 0, 0, 0.08)'
                : 'rgba(255, 255, 255, 0.12)',
            }}
          >
            <div
              className="flex flex-1 items-center gap-1.5"
              role="group"
              aria-label={t('homeChooseSlide')}
            >
              {slides.map((item, index) => {
                const isActive = index === activeIndex;

                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => goToSlide(index)}
                    aria-label={t('homeShowSlide', { number: index + 1 })}
                    aria-current={isActive ? 'true' : undefined}
                    className={`group flex h-6 flex-1 items-center focus:outline-none focus-visible:ring-2 ${
                      activeTheme.isLight
                        ? 'focus-visible:ring-black/40'
                        : 'focus-visible:ring-white/70'
                    }`}
                  >
                    <span
                      className={`relative block h-1 w-full overflow-hidden rounded-full transition-colors ${
                        isActive
                          ? activeTheme.isLight
                            ? 'bg-black/15'
                            : 'bg-white/25'
                          : activeTheme.isLight
                            ? 'bg-black/10 group-hover:bg-black/20'
                            : 'bg-white/20 group-hover:bg-white/35'
                      }`}
                    >
                      {isActive ? (
                        <span
                          key={progressKey}
                          aria-hidden="true"
                          className={`absolute inset-0 origin-left rounded-full motion-safe:animate-slide-progress ${
                            isPaused ? '[animation-play-state:paused]' : ''
                          }`}
                          style={{ backgroundColor: activeTheme.accent }}
                        />
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => goToSlide(activeIndex - 1)}
                aria-label={t('homePreviousSlide')}
                className="flex h-7 w-7 items-center justify-center rounded-full transition-all hover:brightness-110 active:scale-95 sm:h-8 sm:w-8"
                style={{
                  backgroundColor: activeTheme.isLight
                    ? 'rgba(0, 0, 0, 0.08)'
                    : 'rgba(255, 255, 255, 0.2)',
                  color: activeTheme.heading,
                }}
              >
                <FiChevronLeft aria-hidden="true" className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => goToSlide(activeIndex + 1)}
                aria-label={t('homeNextSlide')}
                className="flex h-7 w-7 items-center justify-center rounded-full transition-all hover:brightness-110 active:scale-95 sm:h-8 sm:w-8"
                style={{
                  backgroundColor: activeTheme.isLight
                    ? 'rgba(0, 0, 0, 0.08)'
                    : 'rgba(255, 255, 255, 0.2)',
                  color: activeTheme.heading,
                }}
              >
                <FiChevronRight aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}

        <p aria-live="polite" className="sr-only">
          {t('homeSlideStatus', {
            current: activeIndex + 1,
            total: slideCount,
            title: activeSlide.title,
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
