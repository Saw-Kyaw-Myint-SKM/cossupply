import flagEnglish from '../../assets/flag-english.png';
import flagMyanmar from '../../assets/flag-myanmar.png';
import { useI18n } from '../../lib/i18n-context';

interface LanguageSwitcherProps {
  className?: string;
}

/** Shared, keyboard-accessible locale control for storefront and role areas. */
export function LanguageSwitcher({ className = '' }: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useI18n();
  const nextLocale = locale === 'en' ? 'my' : 'en';
  const nextName = nextLocale === 'en' ? t('english') : t('myanmar');

  return (
    <button
      type="button"
      onClick={() => setLocale(nextLocale)}
      className={`relative inline-flex h-8 items-center gap-1.5 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-white px-2 shadow-sm hover:border-gray-300 hover:shadow active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-safe:transition-all ${className}`}
      aria-label={`${t('switchLanguage')}: ${nextName}`}
      title={`${t('language')}: ${nextName}`}
    >
      <img
        src={locale === 'en' ? flagEnglish : flagMyanmar}
        alt={locale === 'en' ? t('languageFlagEnglish') : t('languageFlagMyanmar')}
        className="h-5 w-6 rounded-sm object-cover"
      />
      <span className="text-xs font-semibold text-ink">{nextName}</span>
    </button>
  );
}
