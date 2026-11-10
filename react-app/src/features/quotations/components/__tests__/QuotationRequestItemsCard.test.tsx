import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import {
  DEFAULT_LOCALE,
  I18nProvider,
  translate,
} from '../../../../lib/i18n-context';
import type { QuotationRequestItem } from '../../api/quotationsApi';
import QuotationRequestItemsCard from '../QuotationRequestItemsCard';

function render(items: QuotationRequestItem[]): string {
  return renderToString(
    <I18nProvider>
      <QuotationRequestItemsCard items={items} />
    </I18nProvider>,
  );
}

const t = (key: Parameters<typeof translate>[1]) => translate(DEFAULT_LOCALE, key);

const item: QuotationRequestItem = {
  product_id: 40,
  supplier_id: 3,
  product_name_snapshot: 'Bluetooth Earbuds Pro MDL-0040',
  specification_snapshot: 'Bluetooth 5.3, 30h battery',
  quantity: 3,
  display_price: 12345,
  stock_status: 'IN_STOCK',
  sku: 'SKU-0040-AB',
  photo_url: null,
  supplier: { id: 3, shop_name: 'Acme Supply' },
};

describe('QuotationRequestItemsCard', () => {
  it('renders the original requested items with quantity, display price and stock', () => {
    const html = render([item]);

    expect(html).toContain(t('requestedItems'));
    expect(html).toContain('Bluetooth Earbuds Pro MDL-0040');
    expect(html).toContain('Bluetooth 5.3, 30h battery');
    expect(html).toContain('Acme Supply');
    expect(html).toContain('SKU-0040-AB');
    expect(html).toContain('12,345');
    expect(html).toContain(t('inStock'));
    expect(html).toContain(t('displayPriceOnly'));
  });

  it('shows the item count and the empty state when no items exist', () => {
    const html = render([]);

    expect(html).toContain(t('requestedItems'));
    expect(html).toContain(t('noRequestedItems'));
    expect(html).not.toContain('Bluetooth Earbuds Pro MDL-0040');
  });
});
