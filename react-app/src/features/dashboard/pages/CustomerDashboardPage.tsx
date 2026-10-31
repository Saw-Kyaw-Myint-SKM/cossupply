import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  FiAlertCircle,
  FiArrowRight,
  FiClipboard,
  FiFileText,
  FiShoppingBag,
} from 'react-icons/fi';
import { useAuth } from '../../../lib/auth-context';
import { useCart } from '../../../lib/cart-context';
import { useI18n } from '../../../lib/i18n-context';
import {
  listQuotationRequests,
  type QuotationRequestSummary,
} from '../../quotations/api/quotationsApi';
import QuotationStatusBadge from '../../quotations/components/QuotationStatusBadge';
import {
  buildQuotationListMarkers,
  formatQuotationDate,
} from '../../quotations/lib/quotationView';

function SummaryTile({
  to,
  label,
  value,
  hint,
  icon,
  iconClass,
  className = '',
}: {
  to: string;
  label: string;
  value: ReactNode;
  hint: string;
  icon: ReactNode;
  iconClass: string;
  className?: string;
}) {
  return (
    <Link
      to={to}
      className={`group flex items-start gap-2.5 p-3 hover:bg-white/70 focus:outline-none focus-visible:bg-white/70 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary motion-safe:transition-colors ${className}`}
    >
      <span
        aria-hidden="true"
        className={`flex h-8 w-8 flex-none items-center justify-center rounded-lg ring-1 ring-inset ${iconClass}`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-medium leading-tight text-slate-500">
          {label}
        </span>
        <span className="mt-0.5 block text-xl font-bold leading-tight tracking-tight text-ink tabular-nums">
          {value}
        </span>
        <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 group-hover:text-primary motion-safe:transition-colors">
          {hint}
          <FiArrowRight
            aria-hidden="true"
            className="h-2.5 w-2.5 motion-safe:transition-transform group-hover:translate-x-0.5"
          />
        </span>
      </span>
    </Link>
  );
}

/**
 * Customer Dashboard Page
 */
export default function CustomerDashboardPage() {
  const { user } = useAuth();
  const { count: orderListCount } = useCart();
  const { t, locale } = useI18n();

  const [latestQuotations, setLatestQuotations] = useState<QuotationRequestSummary[]>([]);
  const [quotationTotal, setQuotationTotal] = useState<number | null>(null);
  const [quotationLoading, setQuotationLoading] = useState(true);
  const [quotationError, setQuotationError] = useState<string | null>(null);
  const [quotationNeedsLogin, setQuotationNeedsLogin] = useState(false);
  const [quotationReload, setQuotationReload] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setQuotationLoading(true);
      setQuotationError(null);
      setQuotationNeedsLogin(false);

      // The endpoint lists the customer's requests newest first; three is all
      // the dashboard shows, while `meta.total` still drives the counter.
      const response = await listQuotationRequests({ page: 1, per_page: 3 });
      if (cancelled) return;

      if (response.success && response.data) {
        setLatestQuotations(response.data.quotation_requests.slice(0, 3));
        setQuotationTotal(response.data.meta.total);
      } else {
        const message = typeof response.errors?.[0] === 'string'
          ? response.errors[0]
          : t('loginFailed');
        setQuotationError(message);
        setQuotationNeedsLogin(response.status === 401);
      }

      setQuotationLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [quotationReload]);

  const firstName = user?.name?.split(' ')[0] ?? t('account');

  const today = new Date().toLocaleDateString(locale === 'my' ? 'my-MM' : 'en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Compact welcome strip — the customer layout's mobile header already
          shows the page title and name, so the banner stays desktop-only. */}
      <section className="relative hidden overflow-hidden rounded-xl bg-gradient-to-br from-slate-950 via-blue-950 to-cyan-800 px-5 py-4 text-white shadow-glass ring-1 ring-white/15 sm:block">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-cyan-400/25 blur-3xl"
        />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-cyan-200">{today}</p>
            <h1 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">
              {t('welcomeCustomer', { name: firstName })}
            </h1>
            <p className="mt-1 text-xs text-sky-100/80">
              {t('dashboardWelcomeHint')}
            </p>
          </div>
          <Link
            to="/products"
            className="inline-flex flex-none items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-inset ring-white/25 backdrop-blur hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 active:scale-[0.98] motion-safe:transition-all"
          >
            {t('browseProducts')}
            <FiArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>

      {/* Summary: two compact cards per row; the order-list row runs full
          width underneath so the 2-column rhythm stays intact. */}
      <section className="glass-panel overflow-hidden" aria-label={t('account')}>
        <div
          aria-hidden="true"
          className="h-0.5 w-full bg-gradient-to-r from-sky-400 via-amber-300 to-violet-400"
        />
        <div className="grid grid-cols-2">
          <SummaryTile
            to="/quotations"
            label={t('quotations')}
            value={quotationLoading ? '—' : quotationTotal ?? '—'}
            hint={t('viewAll')}
            icon={<FiFileText className="h-4 w-4" />}
            iconClass="bg-sky-100 text-sky-700 ring-sky-200/70"
            className="border-b border-r border-slate-200/60"
          />
          <SummaryTile
            to="/orders"
            label={t('orders')}
            value={0}
            hint={t('viewAll')}
            icon={<FiShoppingBag className="h-4 w-4" />}
            iconClass="bg-amber-100 text-amber-700 ring-amber-200/70"
            className="border-b border-slate-200/60"
          />
          <SummaryTile
            to="/cart"
            label={t('orderList')}
            value={orderListCount}
            hint={t('openList')}
            icon={<FiClipboard className="h-4 w-4" />}
            iconClass="bg-violet-100 text-violet-700 ring-violet-200/70"
            className="col-span-2"
          />
        </div>
      </section>

      {/* Latest quotations: three small cards, two per row. */}
      <section className="glass-panel overflow-hidden">
        <div
          aria-hidden="true"
          className="h-0.5 w-full bg-gradient-to-r from-primary via-sky-400 to-violet-400"
        />
        <div className="flex items-center justify-between gap-2 border-b border-slate-200/60 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <span
              aria-hidden="true"
              className="flex h-6 w-6 flex-none items-center justify-center rounded-md bg-sky-100 text-sky-700 ring-1 ring-inset ring-sky-200/70"
            >
              <FiFileText className="h-3.5 w-3.5" />
            </span>
            <h2 className="truncate text-sm font-semibold text-ink">{t('latestQuotations')}</h2>
          </div>
          <Link
            to="/quotations"
            className="flex-none rounded text-[11px] font-semibold text-primary hover:text-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {t('viewAll')}
          </Link>
        </div>

        <div className="p-3">
          {quotationLoading ? (
            <div className="grid grid-cols-2 gap-2.5">
              {[0, 1].map((index) => (
                <div
                  key={index}
                  className="space-y-2 rounded-lg border border-slate-200/60 bg-white/60 p-2.5"
                >
                  <div className="h-2.5 w-3/4 animate-pulse rounded bg-slate-200/70" />
                  <div className="h-2.5 w-1/2 animate-pulse rounded bg-slate-100" />
                  <div className="h-2.5 w-2/3 animate-pulse rounded bg-slate-100" />
                </div>
              ))}
            </div>
          ) : quotationError ? (
            <div className="rounded-lg border border-red-200 bg-red-50/80 p-3">
              <p className="text-[11px] text-red-700">{quotationError}</p>
              <div className="mt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setQuotationReload((n) => n + 1)}
                  className="rounded text-[11px] font-semibold text-red-700 underline hover:text-red-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                >
                  {t('tryAgain')}
                </button>
                {quotationNeedsLogin && (
                  <Link
                    to="/login"
                    className="rounded text-[11px] font-semibold text-red-700 underline hover:text-red-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                  >
                    {t('goToLogin')}
                  </Link>
                )}
              </div>
            </div>
          ) : latestQuotations.length === 0 ? (
            <div className="flex flex-col items-center py-4 text-center">
              <span
                aria-hidden="true"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-50 text-sky-600 ring-1 ring-inset ring-sky-100"
              >
                <FiFileText className="h-4 w-4" />
              </span>
              <p className="mt-2 text-xs font-medium text-slate-700">
                {t('noQuotationWaiting')}
              </p>
              <Link
                to="/cart"
                className="mt-2 inline-flex items-center gap-1 rounded text-[11px] font-semibold text-primary hover:text-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {t('openOrderList')}
                <FiArrowRight aria-hidden="true" className="h-3 w-3" />
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              {latestQuotations.map((row) => {
                const markers = buildQuotationListMarkers(row, locale, t);

                return (
                  <Link
                    key={row.id}
                    to={`/quotations/${row.id}`}
                    className={`group flex h-full flex-col rounded-lg border bg-white/75 p-2.5 shadow-sm hover:border-primary/40 hover:bg-white hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-safe:transition-all ${
                      markers.actionNeeded
                        ? 'border-amber-300/80 ring-1 ring-amber-200/60'
                        : 'border-slate-200/70'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span
                        className="min-w-0 flex-1 truncate font-mono text-[10px] font-semibold text-slate-600"
                        title={row.quotation_number}
                      >
                        {row.quotation_number}
                      </span>
                      {markers.actionNeeded && (
                        <span
                          aria-label={t('actionNeeded')}
                          className="h-1.5 w-1.5 flex-none rounded-full bg-amber-500 ring-2 ring-amber-100"
                        />
                      )}
                    </div>

                    <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1">
                      <span className="flex min-w-0 [&>span]:max-w-full [&>span]:truncate [&>span]:px-1.5 [&>span]:py-0 [&>span]:text-[10px]">
                        <QuotationStatusBadge status={row.status} />
                      </span>
                      {markers.actionNeeded && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0 text-[10px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-600/20">
                          <FiAlertCircle aria-hidden="true" className="h-2.5 w-2.5" />
                          {t('action')}
                        </span>
                      )}
                    </div>

                    <p className="mt-1.5 text-[10px] text-slate-500">
                      {formatQuotationDate(row.created_at, locale, t)}
                      <span aria-hidden="true" className="px-1 text-slate-300">
                        ·
                      </span>
                      {row.item_count} {t(row.item_count === 1 ? 'line' : 'lines')}
                    </p>

                    <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                      {markers.hasCurrentVersion && markers.currentVersionLabel ? (
                        <span className="truncate text-[10px] text-slate-500">
                          {markers.currentVersionLabel}
                        </span>
                      ) : (
                        <span aria-hidden="true" />
                      )}
                      <span className="inline-flex flex-none items-center gap-0.5 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary group-hover:bg-primary group-hover:text-white motion-safe:transition-colors">
                        {t('view')}
                        <FiArrowRight aria-hidden="true" className="h-2.5 w-2.5" />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
