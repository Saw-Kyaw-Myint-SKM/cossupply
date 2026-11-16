import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import {
  DEFAULT_LOCALE,
  I18nProvider,
  translate,
} from '../../../../lib/i18n-context';
import { CONTACT_DETAILS } from '../../../content/contactDetails';
import HomePage from '../HomePage';

function render(): string {
  return renderToString(
    <I18nProvider>
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    </I18nProvider>,
  );
}

const t = (key: Parameters<typeof translate>[1]) => translate(DEFAULT_LOCALE, key);

describe('HomePage contact section', () => {
  it('closes the page with the whole contact page in place', () => {
    const html = render();

    expect(html).toContain('id="contact"');
    expect(html).toContain('id="home-contact-heading"');
    expect(html).toContain(t('contactTitle'));
    expect(html).toContain(t('contactIntro'));
    expect(html).toContain(t('contactHelpTitle'));
    expect(html).toContain(t('contactHelpQuotation'));

    for (const detail of Object.values(CONTACT_DETAILS)) {
      expect(html).toContain(`href="${detail.href}"`);
      expect(html).toContain(detail.handle);
    }
  });

  it('has no separate contact route to link to', () => {
    const html = render();

    expect(html).not.toContain('href="/contact"');
  });
});
