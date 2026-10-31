export const LOCALES = ['en', 'my'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'my';
export const LOCALE_STORAGE_KEY = 'cos_locale_v1';

type BilingualName = {
  name_en?: string | null;
  name_mm?: string | null;
};

export function normalizeLocale(value: unknown): Locale {
  return value === 'en' || value === 'my' ? value : DEFAULT_LOCALE;
}

export function readStoredLocale(storage: Storage | null | undefined): Locale {
  try {
    return normalizeLocale(storage?.getItem(LOCALE_STORAGE_KEY));
  } catch {
    return DEFAULT_LOCALE;
  }
}

export function persistLocale(locale: Locale, storage: Storage | null | undefined): void {
  try {
    storage?.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Private browsing and storage policies must not prevent language changes.
  }
}

/** Select the catalog name most useful for the currently selected locale. */
export function displayCatalogName(item: BilingualName, locale: Locale): string {
  const preferred = locale === 'en' ? item.name_en : item.name_mm;
  const fallback = locale === 'en' ? item.name_mm : item.name_en;
  return preferred?.trim() || fallback?.trim() || '';
}

/** The alternate catalog name, useful as an explicitly labelled secondary line. */
export function alternateCatalogName(item: BilingualName, locale: Locale): string {
  const alternate = locale === 'en' ? item.name_mm : item.name_en;
  return alternate?.trim() || '';
}

/** Locale used consistently for all user-facing dates and numbers. */
export function intlLocale(locale: Locale): string {
  return locale === 'my' ? 'my-MM' : 'en-US';
}

function dateFromValue(value: string | Date): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatLocalDate(
  value: string | Date | null | undefined,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
): string | null {
  if (!value) return null;
  const date = dateFromValue(value);
  return date ? new Intl.DateTimeFormat(intlLocale(locale), options).format(date) : null;
}

export function formatLocalNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale(locale)).format(value);
}
