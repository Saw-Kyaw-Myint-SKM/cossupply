import { Link } from 'react-router-dom';
import { useI18n, type TranslationKey } from '../../../lib/i18n-context';
import type { QuotationVersion, QuotationVersionStatus } from '../api/quotationAdminApi';

const STATUS_DOT: Record<QuotationVersionStatus, string> = {
  DRAFT: 'bg-gray-400',
  SENT: 'bg-primary',
  VIEWED: 'bg-primary',
  CHANGE_REQUESTED: 'bg-warning',
  ACCEPTED: 'bg-success',
  REJECTED: 'bg-error',
  EXPIRED: 'bg-gray-400',
  SUPERSEDED: 'bg-gray-400',
  CANCELLED: 'bg-gray-400',
};

const STATUS_KEY: Record<QuotationVersionStatus, TranslationKey> = {
  DRAFT: 'statusDraft',
  SENT: 'statusSent',
  VIEWED: 'statusViewed',
  CHANGE_REQUESTED: 'statusChangeRequested',
  ACCEPTED: 'statusAccepted',
  REJECTED: 'statusRejected',
  EXPIRED: 'statusExpired',
  SUPERSEDED: 'statusSuperseded',
  CANCELLED: 'statusCancelled',
};

interface QuotationVersionPillsProps {
  requestId: number;
  versions: QuotationVersion[];
  /** The version currently open on the dedicated version page. */
  activeVersionId?: number;
  canCreateVersion: boolean;
}

/**
 * Version switcher shared by the request workspace and the version page.
 * Each pill links to that version's own page so the URL stays shareable.
 */
export default function QuotationVersionPills({
  requestId,
  versions,
  activeVersionId,
  canCreateVersion,
}: QuotationVersionPillsProps) {
  const { t } = useI18n();

  return (
    <nav aria-label={t('versions')} className="flex flex-wrap items-center gap-2">
      {versions.map((version) => {
        const isActive = version.id === activeVersionId;
        const statusLabel = version.is_current
          ? t('current')
          : t(STATUS_KEY[version.status]);

        return (
          <Link
            key={version.id}
            to={`/admin/quotation-requests/${requestId}/versions/${version.id}`}
            aria-current={isActive ? 'page' : undefined}
            className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
              isActive
                ? 'border-primary bg-primary text-white shadow-sm'
                : 'border-line bg-plate text-ink hover:border-primary/40 hover:bg-accent-soft hover:text-primary'
            }`}
          >
            <span
              aria-hidden="true"
              className={`h-2 w-2 rounded-full ${isActive ? 'bg-white/80' : STATUS_DOT[version.status]}`}
            />
            <span>{t('version', { version: version.version })}</span>
            <span className={`text-xs font-medium ${isActive ? 'text-white/80' : 'text-gray-500'}`}>
              {statusLabel}
            </span>
          </Link>
        );
      })}

      {canCreateVersion ? (
        <Link
          to={`/admin/quotation-requests/${requestId}/versions/new`}
          className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-primary/40 px-3.5 py-1.5 text-sm font-semibold text-primary transition-colors hover:border-primary hover:bg-accent-soft focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          <span aria-hidden="true" className="text-base leading-none">+</span>
          {t('createNewVersion')}
        </Link>
      ) : null}
    </nav>
  );
}
