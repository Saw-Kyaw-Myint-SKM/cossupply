/**
 * The four contact channels as clickable cards.
 *
 * Shared by the contact page and the storefront's closing contact band so the
 * two never drift: one list of channels, one set of brand tiles, one source
 * for the hrefs in `contactDetails.ts`. The whole card is the link, which
 * keeps the hit area honest on a phone.
 */
import type { IconType } from 'react-icons';
import {
  FiArrowUpRight,
  FiMail,
  FiMessageCircle,
  FiPhone,
  FiSend,
} from 'react-icons/fi';
import { useI18n, type TranslationKey } from '../../../lib/i18n-context';
import {
  CONTACT_CHANNEL_ORDER,
  CONTACT_DETAILS,
  type ContactChannelId,
} from '../contactDetails';

interface ChannelVisual {
  Icon: IconType;
  titleKey: TranslationKey;
  bodyKey: TranslationKey;
  /** Solid brand tile — the one saturated surface on each card. */
  tileClass: string;
}

const CHANNEL_VISUALS: Record<ContactChannelId, ChannelVisual> = {
  viber: {
    Icon: FiMessageCircle,
    titleKey: 'contactViberTitle',
    bodyKey: 'contactViberBody',
    tileClass: 'bg-[#7360f2] shadow-[0_12px_24px_-14px_rgba(115,96,242,0.9)]',
  },
  telegram: {
    Icon: FiSend,
    titleKey: 'contactTelegramTitle',
    bodyKey: 'contactTelegramBody',
    tileClass: 'bg-[#229ed9] shadow-[0_12px_24px_-14px_rgba(34,158,217,0.9)]',
  },
  email: {
    Icon: FiMail,
    titleKey: 'contactEmailTitle',
    bodyKey: 'contactEmailBody',
    tileClass: 'bg-emerald-500 shadow-[0_12px_24px_-14px_rgba(16,185,129,0.9)]',
  },
  phone: {
    Icon: FiPhone,
    titleKey: 'contactPhoneTitle',
    bodyKey: 'contactPhoneBody',
    tileClass: 'bg-primary shadow-[0_12px_24px_-14px_rgba(0,142,204,0.9)]',
  },
};

export function ContactChannelGrid({ className = '' }: { className?: string }) {
  const { t } = useI18n();

  return (
    <ul className={`grid grid-cols-2 gap-3 lg:grid-cols-4 ${className}`}>
      {CONTACT_CHANNEL_ORDER.map((id) => {
        const detail = CONTACT_DETAILS[id];
        const { Icon, titleKey, bodyKey, tileClass } = CHANNEL_VISUALS[id];
        const external = /^https?:/.test(detail.href);

        return (
          <li key={id} className="flex">
            <a
              href={detail.href}
              {...(external
                ? { target: '_blank', rel: 'noreferrer noopener' }
                : {})}
              className="group flex w-full flex-col rounded-2xl border border-white/80 bg-white/85 p-2.5 shadow-glass backdrop-blur-md transition-[transform,box-shadow,border-color] duration-200 ease-[var(--ease-settle)] hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-glass-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-reduce:hover:translate-y-0 sm:p-3.5"
            >
              <span className="flex items-center gap-2 sm:gap-3">
                <span
                  aria-hidden="true"
                  className={`flex h-8 w-8 flex-none items-center justify-center rounded-xl text-white sm:h-10 sm:w-10 ${tileClass}`}
                >
                  <Icon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold leading-snug text-ink">
                    {t(titleKey)}
                  </span>
                  <span className="mt-0.5 block break-words text-[11px] font-medium leading-snug text-primary group-hover:text-primary-hover sm:text-xs">
                    {detail.handle}
                  </span>
                </span>
                <FiArrowUpRight
                  aria-hidden="true"
                  className="hidden h-4 w-4 flex-none text-subtle transition-colors group-hover:text-primary sm:block"
                />
              </span>

              <span className="mt-2.5 line-clamp-2 text-xs leading-relaxed text-muted">
                {t(bodyKey)}
              </span>
              {external ? (
                <span className="sr-only">{t('contactExternalHint')}</span>
              ) : null}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
