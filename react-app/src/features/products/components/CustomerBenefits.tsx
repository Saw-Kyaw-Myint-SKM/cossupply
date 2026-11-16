/**
 * "CoSupply သုံးရင် ဘာကောင်းလဲ" — what the buyer gains.
 *
 * The service-flow band below explains how an order travels; this band answers
 * the earlier question: why use CoSupply at all. It leads with the local
 * buyer's everyday problem — ringing several shops for one order list — and
 * answers it with four plain benefits. The warm split panel keeps it visually
 * separate from the cyan process track so the two sections never read as a
 * repeated card grid.
 */
import { FiClock, FiFileText, FiFolder, FiShield } from 'react-icons/fi';
import { useI18n, type TranslationKey } from '../../../lib/i18n-context';

const BENEFITS: readonly { icon: typeof FiClock; titleKey: TranslationKey; bodyKey: TranslationKey }[] = [
  {
    icon: FiClock,
    titleKey: 'homeBenefitsTimeTitle',
    bodyKey: 'homeBenefitsTimeBody',
  },
  {
    icon: FiFileText,
    titleKey: 'homeBenefitsPriceTitle',
    bodyKey: 'homeBenefitsPriceBody',
  },
  {
    icon: FiShield,
    titleKey: 'homeBenefitsVerifiedTitle',
    bodyKey: 'homeBenefitsVerifiedBody',
  },
  {
    icon: FiFolder,
    titleKey: 'homeBenefitsRecordsTitle',
    bodyKey: 'homeBenefitsRecordsBody',
  },
];

export function CustomerBenefits() {
  const { t } = useI18n();

  return (
    <section aria-labelledby="home-benefits-heading" className="glass-panel overflow-hidden">
      <div className="grid lg:grid-cols-[0.85fr_1.15fr]">
        <div className="relative overflow-hidden bg-warm-soft px-6 py-7 sm:px-8 sm:py-9">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_100%_at_0%_0%,rgba(229,160,0,0.16),transparent_65%)]"
          />
          <div className="relative">
            <h2
              id="home-benefits-heading"
              className="max-w-[20ch] text-[22px] font-semibold leading-snug text-ink sm:text-[26px]"
            >
              {t('homeBenefitsTitleLead')}{' '}
              <span className="rounded-[3px] bg-warm/25 px-1 box-decoration-clone">
                {t('homeBenefitsTitleEmphasis')}
              </span>
            </h2>
            <p className="mt-3 max-w-[46ch] text-sm leading-relaxed text-muted">
              {t('homeBenefitsIntro')}
            </p>
            <p className="mt-5 border-t border-warm/25 pt-4 text-[13px] font-medium leading-relaxed text-ink/80">
              {t('homeBenefitsFooter')}
            </p>
          </div>
        </div>

        <ul className="grid gap-x-8 gap-y-7 px-6 py-7 sm:grid-cols-2 sm:px-8 sm:py-9">
          {BENEFITS.map((benefit) => {
            const Icon = benefit.icon;

            return (
              <li key={benefit.titleKey} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-white text-warm ring-1 ring-warm/25"
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-[14.5px] font-bold leading-snug text-ink">
                    {t(benefit.titleKey)}
                  </h3>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-muted">
                    {t(benefit.bodyKey)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
