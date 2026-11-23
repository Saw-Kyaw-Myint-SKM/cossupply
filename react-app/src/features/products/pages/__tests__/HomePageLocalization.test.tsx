import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider, translate, type Locale } from '../../../../lib/i18n-context';
import HomePage from '../HomePage';

function renderLocale(locale: Locale): string {
  // I18nProvider reads the stored locale from localStorage. Stubbing the
  // storage here lets the server render exercise both catalogs.
  vi.stubGlobal('window', {
    localStorage: {
      getItem: () => locale,
      setItem: () => undefined,
    },
  });

  return renderToString(
    <I18nProvider>
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    </I18nProvider>,
  );
}

describe('HomePage localization', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the benefits and service bands in Burmese', () => {
    const html = renderLocale('my');

    expect(html).toContain(translate('my', 'homeBenefitsTitleLead'));
    expect(html).toContain(translate('my', 'homeBenefitsTitleEmphasis'));
    expect(html).toContain(translate('my', 'homeBenefitsTimeTitle'));
    expect(html).toContain(translate('my', 'homeServiceTitleLead'));
    expect(html).toContain(translate('my', 'homeServiceTitleEmphasis'));
    expect(html).toContain(translate('my', 'homeServiceStep1Title'));
    expect(html).toContain(translate('my', 'homeServiceNote1Title'));
  });

  it('renders the same bands in English when English is selected', () => {
    const html = renderLocale('en');

    expect(html).toContain(translate('en', 'homeBenefitsTitleLead'));
    expect(html).toContain(translate('en', 'homeBenefitsTimeTitle'));
    expect(html).toContain(translate('en', 'homeServiceTitleLead'));
    expect(html).toContain(translate('en', 'homeServiceStep1Title'));
    expect(html).not.toContain(translate('my', 'homeBenefitsTitleLead'));
    expect(html).not.toContain(translate('my', 'homeServiceTitleLead'));
  });

  it('keeps every home key translated in both catalogs', () => {
    const homeKeys = [
      'homeCarouselLabel',
      'homeHeroOverline',
      'homeChooseSlide',
      'homeShowSlide',
      'homePreviousSlide',
      'homeNextSlide',
      'homeSlideStatus',
      'homeSlide1Eyebrow',
      'homeSlide1Headline',
      'homeSlide1Offer',
      'homeSlide1Cta',
      'homeSlide2Eyebrow',
      'homeSlide2Headline',
      'homeSlide2Offer',
      'homeSlide2Cta',
      'homeSlide3Eyebrow',
      'homeSlide3Headline',
      'homeSlide3Offer',
      'homeSlide3Cta',
      'homeBannerCtaFallback',
      'homeDealsLead',
      'homeDealsEmphasis',
      'homeFreshLead',
      'homeFreshEmphasis',
      'homeShopByLead',
      'homeShopByEmphasis',
      'homeProductsUnavailable',
      'homeTryFullCatalog',
      'homeNoProductsTitle',
      'homeNoProductsHint',
      'homeBenefitsTitleLead',
      'homeBenefitsTitleEmphasis',
      'homeBenefitsIntro',
      'homeBenefitsFooter',
      'homeBenefitsTimeTitle',
      'homeBenefitsTimeBody',
      'homeBenefitsPriceTitle',
      'homeBenefitsPriceBody',
      'homeBenefitsVerifiedTitle',
      'homeBenefitsVerifiedBody',
      'homeBenefitsRecordsTitle',
      'homeBenefitsRecordsBody',
      'homeServiceTitleLead',
      'homeServiceTitleEmphasis',
      'homeServiceIntro',
      'homeServiceStep1Title',
      'homeServiceStep1Body',
      'homeServiceStep2Title',
      'homeServiceStep2Body',
      'homeServiceStep3Title',
      'homeServiceStep3Body',
      'homeServiceStep4Title',
      'homeServiceStep4Body',
      'homeServiceNote1Title',
      'homeServiceNote1Body',
      'homeServiceNote2Title',
      'homeServiceNote2Body',
      'homeServiceNote3Title',
      'homeServiceNote3Body',
    ] as const;

    for (const key of homeKeys) {
      // The template placeholders are part of the contract, so compare the
      // bare templates rather than running interpolation.
      expect(translate('en', key)).not.toBe('');
      expect(translate('my', key)).not.toBe('');
      expect(translate('en', key)).not.toBe(translate('my', key));
    }
  });
});
