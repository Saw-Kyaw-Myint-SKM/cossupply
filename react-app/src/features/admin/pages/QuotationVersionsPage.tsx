import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Alert,
  LoadingPanel,
  describeLoadError,
  linkClass,
  secondaryButtonClass,
  type LoadErrorState,
} from '../../../components/catalog-ui/CatalogUi';
import { useI18n } from '../../../lib/i18n-context';
import QuotationVersionPanel from '../components/QuotationVersionPanel';
import {
  getAdminQuotationRequest,
  type QuotationRequestDetailResult,
} from '../api/quotationAdminApi';

/**
 * Final quotations index for one request.
 *
 * The version pills live here instead of the request workspace, so the
 * workspace stays focused on the request snapshot and supplier contact.
 */
export default function QuotationVersionsPage() {
  const { requestId } = useParams<{ requestId: string }>();
  const id = Number(requestId);
  const { t } = useI18n();

  const [detail, setDetail] = useState<QuotationRequestDetailResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<LoadErrorState | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!Number.isInteger(id) || id <= 0) {
        setLoading(false);
        setLoadError({ message: 'That quotation request number is not valid.', needsLogin: false });
        return;
      }

      setLoading(true);
      setLoadError(null);
      const response = await getAdminQuotationRequest(id);
      if (cancelled) return;

      if (response.success && response.data) {
        setDetail(response.data);
      } else {
        setDetail(null);
        setLoadError(describeLoadError(response, 'this quotation request'));
      }
      setLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [id, reloadToken]);

  const refresh = () => setReloadToken((token) => token + 1);

  if (loading && !detail) {
    return <LoadingPanel label="Loading quotation versions" />;
  }

  if (loadError || !detail) {
    return (
      <div className="space-y-4">
        <Alert tone="error">
          <p>{loadError?.message ?? 'The quotation request could not be loaded.'}</p>
          {loadError?.needsLogin ? (
            <Link to="/admin/login" className={`${linkClass} mt-2`}>
              {t('signInButton')}
            </Link>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={refresh} className={secondaryButtonClass}>
                {t('retry')}
              </button>
              <Link to="/admin/quotation-requests" className={secondaryButtonClass}>
                {t('quotationRequests')}
              </Link>
            </div>
          )}
        </Alert>
      </div>
    );
  }

  const request = detail.quotation_request;
  const canCreateVersion = !['ACCEPTED', 'REJECTED', 'CANCELLED'].includes(request.status);

  return (
    <div className="space-y-6">
      <nav aria-label={t('breadcrumb')} className="flex flex-wrap items-center gap-1.5 text-sm text-gray-500">
        <Link to="/admin/quotation-requests" className={linkClass}>
          {t('quotationRequests')}
        </Link>
        <span aria-hidden="true">/</span>
        <Link to={`/admin/quotation-requests/${request.id}`} className={linkClass}>
          {request.quotation_number}
        </Link>
        <span aria-hidden="true">/</span>
        <span className="font-medium text-ink">{t('versions')}</span>
      </nav>

      <QuotationVersionPanel
        requestId={request.id}
        versions={request.quotations}
        canCreateVersion={canCreateVersion}
      />

      <div className="flex flex-wrap gap-2">
        <Link to={`/admin/quotation-requests/${request.id}`} className={secondaryButtonClass}>
          {t('backToRequest')}
        </Link>
      </div>
    </div>
  );
}
