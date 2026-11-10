import { FALLBACK_THUMB } from '../../../components/catalog-ui/CatalogUi';
import { useI18n } from '../../../lib/i18n-context';
import { formatLocalDate } from '../../../lib/localization';
import { formatMMK } from '../../../lib/money';
import type { QuotationVersion } from '../api/quotationAdminApi';

interface QuotationVersionDetailProps {
  version: QuotationVersion;
}

/**
 * Read-only body of a quotation version: the priced items table plus the
 * Terms / PDF & email / Summary footer band.
 */
export default function QuotationVersionDetail({ version }: QuotationVersionDetailProps) {
  const { locale, t } = useI18n();
  const date = (value: string | null) => formatLocalDate(value, locale) ?? t('noData');
  const dateTime = (value: string | null) =>
    formatLocalDate(value, locale, { dateStyle: 'medium', timeStyle: 'short' }) ?? t('noData');
  const latestPdf = version.pdfs[0] ?? null;
  const totals: Array<[string, number]> = [
    [t('subtotal'), version.subtotal],
    [t('discount'), version.discount],
    [t('deliveryFee'), version.delivery_fee],
    [t('serviceFee', { percent: version.service_fee_percentage }), version.service_fee],
  ];

  return (
    <article className="overflow-hidden rounded-xl border border-rule bg-plate shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_28px_-16px_rgba(15,23,42,0.16)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-180 text-sm">
          <caption className="sr-only">
            {t('quotationVersionItems', { version: version.version })}
          </caption>
          <thead className="border-b border-line bg-paper text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">
            <tr>
              <th scope="col" className="w-10 px-4 py-2.5 text-left">#</th>
              <th scope="col" className="px-4 py-2.5 text-left">{t('itemLabel')}</th>
              <th scope="col" className="whitespace-nowrap px-4 py-2.5 text-right">{t('qty')}</th>
              <th scope="col" className="whitespace-nowrap px-4 py-2.5 text-right">{t('unitPrice')}</th>
              <th scope="col" className="whitespace-nowrap px-4 py-2.5 text-right">{t('discount')}</th>
              <th scope="col" className="whitespace-nowrap px-4 py-2.5 text-right">{t('lineTotal')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {version.items.map((item, index) => (
              <tr key={item.id} className="align-top">
                <td className="px-4 py-3 tabular-nums text-gray-400">{index + 1}</td>
                <td className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <img
                      src={item.photo_url ?? FALLBACK_THUMB}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-12 w-12 flex-none rounded-md border border-rule bg-gray-50 object-cover"
                    />
                    <div className="min-w-0">
                      <p className="font-medium text-ink">{item.product_name_snapshot}</p>
                      <p className="text-xs text-gray-500">
                        {[item.sku_snapshot, item.supplier?.shop_name].filter(Boolean).join(' · ') || t('noData')}
                      </p>
                      {item.supplier_note || item.warranty_note ? (
                        <p className="mt-1 text-xs text-gray-600">
                          {[item.supplier_note, item.warranty_note].filter(Boolean).join(' · ')}
                        </p>
                      ) : null}
                      {item.delivery_date ? (
                        <p className="mt-1 text-xs text-gray-500">
                          {t('deliveryOn', { date: date(item.delivery_date) })}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-gray-700">
                  {item.quantity}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-gray-700">
                  {formatMMK(item.unit_price)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-gray-700">
                  {formatMMK(item.discount)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums text-ink">
                  {formatMMK(item.line_total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t border-rule bg-rule">
        <div className="grid gap-px text-sm sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_21rem]">
          <section className="bg-plate px-4 py-4 sm:col-span-2 lg:col-span-1 lg:col-start-3 lg:row-start-1">
            <div className="flex items-baseline justify-between gap-3">
              <h4 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">{t('summary')}</h4>
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">{t('allAmountsInMmk')}</span>
            </div>
            <dl className="mt-2.5 space-y-1.5">
              {totals.map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between gap-4">
                  <dt className="text-gray-500">{label}</dt>
                  <dd className="tabular-nums text-gray-700">{formatMMK(value)}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-3 flex items-baseline justify-between gap-4 border-t border-primary/25 pt-2.5">
              <dt className="text-sm font-bold uppercase tracking-wide text-primary">{t('totalCod')}</dt>
              <dd className="text-lg font-bold tabular-nums text-primary">
                {formatMMK(version.total_amount)}
                <span className="ml-1 text-xs font-semibold text-primary/70">{t('mmk')}</span>
              </dd>
            </div>
          </section>

          <section className="bg-plate px-4 py-4 lg:col-start-1 lg:row-start-1">
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">{t('terms')}</h4>
            <p className="mt-2 whitespace-pre-line text-gray-700">{version.payment_terms}</p>
            <p className="mt-1.5 text-xs text-gray-500">{version.payment_method}</p>
            {version.admin_note ? (
              <p className="mt-2 whitespace-pre-line rounded-md bg-gray-50 px-3 py-2 text-gray-700">{version.admin_note}</p>
            ) : null}
          </section>

          <section className="bg-plate px-4 py-4 lg:col-start-2 lg:row-start-1">
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">{t('pdfAndEmail')}</h4>
            <p className="mt-2 text-xs text-gray-600">
              {version.pdfs.length === 0
                ? t('noPdfGenerated')
                : t('pdfGenerated', {
                    count: version.pdfs.length,
                    suffix: version.pdfs.length === 1 ? '' : 's',
                    file: latestPdf?.file_name ?? t('noData'),
                  })}
            </p>
            {version.email_logs.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {version.email_logs.map((email) => (
                  <li key={email.id} className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                    <span className={`font-semibold ${email.status === 'SENT' ? 'text-green-700' : 'text-red-700'}`}>
                      {email.status}
                    </span>
                    <span>{email.recipient_email}</span>
                    <span>{dateTime(email.sent_at ?? email.created_at)}</span>
                    {email.error_message ? <span className="w-full text-red-700">{email.error_message}</span> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-xs text-gray-500">{t('noEmailAttempt')}</p>
            )}
          </section>
        </div>
      </div>
    </article>
  );
}
