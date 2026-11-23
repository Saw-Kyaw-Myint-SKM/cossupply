/**
 * Background palettes for the text-only home-page hero.
 *
 * Shared by the storefront hero (which renders the gradient and picks text
 * colours) and the admin form (which shows the swatch picker), so a theme
 * always looks the same in both places.
 */
export type BannerTheme = 'ink' | 'ocean' | 'violet' | 'ember' | 'paper';

export interface BannerThemeDefinition {
  value: BannerTheme;
  label: string;
  description: string;
  /** CSS gradient used by the hero canvas and the admin swatch. */
  background: string;
  /** Accent for the overline, rule and call-to-action button. */
  accent: string;
  /** Headline colour. */
  heading: string;
  /** Supporting copy colour. */
  body: string;
  /** Large decorative numeral colour. */
  numeral: string;
  /** Faint ruled-grid colour drawn over the gradient. */
  grid: string;
  /** Gradient scrim placed over the banner image on mobile. */
  imageScrim: string;
  /** Label colour placed on the accent button. */
  ctaText: string;
  /** True when the canvas is light and needs dark text. */
  isLight: boolean;
}

export const DEFAULT_BANNER_THEME: BannerTheme = 'ink';

export const BANNER_THEMES: readonly BannerThemeDefinition[] = [
  {
    value: 'ink',
    label: 'Ink',
    description: 'Deep navy with a cyan accent.',
    background: 'linear-gradient(135deg, #0F172A 0%, #1E2740 55%, #0B2A3A 100%)',
    accent: '#22D3EE',
    heading: '#FFFFFF',
    body: 'rgba(255, 255, 255, 0.74)',
    numeral: 'rgba(255, 255, 255, 0.08)',
    grid: 'rgba(255, 255, 255, 0.05)',
    imageScrim:
      'linear-gradient(to top, rgba(5, 15, 26, 0.96) 0%, rgba(5, 15, 26, 0.78) 55%, rgba(5, 15, 26, 0.58) 100%)',
    ctaText: '#042027',
    isLight: false,
  },
  {
    value: 'ocean',
    label: 'Ocean',
    description: 'Cool teal with an aqua accent.',
    background: 'linear-gradient(135deg, #06283D 0%, #0B4F6C 55%, #0E7490 100%)',
    accent: '#2DD4BF',
    heading: '#FFFFFF',
    body: 'rgba(255, 255, 255, 0.76)',
    numeral: 'rgba(255, 255, 255, 0.09)',
    grid: 'rgba(255, 255, 255, 0.055)',
    imageScrim:
      'linear-gradient(to top, rgba(3, 22, 33, 0.96) 0%, rgba(3, 22, 33, 0.78) 55%, rgba(3, 22, 33, 0.58) 100%)',
    ctaText: '#042F2E',
    isLight: false,
  },
  {
    value: 'violet',
    label: 'Violet',
    description: 'Indigo with a fuchsia accent.',
    background: 'linear-gradient(135deg, #1E1B4B 0%, #3B1D74 55%, #4C1D95 100%)',
    accent: '#E879F9',
    heading: '#FFFFFF',
    body: 'rgba(255, 255, 255, 0.76)',
    numeral: 'rgba(255, 255, 255, 0.09)',
    grid: 'rgba(255, 255, 255, 0.055)',
    imageScrim:
      'linear-gradient(to top, rgba(18, 14, 48, 0.96) 0%, rgba(18, 14, 48, 0.78) 55%, rgba(18, 14, 48, 0.58) 100%)',
    ctaText: '#3B0764',
    isLight: false,
  },
  {
    value: 'ember',
    label: 'Ember',
    description: 'Warm brown with an amber accent.',
    background: 'linear-gradient(135deg, #2A1608 0%, #5C2410 55%, #7C2D12 100%)',
    accent: '#FBBF24',
    heading: '#FFFFFF',
    body: 'rgba(255, 255, 255, 0.76)',
    numeral: 'rgba(255, 255, 255, 0.09)',
    grid: 'rgba(255, 255, 255, 0.055)',
    imageScrim:
      'linear-gradient(to top, rgba(30, 14, 5, 0.96) 0%, rgba(30, 14, 5, 0.78) 55%, rgba(30, 14, 5, 0.58) 100%)',
    ctaText: '#451A03',
    isLight: false,
  },
  {
    value: 'paper',
    label: 'Paper',
    description: 'Warm off-white with ink text.',
    background: 'linear-gradient(135deg, #F7F4EE 0%, #EFE9DD 55%, #E4DACB 100%)',
    accent: '#0E7490',
    heading: '#161616',
    body: 'rgba(22, 22, 22, 0.68)',
    numeral: 'rgba(22, 22, 22, 0.07)',
    grid: 'rgba(22, 22, 22, 0.05)',
    imageScrim:
      'linear-gradient(to top, rgba(247, 244, 238, 0.97) 0%, rgba(247, 244, 238, 0.84) 55%, rgba(247, 244, 238, 0.66) 100%)',
    ctaText: '#FFFFFF',
    isLight: true,
  },
];

const THEME_BY_VALUE = new Map<BannerTheme, BannerThemeDefinition>(
  BANNER_THEMES.map((theme) => [theme.value, theme]),
);

/** Resolve a stored value, falling back to the default palette. */
export function getBannerTheme(value?: string | null): BannerThemeDefinition {
  return (
    THEME_BY_VALUE.get(value as BannerTheme) ??
    THEME_BY_VALUE.get(DEFAULT_BANNER_THEME)!
  );
}

/** Faint ruled-paper grid drawn over the canvas. */
export function bannerGrid(theme: BannerThemeDefinition): string {
  return `repeating-linear-gradient(to bottom, ${theme.grid} 0px, ${theme.grid} 1px, transparent 1px, transparent 32px)`;
}

/** Soft accent glow pooled in the lower-left corner. */
export function bannerGlow(theme: BannerThemeDefinition): string {
  return `radial-gradient(60% 75% at 0% 100%, ${theme.accent}38, transparent 65%)`;
}
