/**
 * My Quotations list (Tasks 06 and 08).
 *
 * Paginated list of the authenticated customer's quotation requests. Each row
 * links to `/quotations/{id}`. Task 08 adds the current version/status,
 * validity, expiry, and an "Action needed" hint for a sent-but-unreviewed
 * current quotation. Loading / empty / permission-error states stay the same
 * as every other list (Definition of Done).
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listQuotationRequests, type QuotationRequestSummary } from '../api/quotationsApi';
import QuotationSummaryCard from '../components/QuotationSummaryCard';
import {
  EmptyState,
  LoadingPanel,
  PageHeader,
  Pagination,
  describeCustomerLoadError,
  linkClass,
  primaryButtonClass,
  type LoadErrorState,
} from '../../../components/catalog-ui/CatalogUi';
import { useI18n } from '../../../lib/i18n-context';
import type { PaginationMeta } from '../../../api/query';

const PER_PAGE = 10;

export default function QuotationListPage() {
  const { t } = useI18n();
  const [requests, setRequests] = useState<QuotationRequestSummary[] | null>(null);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<LoadErrorState | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setLoadError(null);

      const response = await listQuotationRequests({ page, per_page: PER_PAGE });

      if (cancelled) return;

      if (response.success && response.data) {
        setRequests(response.data.quotation_requests);
        setMeta(response.data.meta);
      } else {
        setLoadError(describeCustomerLoadError(response, t('quotationLoadSubject')));
      }

      setIsLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [page, reloadToken, t]);

  const header = (
    <PageHeader
      title={t('myQuotations')}
      description={t('quotationsDescription')}
    />
  );

  // Permission problems (expired customer token) get the retry-or-login panel.
  if (loadError && (loadError.needsLogin || requests === null)) {
    return (
      <div className="space-y-6">
        {header}
        <div className="rounded-lg border border-red-200 bg-red-50 p-6" role="alert">
          <h2 className="text-lg font-semibold text-red-800">{t('quotationsUnavailable')}</h2>
          <p className="mt-1 text-sm text-red-700">{loadError.message}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setReloadToken((token) => token + 1)}
              className={primaryButtonClass}
            >
              {t('tryAgain')}
            </button>
            {loadError.needsLogin ? (
              <Link to="/login" className={linkClass}>
                {t('goToLogin')}
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  if (isLoading && requests === null) {
    return (
      <div className="space-y-6">
        {header}
        <LoadingPanel label={t('loadingQuotations')} />
      </div>
    );
  }

  const rows = requests ?? [];

  if (rows.length === 0) {
    return (
      <div className="space-y-6">
        {header}
        <EmptyState
          title={t('noQuotationRequests')}
          hint={t('noQuotationRequestsHint')}
        />
        <div className="text-center">
          <Link to="/cart" className={`${primaryButtonClass} inline-block`}>
            {t('openOrderList')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

      {isLoading && rows.length > 0 ? (
        <p className="px-1 text-xs text-gray-500" aria-live="polite">
          {t('refreshing')}
        </p>
      ) : null}

      <section
        className="space-y-4"
        aria-busy={isLoading}
        aria-label={t('quotationRequests')}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <QuotationSummaryCard key={row.id} row={row} />
          ))}
        </div>

        {meta && meta.last_page > 1 ? (
          <div className="overflow-hidden rounded-2xl border border-rule bg-white">
            <Pagination meta={meta} onPage={setPage} disabled={isLoading} />
          </div>
        ) : null}
      </section>
    </div>
  );
}
