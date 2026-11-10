/**
 * Original items the customer submitted with a quotation request.
 *
 * The request snapshot is immutable, so this card always reflects what the
 * customer asked for even after a final quotation version is issued. Display
 * prices are indicative; the version card carries the confirmed prices.
 */
import { FALLBACK_THUMB } from '../../../components/catalog-ui/CatalogUi';
import { useI18n } from '../../../lib/i18n-context';
import { StockStatusBadge } from '../../products/components/ProductUi';
import type { QuotationRequestItem } from '../api/quotationsApi';
import { formatQuotationAmount } from '../lib/quotationView';

const cardClass = 'rounded-2xl border border-rule bg-plate shadow-sm';
const cardTitleClass = 'text-base font-bold text-ink';
const fieldLabelClass = 'text-xs text-gray-500';

function ItemSupplier({ item }: { item: QuotationRequestItem }) {
  const supplier = item.supplier?.shop_name ?? null;
  return supplier ? <p className="text-xs text-gray-500">{supplier}</p> : null;
}

export default function QuotationRequestItemsCard({
  items,
}: {
  items: QuotationRequestItem[];
}) {
  const { t } = useI18n();
  const count = items.length;

  return (
    <section
      className={`${cardClass} overflow-hidden`}
      aria-labelledby="requested-items-title"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-3 pt-4 sm:px-6">
        <div className="min-w-0">
          <h2 id="requested-items-title" className={cardTitleClass}>
            {t('requestedItems')}
          </h2>
          <p className="mt-1 text-xs text-gray-500">{t('requestedItemsHint')}</p>
        </div>
        <p className="text-xs text-gray-500">
          {t('itemCount', {
            count,
            noun: t(count === 1 ? 'item' : 'itemsPlural'),
          })}
        </p>
      </div>

      {count === 0 ? (
        <p className="border-t border-rule px-4 py-4 text-sm text-gray-500 sm:px-6">
          {t('noRequestedItems')}
        </p>
      ) : (
        <>
          {/* Mobile: stacked cards keep long product names readable. */}
          <ul className="divide-y divide-rule border-t border-rule sm:hidden">
            {items.map((item, index) => (
              <li
                key={`${item.product_id}-${index}`}
                className="space-y-2 px-4 py-3 text-sm"
              >
                <div className="flex items-start gap-3">
                  <img
                    src={item.photo_url ?? FALLBACK_THUMB}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="h-12 w-12 flex-none rounded-lg border border-rule bg-gray-50 object-cover"
                  />
                  <div className="min-w-0">
                    <p className="text-ink">{item.product_name_snapshot}</p>
                    <ItemSupplier item={item} />
                    {item.specification_snapshot ? (
                      <p className="text-xs text-gray-500">
                        {item.specification_snapshot}
                      </p>
                    ) : null}
                    {item.sku ? (
                      <p className="text-xs text-gray-500">{t('sku', { sku: item.sku })}</p>
                    ) : null}
                  </div>
                </div>

                <dl className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-gray-500">{t('qty')}</dt>
                    <dd className="mt-0.5 tabular-nums text-gray-700">{item.quantity}</dd>
                  </div>
                  <div className="text-right">
                    <dt className="text-gray-500">{t('displayPrice')}</dt>
                    <dd className="mt-0.5 font-semibold tabular-nums text-ink">
                      {formatQuotationAmount(item.display_price, t)} {t('mmk')}
                    </dd>
                  </div>
                </dl>

                <div className="text-right">
                  <StockStatusBadge status={item.stock_status} />
                </div>
              </li>
            ))}
          </ul>

          {/* Desktop: right-aligned numbers and a consistent MMK suffix. */}
          <div className="hidden overflow-x-auto border-t border-rule sm:block">
            <table className="min-w-full text-sm">
              <caption className="sr-only">{t('requestedItems')}</caption>
              <thead className="bg-gray-50/70 text-xs font-bold text-gray-500">
                <tr>
                  <th scope="col" className="px-5 py-2.5 text-left sm:px-6">
                    {t('itemLabel')}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-right">
                    {t('qty')}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-right">
                    {t('displayPrice')}
                  </th>
                  <th scope="col" className="px-5 py-2.5 text-right sm:px-6">
                    {t('stockStatus')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {items.map((item, index) => (
                  <tr key={`${item.product_id}-${index}`} className="align-top">
                    <th
                      scope="row"
                      className="px-5 py-3 text-left font-normal sm:px-6"
                    >
                      <div className="flex items-start gap-3">
                        <img
                          src={item.photo_url ?? FALLBACK_THUMB}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="h-12 w-12 flex-none rounded-lg border border-rule bg-gray-50 object-cover"
                        />
                        <div className="min-w-0">
                          <p className="text-ink">{item.product_name_snapshot}</p>
                          <ItemSupplier item={item} />
                          {item.specification_snapshot ? (
                            <p className="text-xs text-gray-500">
                              {item.specification_snapshot}
                            </p>
                          ) : null}
                          {item.sku ? (
                            <p className="text-xs text-gray-500">
                              {t('sku', { sku: item.sku })}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </th>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-gray-700">
                      {item.quantity}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-gray-700">
                      {formatQuotationAmount(item.display_price, t)}{' '}
                      <span className="text-xs font-normal text-gray-500">
                        {t('mmk')}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-right sm:px-6">
                      <StockStatusBadge status={item.stock_status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p className={`border-t border-rule px-4 py-3 sm:px-6 ${fieldLabelClass}`}>
        {t('displayPriceOnly')}
      </p>
    </section>
  );
}
