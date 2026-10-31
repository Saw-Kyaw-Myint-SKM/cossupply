import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  displayCatalogName,
  normalizeLocale,
  persistLocale,
  readStoredLocale,
} from '../localization';

describe('locale storage', () => {
  it('defaults missing and invalid values to Myanmar', () => {
    expect(normalizeLocale(null)).toBe(DEFAULT_LOCALE);
    expect(normalizeLocale('fr')).toBe(DEFAULT_LOCALE);
    expect(readStoredLocale({ getItem: () => 'invalid' } as unknown as Storage)).toBe('my');
  });

  it('reads and persists only a valid locale under the versioned key', () => {
    const setItem = vi.fn();
    const storage = { getItem: () => 'en', setItem } as unknown as Storage;
    expect(readStoredLocale(storage)).toBe('en');
    persistLocale('my', storage);
    expect(setItem).toHaveBeenCalledWith(LOCALE_STORAGE_KEY, 'my');
  });

  it('handles unavailable storage without breaking locale selection', () => {
    const storage = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } } as unknown as Storage;
    expect(readStoredLocale(storage)).toBe(DEFAULT_LOCALE);
    expect(() => persistLocale('en', storage)).not.toThrow();
  });
});

describe('displayCatalogName', () => {
  it('uses the requested name before the other-language fallback', () => {
    expect(displayCatalogName({ name_en: 'Paper', name_mm: 'စာရွက်' }, 'en')).toBe('Paper');
    expect(displayCatalogName({ name_en: 'Paper', name_mm: 'စာရွက်' }, 'my')).toBe('စာရွက်');
  });

  it('falls back across languages for partial public records', () => {
    expect(displayCatalogName({ name_en: 'Paper', name_mm: null }, 'my')).toBe('Paper');
    expect(displayCatalogName({ name_en: null, name_mm: 'စာရွက်' }, 'en')).toBe('စာရွက်');
  });
});
