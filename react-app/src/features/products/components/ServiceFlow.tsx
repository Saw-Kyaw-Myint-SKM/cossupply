/**
 * "ဝန်ဆောင်မှု လုပ်ငန်းစဉ်" — the service band on the storefront home page.
 *
 * CoSupply is quotation-first: the customer builds an order list, the team
 * confirms price and stock with each supplier, and one final quotation comes
 * back. The four steps are a real sequence, so the numerals carry meaning and
 * sit on one continuous rail instead of reading as four unrelated cards.
 *
 * The copy follows the selected locale and the step numerals use the locale's
 * digits, so Myanmar reads ၁–၄ and English reads 1–4.
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowRight, FiCheck } from 'react-icons/fi';
import { primaryButtonClass } from '../../../components/catalog-ui/CatalogUi';
import { useI18n, type TranslationKey } from '../../../lib/i18n-context';
import { formatLocalNumber } from '../../../lib/localization';

const STEPS: readonly { titleKey: TranslationKey; bodyKey: TranslationKey }[] = [
  {
    titleKey: 'homeServiceStep1Title',
    bodyKey: 'homeServiceStep1Body',
  },
  {
    titleKey: 'homeServiceStep2Title',
    bodyKey: 'homeServiceStep2Body',
  },
  {
    titleKey: 'homeServiceStep3Title',
    bodyKey: 'homeServiceStep3Body',
  },
  {
    titleKey: 'homeServiceStep4Title',
    bodyKey: 'homeServiceStep4Body',
  },
];

const NOTES: readonly { titleKey: TranslationKey; bodyKey: TranslationKey }[] = [
  { titleKey: 'homeServiceNote1Title', bodyKey: 'homeServiceNote1Body' },
  { titleKey: 'homeServiceNote2Title', bodyKey: 'homeServiceNote2Body' },
  { titleKey: 'homeServiceNote3Title', bodyKey: 'homeServiceNote3Body' },
];

export function ServiceFlow() {
  const { t, locale } = useI18n();
  const sectionRef = useRef<HTMLElement | null>(null);
  const [isActive, setIsActive] = useState(false);

  // Keep the rail moving only while the band is on screen; it rests as soon
  // as the reader scrolls past, and starts again on the way back.
  useEffect(() => {
    const node = sectionRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setIsActive(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setIsActive(entry.isIntersecting),
      { threshold: 0.15 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      aria-labelledby="home-service-heading"
      className={`service-flow glass-panel overflow-hidden ${isActive ? 'is-active' : ''}`}
    >
      <div
        aria-hidden="true"
        className="h-0.5 w-full bg-gradient-to-r from-primary via-sky-400 to-warm/70"
      />

      <div className="px-5 py-6 sm:px-8 sm:py-8">
        {/* Header — title and promise on the left, the catalog action on the
            right so the band opens with one clear next move. */}
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
          <div className="min-w-0">
            <h2
              id="home-service-heading"
              className="text-[23px] font-semibold leading-tight text-ink sm:text-[26px]"
            >
              {t('homeServiceTitleLead')}{' '}
              <span className="text-primary">{t('homeServiceTitleEmphasis')}</span>
            </h2>
            <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-muted">
              {t('homeServiceIntro')}
            </p>
          </div>

          <Link
            to="/products"
            className={`${primaryButtonClass} inline-flex w-fit flex-none items-center gap-2`}
          >
            {t('browseProducts')}
            <FiArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        </div>

        {/* Four steps on one rail. The rail runs through the centre of every
            numeral (20px from each column edge), so the order reads as a
            single journey rather than four separate tiles. */}
        <ol className="relative mt-8 grid gap-y-6 sm:grid-cols-2 sm:gap-x-8 sm:gap-y-8 lg:grid-cols-4 lg:gap-x-0">
          <span
            aria-hidden="true"
            className="absolute left-5 right-5 top-5 hidden h-px rounded-full bg-gradient-to-r from-primary/20 via-primary/20 to-warm/35 lg:block"
          >
            <span className="rail-flow-x absolute inset-0" />
            <span className="rail-travel absolute top-1/2 h-[3px] w-16 -translate-y-1/2 rounded-full bg-gradient-to-r from-transparent via-primary to-transparent" />
          </span>

          {STEPS.map((step, index) => {
            const isLast = index === STEPS.length - 1;

            return (
              <li key={step.titleKey} className="relative flex gap-4 sm:block sm:pr-6 lg:pr-8">
                {!isLast ? (
                  <span
                    aria-hidden="true"
                    className="rail-flow-y absolute -bottom-6 left-5 top-10 w-px sm:hidden"
                  />
                ) : null}

                <span
                  aria-hidden="true"
                  style={{ animationDelay: `${0.9 + index * 1.5}s` }}
                  className={`step-pulse relative z-10 flex h-10 w-10 flex-none items-center justify-center rounded-full bg-white text-[15px] font-bold shadow-sm ring-2 ${
                    isLast ? 'text-warm ring-warm/40' : 'text-primary ring-primary/25'
                  }`}
                >
                  {formatLocalNumber(index + 1, locale)}
                </span>

                <div className="min-w-0 sm:mt-4">
                  <h3 className="text-[15px] font-bold leading-snug text-ink">{t(step.titleKey)}</h3>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{t(step.bodyKey)}</p>
                </div>
              </li>
            );
          })}
        </ol>

        {/* The three promises that hold across all four steps. */}
        <ul className="mt-8 grid gap-4 border-t border-line/60 pt-5 sm:grid-cols-3 sm:gap-0">
          {NOTES.map((note, index) => (
            <li
              key={note.titleKey}
              className={`flex items-start gap-2.5 ${
                index > 0 ? 'sm:border-l sm:border-line/50 sm:pl-5' : ''
              }`}
            >
              <FiCheck aria-hidden="true" className="mt-0.5 h-4 w-4 flex-none text-primary" />
              <p className="text-xs leading-relaxed text-muted">
                <span className="block font-semibold text-ink">{t(note.titleKey)}</span>
                <span className="mt-0.5 block">{t(note.bodyKey)}</span>
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
