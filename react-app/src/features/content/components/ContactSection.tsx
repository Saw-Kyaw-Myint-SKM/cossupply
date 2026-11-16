/**
 * Contact section — the storefront's "how to reach us" block.
 *
 * It closes the home page and is the target of the header's Contact link
 * (`/#contact`), so the storefront keeps a single page rather than a separate
 * contact route. The layout follows the reference the team supplied: a quiet
 * centred hero, one card per channel, then the help strip.
 *
 * There is deliberately no message form: every card is a direct link to the
 * channel (Viber, Telegram, email, phone), so the section needs no API.
 */
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import type { IconType } from 'react-icons';
import { FiFileText, FiMail, FiShoppingBag, FiTruck } from 'react-icons/fi';
import { useI18n, type TranslationKey } from '../../../lib/i18n-context';
import { ContactChannelGrid } from './ContactChannelGrid';

interface HelpItem {
  Icon: IconType;
  titleKey: TranslationKey;
  bodyKey: TranslationKey;
}

const HELP_ITEMS: readonly HelpItem[] = [
  {
    Icon: FiFileText,
    titleKey: 'contactHelpQuotation',
    bodyKey: 'contactHelpQuotationBody',
  },
  {
    Icon: FiTruck,
    titleKey: 'contactHelpOrder',
    bodyKey: 'contactHelpOrderBody',
  },
  {
    Icon: FiShoppingBag,
    titleKey: 'contactHelpBulk',
    bodyKey: 'contactHelpBulkBody',
  },
];

export function ContactSection() {
  const { t } = useI18n();
  const { hash } = useLocation();

  // The header's Contact link navigates to `/#contact`. The home page is
  // lazy-loaded, so the element does not exist when the URL changes — this
  // effect runs after mount and does the scroll once the section is on screen.
  useEffect(() => {
    if (hash !== '#contact') return;

    const target = document.getElementById('contact');
    if (!target) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'start',
    });
  }, [hash]);

  return (
    <section id="contact" aria-labelledby="home-contact-heading" className="scroll-mt-24">
      <div className="mx-auto w-full max-w-6xl">
        {/* Hero: one pill, one promise, and plenty of air. */}
        <header className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/70 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary shadow-sm backdrop-blur-md">
            <FiMail aria-hidden="true" className="h-3.5 w-3.5" />
            {t('contactEyebrow')}
          </span>
          <h2
            id="home-contact-heading"
            className="mt-5 text-[30px] font-bold leading-[1.15] tracking-tight text-ink sm:text-[42px]"
          >
            {t('contactTitle')}
          </h2>
          <p className="mx-auto mt-4 max-w-[60ch] text-sm leading-relaxed text-muted sm:text-[15px]">
            {t('contactIntro')}
          </p>
        </header>

        {/* One card per channel. The whole card is the link, so the hit area
            matches what the buyer sees on a phone. */}
        <section aria-label={t('contactChannels')} className="mt-9 sm:mt-12">
          <ContactChannelGrid />
        </section>

        {/* What the team can actually answer, so the section carries real
            content rather than four bare links. */}
        <section className="glass-panel mt-6 p-5 sm:mt-8 sm:p-7">
          <h2 className="text-[15px] font-semibold text-ink">{t('contactHelpTitle')}</h2>
          <ul className="mt-4 grid gap-5 sm:grid-cols-3 sm:gap-6">
            {HELP_ITEMS.map(({ Icon, titleKey, bodyKey }, index) => (
              <li
                key={titleKey}
                className={`flex items-start gap-3 ${
                  index > 0 ? 'sm:border-l sm:border-line/60 sm:pl-6' : ''
                }`}
              >
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-primary-light text-primary ring-1 ring-primary/15"
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-[13.5px] font-semibold leading-snug text-ink">
                    {t(titleKey)}
                  </h3>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{t(bodyKey)}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </section>
  );
}
