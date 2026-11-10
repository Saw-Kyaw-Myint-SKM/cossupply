import { Link } from 'react-router-dom';
import { primaryButtonClass } from '../../../components/catalog-ui/CatalogUi';
import { useI18n } from '../../../lib/i18n-context';
import type { QuotationVersion } from '../api/quotationAdminApi';
import QuotationVersionPills from './QuotationVersionPills';

interface QuotationVersionPanelProps {
  requestId: number;
  versions: QuotationVersion[];
  canCreateVersion: boolean;
}

/**
 * Final quotations section on the request workspace.
 *
 * Each version is a pill that opens its own page; the full items table,
 * totals, PDF and email detail live on the version page so this workspace
 * stays focused on the request itself.
 */
export default function QuotationVersionPanel({
  requestId,
  versions,
  canCreateVersion,
}: QuotationVersionPanelProps) {
  const { t } = useI18n();

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">{t('finalQuotations')}</h2>
          <p className="mt-1 text-sm text-gray-600">{t('sentVersionsImmutable')}</p>
        </div>
        {!canCreateVersion ? (
          <p className="text-sm text-gray-500">{t('requestClosedVersions')}</p>
        ) : null}
      </div>

      {versions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-plate p-6">
          <p className="text-sm font-medium text-ink">{t('noQuotationVersion')}</p>
          <p className="mt-1 text-sm text-gray-500">{t('quotationVersionEmptyHint')}</p>
          {canCreateVersion ? (
            <Link
              to={`/admin/quotation-requests/${requestId}/versions/new`}
              className={`${primaryButtonClass} mt-4`}
            >
              {t('createFirstVersion')}
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="rounded-xl border border-rule bg-plate p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <p className="mb-3 text-sm text-gray-600">{t('openVersionHint')}</p>
          <QuotationVersionPills
            requestId={requestId}
            versions={versions}
            canCreateVersion={canCreateVersion}
          />
        </div>
      )}
    </section>
  );
}
