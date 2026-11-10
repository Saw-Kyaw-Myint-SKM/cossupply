import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FiCalendar, FiClock, FiUser } from 'react-icons/fi';
import {
  Alert,
  LoadingPanel,
  StatusBadge,
  describeLoadError,
  linkClass,
  primaryButtonClass,
  secondaryButtonClass,
  type LoadErrorState,
} from '../../../components/catalog-ui/CatalogUi';
import { useI18n } from '../../../lib/i18n-context';
import { formatLocalDate } from '../../../lib/localization';
import { saveDownloadedFile } from '../../../lib/downloadFile';
import QuotationVersionDetail from '../components/QuotationVersionDetail';
import QuotationVersionPills from '../components/QuotationVersionPills';
import {
  downloadQuotationPdf,
  generateQuotationPdf,
  getAdminQuotationRequest,
  resendQuotationEmail,
  sendQuotation,
  type EmailLog,
  type QuotationRequestDetailResult,
  type QuotationVersion,
} from '../api/quotationAdminApi';

/**
 * Dedicated page for one quotation version.
 *
 * Reuses the request detail endpoint and picks the version out of
 * `quotation_request.quotations`, so no extra API call is needed and the
 * request workspace stays a light navigation surface.
 */
export default function QuotationVersionDetailPage() {
  const { requestId, versionId } = useParams<{ requestId: string; versionId: string }>();
  const id = Number(requestId);
  const vid = Number(versionId);
  const { locale, t } = useI18n();

  const [detail, setDetail] = useState<QuotationRequestDetailResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<LoadErrorState | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!Number.isInteger(id) || id <= 0) {
        setLoading(false);
        setLoadError({ message: 'That quotation version was not found on this request.', needsLogin: false });
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
        setLoadError(describeLoadError(response, 'this quotation version'));
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
    return <LoadingPanel label="Loading quotation version" />;
  }

  if (loadError || !detail) {
    return (
      <div className="space-y-4">
        <Alert tone="error">
          <p>{loadError?.message ?? t('versionNotFound')}</p>
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
  const version = request.quotations.find((entry) => entry.id === vid);

  if (!version) {
    return (
      <div className="space-y-4">
        <nav aria-label={t('breadcrumb')} className="flex flex-wrap items-center gap-1.5 text-sm text-gray-500">
          <Link to="/admin/quotation-requests" className={linkClass}>
            {t('quotationRequests')}
          </Link>
          <span aria-hidden="true">/</span>
          <Link to={`/admin/quotation-requests/${request.id}`} className={linkClass}>
            {request.quotation_number}
          </Link>
          <span aria-hidden="true">/</span>
          <Link to={`/admin/quotation-requests/${request.id}/versions`} className={linkClass}>
            {t('versions')}
          </Link>
        </nav>
        <Alert tone="error">
          <p>{t('versionNotFound')}</p>
          <Link to={`/admin/quotation-requests/${request.id}`} className={`${secondaryButtonClass} mt-3`}>
            {t('backToRequest')}
          </Link>
        </Alert>
      </div>
    );
  }

  const date = (value: string | null) => formatLocalDate(value, locale) ?? t('noData');
  const dateTime = (value: string | null) =>
    formatLocalDate(value, locale, { dateStyle: 'medium', timeStyle: 'short' }) ?? t('noData');
  const isDraft = version.status === 'DRAFT';
  const canCreateVersion = !['ACCEPTED', 'REJECTED', 'CANCELLED'].includes(request.status);

  const runDownload = async (target: QuotationVersion) => {
    setActionError(null);
    setBusy(`${target.id}:download`);
    const result = await downloadQuotationPdf(target.id);
    setBusy(null);
    if (!result.success || !result.data) {
      setActionError(result.message ?? t('quotationPdfDownloadFailed'));
      return;
    }
    saveDownloadedFile(result.data);
  };
  const runGeneratePdf = async (target: QuotationVersion) => {
    setActionError(null);
    setNotice(null);
    setBusy(`${target.id}:pdf`);
    const result = await generateQuotationPdf(target.id);
    setBusy(null);
    if (!result.success || !result.data) {
      setActionError(result.message ?? t('quotationPdfGenerateFailed'));
      return;
    }
    setNotice(t('pdfGeneratedVersion', { version: target.version }));
    refresh();
  };
  const runSend = async (target: QuotationVersion) => {
    if (!window.confirm(t('sendQuotationConfirm', { version: target.version, quotation: target.quotation_number }))) return;
    setActionError(null);
    setNotice(null);
    setBusy(`${target.id}:send`);
    const result = await sendQuotation(target.id);
    setBusy(null);
    if (!result.success || !result.data) {
      setActionError(result.message ?? t('quotationSendFailed'));
      return;
    }
    const email: EmailLog = result.data.email;
    setNotice(
      email.status === 'SENT'
        ? t('versionSent', { version: target.version, email: email.recipient_email })
        : t('versionEmailFailed', { version: target.version }),
    );
    refresh();
  };
  const runResend = async (target: QuotationVersion) => {
    setActionError(null);
    setNotice(null);
    setBusy(`${target.id}:resend`);
    const result = await resendQuotationEmail(target.id);
    setBusy(null);
    if (!result.success || !result.data) {
      setActionError(result.message ?? t('quotationEmailResendFailed'));
      return;
    }
    setNotice(
      result.data.email.status === 'SENT'
        ? t('quotationEmailResent', { email: result.data.email.recipient_email })
        : t('resendAttemptFailed'),
    );
    refresh();
  };

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
        <Link to={`/admin/quotation-requests/${request.id}/versions`} className={linkClass}>
          {t('versions')}
        </Link>
        <span aria-hidden="true">/</span>
        <span className="font-medium text-ink">{t('version', { version: version.version })}</span>
      </nav>

      {notice ? <Alert tone="success">{notice}</Alert> : null}
      {actionError ? <Alert tone="error">{actionError}</Alert> : null}

      <section className="rounded-xl border border-rule bg-plate p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_28px_-16px_rgba(15,23,42,0.16)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-primary">
              {t('version', { version: version.version })}
            </h1>
            <StatusBadge status={version.status} />
            {version.is_current ? (
              <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800">
                {t('current')}
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {isDraft ? (
              <>
                <Link to={`/admin/quotations/${version.id}/edit`} className={secondaryButtonClass}>
                  {t('editDraft')}
                </Link>
                {version.pdfs.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => void runDownload(version)}
                    disabled={busy === `${version.id}:download`}
                    className={secondaryButtonClass}
                  >
                    {busy === `${version.id}:download` ? t('downloading') : t('downloadPdf')}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void runGeneratePdf(version)}
                  disabled={busy === `${version.id}:pdf`}
                  className={secondaryButtonClass}
                >
                  {busy === `${version.id}:pdf` ? t('generating') : t('generatePdf')}
                </button>
                <button
                  type="button"
                  onClick={() => void runSend(version)}
                  disabled={busy === `${version.id}:send`}
                  className={primaryButtonClass}
                >
                  {busy === `${version.id}:send` ? t('sending') : t('sendToCustomer')}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => void runDownload(version)}
                  disabled={busy === `${version.id}:download`}
                  className={secondaryButtonClass}
                >
                  {busy === `${version.id}:download` ? t('downloading') : t('downloadPdf')}
                </button>
                {version.sent_at ? (
                  <button
                    type="button"
                    onClick={() => void runResend(version)}
                    disabled={busy === `${version.id}:resend`}
                    className={primaryButtonClass}
                  >
                    {busy === `${version.id}:resend` ? t('resending') : t('resendEmail')}
                  </button>
                ) : null}
              </>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-rule pt-3 text-sm text-gray-600">
          <span className="rounded bg-paper px-2 py-0.5 font-mono text-xs font-semibold tracking-wide text-gray-600 ring-1 ring-inset ring-rule">
            {version.quotation_number}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <FiCalendar className="h-4 w-4 flex-none text-gray-400" aria-hidden="true" />
            {t('createdOn', { date: dateTime(version.created_at) })}
          </span>
          {version.created_by_admin ? (
            <span className="inline-flex items-center gap-1.5">
              <FiUser className="h-4 w-4 flex-none text-gray-400" aria-hidden="true" />
              {version.created_by_admin.name}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1.5">
            <FiClock className="h-4 w-4 flex-none text-gray-400" aria-hidden="true" />
            {t('validUntil', { date: date(version.valid_until) })}
          </span>
        </div>
      </section>

      <div className="rounded-xl border border-rule bg-paper p-3">
        <QuotationVersionPills
          requestId={request.id}
          versions={request.quotations}
          activeVersionId={version.id}
          canCreateVersion={canCreateVersion}
        />
      </div>

      <QuotationVersionDetail version={version} />

      {version.pdfs.length > 0 || version.sent_at ? <Alert tone="warning">{t('sharePdfHint')}</Alert> : null}
      {isDraft ? <p className="text-xs text-gray-500">{t('draftTotalsHint')}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Link to={`/admin/quotation-requests/${request.id}`} className={secondaryButtonClass}>
          {t('backToRequest')}
        </Link>
      </div>
    </div>
  );
}
