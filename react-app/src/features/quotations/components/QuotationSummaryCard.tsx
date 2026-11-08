/**
 * Dashboard card for one customer quotation request (Task 08 list markers).
 *
 * Shows the lifecycle status, the current version's total, its validity and
 * the request age in a single tappable card. Amounts come from the additive
 * `current_quotation` list field, so the card needs no extra request.
 */
import { Link } from 'react-router-dom';
import { FiAlertCircle, FiArrowRight } from 'react-icons/fi';
import { useI18n } from '../../../lib/i18n-context';
import type { QuotationRequestSummary } from '../api/quotationsApi';
import QuotationStatusBadge from './QuotationStatusBadge';
import {
  buildQuotationListMarkers,
  formatQuotationAmount,
  formatQuotationDate,
  quotationStatusTone,
  type QuotationStatusTone,
} from '../lib/quotationView';

/**
 * Top accent per semantic tone. Mirrors QUOTATION_STATUS_TONE_CLASSES so the
 * card edge, badge and "action needed" ring all agree.
 */
const STATUS_ACCENT_CLASSES: Record<QuotationStatusTone, string> = {
  neutral: 'bg-slate-400',
  info: 'bg-blue-500',
  progress: 'bg-sky-500',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
};

export default function QuotationSummaryCard({
  row,
  className = '',
}: {
  row: QuotationRequestSummary;
  className?: string;
}) {
  const { t, locale } = useI18n();
  const markers = buildQuotationListMarkers(row, locale, t);
  const amount = row.current_quotation?.total_amount;
  const tone = quotationStatusTone(row.current_status ?? row.status);
  const secondaryStatus =
    row.current_status && row.current_status !== row.status ? row.current_status : null;

  return (
    <Link
      to={`/quotations/${row.id}`}
      className={`group relative flex h-full flex-col overflow-hidden rounded-xl border bg-white/85 shadow-sm hover:border-primary/40 hover:bg-white hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-safe:transition-all ${
        markers.actionNeeded
          ? 'border-amber-300/80 ring-1 ring-amber-200/60'
          : 'border-slate-200/70'
      } ${className}`}
    >
      <span
        aria-hidden="true"
        className={`h-1 w-full flex-none ${STATUS_ACCENT_CLASSES[tone]}`}
      />

      <div className="flex flex-1 flex-col p-3.5">
        <div className="flex items-start justify-between gap-2">
          <span
            className="min-w-0 flex-1 truncate font-mono text-xs font-semibold text-ink"
            title={row.quotation_number}
          >
            {row.quotation_number}
          </span>
          <QuotationStatusBadge status={row.status} className="flex-none" />
        </div>

        {markers.actionNeeded ? (
          <span className="mt-2 inline-flex w-fit items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-600/20">
            <FiAlertCircle aria-hidden="true" className="h-3 w-3" />
            {t('actionNeeded')}
          </span>
        ) : null}

        <div className="mt-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            {t('total')}
          </p>
          {typeof amount === 'number' && Number.isFinite(amount) ? (
            <p className="mt-0.5 text-lg font-bold leading-tight tracking-tight text-ink tabular-nums">
              {formatQuotationAmount(amount, t)}{' '}
              <span className="text-xs font-semibold text-slate-500">{t('mmk')}</span>
            </p>
          ) : (
            <p className="mt-1 text-sm font-medium text-slate-400">
              {t('quotationPricePending')}
            </p>
          )}
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {markers.hasCurrentVersion && markers.currentVersionLabel ? (
            <span className="text-[11px] font-medium text-slate-600">
              {markers.currentVersionLabel}
            </span>
          ) : null}
          {secondaryStatus ? <QuotationStatusBadge status={secondaryStatus} /> : null}
        </div>

        {markers.validityLabel ? (
          <p
            className={`mt-1 text-[11px] ${
              markers.expired ? 'font-semibold text-red-600' : 'text-slate-500'
            }`}
          >
            {markers.validityLabel}
          </p>
        ) : null}

        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          <p className="min-w-0 truncate text-[11px] text-slate-500">
            {formatQuotationDate(row.created_at, locale, t)}
            <span aria-hidden="true" className="px-1 text-slate-300">
              ·
            </span>
            {row.item_count} {t(row.item_count === 1 ? 'line' : 'lines')}
          </p>
          <span className="inline-flex flex-none items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary group-hover:bg-primary group-hover:text-white motion-safe:transition-colors">
            {t('view')}
            <FiArrowRight
              aria-hidden="true"
              className="h-3 w-3 motion-safe:transition-transform group-hover:translate-x-0.5"
            />
          </span>
        </div>
      </div>
    </Link>
  );
}
