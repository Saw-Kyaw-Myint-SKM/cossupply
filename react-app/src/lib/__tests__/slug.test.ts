import { describe, expect, it } from 'vitest';
import { slugify } from '../slug';

describe('slugify', () => {
  it('lowercases and joins words with single dashes', () => {
    expect(slugify('Bluetooth Earbuds Pro')).toBe('bluetooth-earbuds-pro');
  });

  it('folds accents to plain latin letters', () => {
    expect(slugify('Café Crème')).toBe('cafe-creme');
  });

  it('drops punctuation and collapses separators', () => {
    expect(slugify('  A4 -- Spiral   Notebook (2026) ')).toBe('a4-spiral-notebook-2026');
  });

  it('keeps existing dashes intact', () => {
    expect(slugify('USB-C Fast Charger 30W')).toBe('usb-c-fast-charger-30w');
  });

  it('returns an empty string when nothing slug-worthy remains', () => {
    expect(slugify('')).toBe('');
    expect(slugify('ပလတ်စတစ်ကုတ်အင်္ကျီ')).toBe('');
  });

  it('caps the slug at the column limit without a trailing dash', () => {
    expect(slugify('a'.repeat(300))).toHaveLength(255);

    const capped = slugify(`${'a'.repeat(254)} b`);

    expect(capped).toHaveLength(254);
    expect(capped.endsWith('-')).toBe(false);
  });
});
