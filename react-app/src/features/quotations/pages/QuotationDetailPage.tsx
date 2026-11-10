/**
 * Customer quotation review (Task 08).
 *
 * Renders only the authenticated customer's own request (the API returns 404
 * for anyone else). The first load goes through POST /view so the quotation
 * moves to VIEWED and the request to CUSTOMER_REVIEWING exactly once; retries
 * and post-action refreshes use the side-effect-free GET.
 *
 * The server is the source of truth for versions, totals, expiry, and whether
 * each action is allowed. This page never derives permission from local status
 * guesses: it disables buttons from `can_accept` / `can_reject` /
 * `can_request_change`, and every mutation reloads the detail so superseded
 * or expired states appear immediately.
 */
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  FiAlertCircle,
  FiAlertTriangle,
  FiArrowLeft,
  FiCheckCircle,
} from 'react-icons/fi';
import {
  Alert,
  FALLBACK_THUMB,
  Field,
  StatusBadge,
  describeCustomerLoadError,
  inputClass,
  joinIds,
  linkClass,
  primaryButtonClass,
  secondaryButtonClass,
  type LoadErrorState,
} from '../../../components/catalog-ui/CatalogUi';
import { useI18n, type Translator } from '../../../lib/i18n-context';
import type { ApiResponse } from '../../../api/client';
import QuotationStatusBadge from '../components/QuotationStatusBadge';
import QuotationRequestItemsCard from '../components/QuotationRequestItemsCard';
import {
  acceptQuotation,
  getQuotationRequest,
  markQuotationRequestViewed,
  rejectQuotation,
  requestQuotationChange,
  type CustomerQuotationVersion,
  type QuotationMutationOrder,
  type QuotationMutationResult,
  type QuotationRequestDetail,
} from '../api/quotationsApi';
import {
  CUSTOMER_NOTE_MAX_LENGTH,
  buildAcceptPayload,
  buildChangeRequestPayload,
  buildRejectPayload,
  canAcceptQuotation,
  canRejectQuotation,
  canRequestQuotationChange,
  canShowActions,
  formatQuotationAmount,
  formatQuotationDate,
  formatQuotationDateTime,
  formatValidity,
  isCurrentVersion,
  isExpiredForActions,
  quotationActionLabel,
  quotationActorLabel,
  quotationItemSupplier,
  quotationLineTotal,
  quotationStatusLabel,
  visibleQuotationVersions,
} from '../lib/quotationView';

type ActionKind = 'accept' | 'reject' | 'change';

interface ActionNotice {
  tone: 'success' | 'warning';
  text: string;
}

const dangerButtonClass =
  'inline-flex items-center justify-center rounded-md border border-transparent bg-red-700 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-red-800 active:scale-[.99] focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 motion-safe:transition-colors disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100';

const cardClass = 'rounded-2xl border border-rule bg-plate shadow-sm';
const cardTitleClass = 'text-base font-bold text-ink';
const fieldLabelClass = 'text-xs text-gray-500';

const noticeToneClasses: Record<'error' | 'success' | 'warning', string> = {
  error: 'border-error/30 bg-error-soft text-error',
  success: 'border-success/30 bg-success-soft text-success',
  warning: 'border-warning/30 bg-warning-soft text-warning',
};

/** Compact top-of-page banner for transient quotation notices. */
function NoticeBanner({
  tone,
  children,
  title,
}: {
  tone: 'error' | 'success' | 'warning';
  children: ReactNode;
  title?: string;
}) {
  const Icon =
    tone === 'error' ? FiAlertCircle : tone === 'warning' ? FiAlertTriangle : FiCheckCircle;

  return (
    <div
      role={tone === 'success' ? 'status' : 'alert'}
      title={title}
      className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs sm:text-[13px] ${noticeToneClasses[tone]}`}
    >
      <Icon aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 flex-none" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function QuotationDetailSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" aria-label={label}>
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="space-y-4">
        <div className={`space-y-3 ${cardClass} p-4 sm:p-6`}>
          <div className="h-2.5 w-24 animate-pulse rounded bg-gray-200 motion-reduce:animate-none" />
          <div className="h-7 w-52 animate-pulse rounded bg-gray-200 motion-reduce:animate-none" />
          <div className="h-3 w-60 animate-pulse rounded bg-gray-100 motion-reduce:animate-none" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className={`space-y-2.5 ${cardClass} p-4 sm:p-6`}>
            <div className="h-2.5 w-28 animate-pulse rounded bg-gray-200 motion-reduce:animate-none" />
            <div className="h-3 w-40 animate-pulse rounded bg-gray-100 motion-reduce:animate-none" />
            <div className="h-3 w-32 animate-pulse rounded bg-gray-100 motion-reduce:animate-none" />
          </div>
          <div className={`space-y-2.5 ${cardClass} p-4 sm:p-6`}>
            <div className="h-2.5 w-28 animate-pulse rounded bg-gray-200 motion-reduce:animate-none" />
            <div className="h-3 w-44 animate-pulse rounded bg-gray-100 motion-reduce:animate-none" />
            <div className="h-3 w-36 animate-pulse rounded bg-gray-100 motion-reduce:animate-none" />
          </div>
        </div>
        <div className={`space-y-3 ${cardClass} p-4 sm:p-6`}>
          <div className="h-2.5 w-32 animate-pulse rounded bg-gray-200 motion-reduce:animate-none" />
          <div className="h-28 w-full animate-pulse rounded bg-gray-100 motion-reduce:animate-none" />
        </div>
      </div>
    </div>
  );
}

/** COD terms fallback matches the MVP's only payment mode. */
function codTermsFor(version: CustomerQuotationVersion | null, t: Translator): string {
  return version?.cod_terms?.trim() || t('codTermsDefault');
}

function deliveryDateFor(version: CustomerQuotationVersion): string | null {
  if (version.delivery_date) return version.delivery_date;
  const datedItem = version.items.find((item) => Boolean(item.delivery_date));
  return datedItem?.delivery_date ?? null;
}

const VERSION_DOT_CLASS: Record<string, string> = {
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

/** Pill switcher shared by the request overview and each version page. */
function QuotationVersionPills({
  requestId,
  versions,
  request,
  activeId,
}: {
  requestId: number;
  versions: CustomerQuotationVersion[];
  request: QuotationRequestDetail;
  activeId?: number;
}) {
  const { t } = useI18n();

  return (
    <nav aria-label={t('quotationVersions')} className="flex flex-wrap items-center gap-2">
      {versions.map((version) => {
        const active = version.id === activeId;
        const current = isCurrentVersion(version, request);
        return (
          <Link
            key={version.id}
            to={`/quotations/${requestId}/versions/${version.id}`}
            aria-current={active ? 'page' : undefined}
            className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
              active
                ? 'border-primary bg-primary text-white shadow-sm'
                : 'border-line bg-plate text-ink hover:border-primary/40 hover:bg-accent-soft hover:text-primary'
            }`}
          >
            <span
              aria-hidden="true"
              className={`h-2 w-2 rounded-full ${
                active ? 'bg-white/80' : VERSION_DOT_CLASS[version.status] ?? 'bg-gray-400'
              }`}
            />
            <span>{t('version', { version: version.version })}</span>
            <span className={`text-xs font-medium ${active ? 'text-white/80' : 'text-gray-500'}`}>
              {current ? t('current') : quotationStatusLabel(version.status, t)}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

export default function QuotationDetailPage() {
  const { t, locale } = useI18n();
  const { id: idParam, versionId: versionIdParam } = useParams<{
    id: string;
    versionId?: string;
  }>();
  const id = Number(idParam);
  const versionId = versionIdParam ? Number(versionIdParam) : null;
  const navigate = useNavigate();

  const [detail, setDetail] = useState<QuotationRequestDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<LoadErrorState | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [panel, setPanel] = useState<ActionKind | null>(null);
  const [acceptAck, setAcceptAck] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [changeNote, setChangeNote] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionFieldErrors, setActionFieldErrors] = useState<Record<string, string[]>>({});
  const [notice, setNotice] = useState<ActionNotice | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);
  const [acceptedJustNow, setAcceptedJustNow] = useState(false);
  const [acceptedOrder, setAcceptedOrder] = useState<QuotationMutationOrder | null>(null);

  const loadedIdRef = useRef<number | null>(null);
  const viewRequestedIdRef = useRef<number | null>(null);
  const panelRef = useRef<HTMLFormElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!Number.isInteger(id) || id <= 0) {
      setIsLoading(false);
      setLoadError({ message: t('invalidQuotationLink'), needsLogin: false });
      return;
    }

    // POST /view is the first call for this request id; every retry, manual
    // reload, and post-action refresh after that uses the side-effect-free GET.
    const initial = viewRequestedIdRef.current !== id;
    if (initial) viewRequestedIdRef.current = id;
    const load = async () => {
      if (initial) {
        setIsLoading(true);
        setDetail(null);
        setPanel(null);
        setNotice(null);
        setConflict(null);
        setActionError(null);
        setActionFieldErrors({});
        setAcceptedJustNow(false);
        setAcceptedOrder(null);
        setAcceptAck(false);
        setRejectNote('');
        setChangeNote('');
      } else if (loadedIdRef.current !== id) {
        // Retry after a failed first load: use GET (per the contract) but keep
        // the skeleton visible until the request settles.
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }

      setLoadError(null);
      setRefreshError(null);

      const response = initial
        ? await markQuotationRequestViewed(id)
        : await getQuotationRequest(id);

      if (cancelled) return;

      if (response.success && response.data) {
        const next = response.data.quotation_request;
        loadedIdRef.current = id;
        setDetail(next);
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      if (response.status === 401 || response.status === 403) {
        setIsLoading(false);
        setIsRefreshing(false);
        navigate('/login', { replace: true });
        return;
      }

      const error =
        response.status === 404
          ? {
              message: t('quotationNotFound'),
              needsLogin: false,
            }
          : describeCustomerLoadError(response, t('quotationLoadSubject'));

      if (loadedIdRef.current === id) {
        setRefreshError(error.message);
      } else {
        setLoadError(error);
      }
      setIsLoading(false);
      setIsRefreshing(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [id, reloadToken, navigate, t]);

  // Inline panels are simpler than a modal and keep the quotation visible
  // behind the confirmation; focus still moves to the first field on open.
  useEffect(() => {
    if (!panel) return;
    const target = panelRef.current?.querySelector<HTMLElement>('[data-autofocus]');
    target?.focus();
  }, [panel]);

  const refresh = () => setReloadToken((token) => token + 1);

  const openPanel = (kind: ActionKind, trigger: HTMLButtonElement) => {
    triggerRef.current = trigger;
    setPanel(kind);
    setActionError(null);
    setActionFieldErrors({});
    setConflict(null);
    setNotice(null);
  };

  const closePanel = () => {
    setPanel(null);
    setActionError(null);
    setActionFieldErrors({});
    triggerRef.current?.focus();
  };

  const handleActionFailure = (
    response: ApiResponse<QuotationMutationResult>,
    fallback: string,
  ) => {
    if (response.status === 401 || response.status === 403) {
      navigate('/login', { replace: true });
      return;
    }

    if (response.status === 409) {
      setActionError(null);
      setActionFieldErrors({});
      setPanel(null);
      setConflict(
        response.message ??
          t('quotationChanged'),
      );
      refresh();
      return;
    }

    setActionFieldErrors(response.errors ?? {});
    setActionError(response.message ?? fallback);
  };

  const submitAccept = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!detail || !actionVersion || actionBusy) return;

    setActionError(null);
    setActionFieldErrors({});
    const built = buildAcceptPayload(acceptAck, t);
    if (!built.ok) {
      setActionFieldErrors(built.fieldErrors);
      return;
    }

    setActionBusy(true);
    const response = await acceptQuotation(actionVersion.id);
    setActionBusy(false);

    if (!response.success || !response.data) {
      handleActionFailure(response, t('quotationAcceptFailed'));
      return;
    }

    setPanel(null);
    setAcceptAck(false);
    setNotice(null);
    setConflict(null);
    setAcceptedOrder(response.data.order ?? null);
    setAcceptedJustNow(true);
    refresh();
  };

  const submitReject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!detail || !actionVersion || actionBusy) return;

    setActionError(null);
    setActionFieldErrors({});
    const built = buildRejectPayload(rejectNote, t);
    if (!built.ok) {
      setActionFieldErrors(built.fieldErrors);
      return;
    }

    setActionBusy(true);
    const response = await rejectQuotation(actionVersion.id, rejectNote);
    setActionBusy(false);

    if (!response.success || !response.data) {
      handleActionFailure(response, t('quotationRejectFailed'));
      return;
    }

    setPanel(null);
    setRejectNote('');
    setAcceptedJustNow(false);
    setAcceptedOrder(null);
    setConflict(null);
    setNotice({
      tone: 'warning',
      text: t('quotationRejectedNotice'),
    });
    refresh();
  };

  const submitChange = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!detail || !actionVersion || actionBusy) return;

    setActionError(null);
    setActionFieldErrors({});
    const built = buildChangeRequestPayload(changeNote, t);
    if (!built.ok) {
      setActionFieldErrors(built.fieldErrors);
      return;
    }

    setActionBusy(true);
    const response = await requestQuotationChange(actionVersion.id, changeNote);
    setActionBusy(false);

    if (!response.success || !response.data) {
      handleActionFailure(response, t('changeRequestFailed'));
      return;
    }

    setPanel(null);
    setChangeNote('');
    setAcceptedJustNow(false);
    setAcceptedOrder(null);
    setConflict(null);
    setNotice({
      tone: 'success',
      text: t('changeRequestedNotice'),
    });
    refresh();
  };

  // ---------- Early states ----------

  if (isLoading && !detail) {
    return (
      <div className="space-y-4">
        <Link to="/quotations" className={linkClass}>
          <FiArrowLeft aria-hidden="true" className="h-4 w-4" />
          {t('backToMyQuotations')}
        </Link>
        <QuotationDetailSkeleton label={t('loadingQuotation')} />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="space-y-4">
        <Link to="/quotations" className={linkClass}>
          <FiArrowLeft aria-hidden="true" className="h-4 w-4" />
          {t('backToMyQuotations')}
        </Link>
        <Alert tone="error">
          <p className="font-bold">{t('quotationOpenFailed')}</p>
          <p className="mt-1">
            {loadError?.message ?? t('quotationLoadFailed')}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" onClick={refresh} className={secondaryButtonClass}>
              {t('tryAgain')}
            </button>
            <Link to="/quotations" className={secondaryButtonClass}>
              {t('backToMyQuotations')}
            </Link>
            {loadError?.needsLogin ? (
              <Link to="/login" className={linkClass}>
                {t('goToLogin')}
              </Link>
            ) : null}
          </div>
        </Alert>
      </div>
    );
  }

  const request = detail;
  // Prefer the order from the accept response; fall back to the detail payload
  // so the created order still renders after a reload or a later GET refresh.
  const orderSummary = acceptedOrder ?? request.order ?? null;
  const versions = visibleQuotationVersions(request.versions);
  const isVersionPage = versionId !== null;
  const selectedVersion =
    versionId !== null
      ? versions.find((version) => version.id === versionId) ?? null
      : (versions.find((version) => version.is_current) ?? versions[0] ?? null);
  const latestVersion = versions.reduce<CustomerQuotationVersion | null>(
    (latest, version) => (!latest || version.version > latest.version ? version : latest),
    null,
  );
  const currentVersion = versions.find((version) => version.is_current) ?? null;
  const actionVersion =
    selectedVersion && isCurrentVersion(selectedVersion, request) ? selectedVersion : null;
  const expiredForActions = actionVersion
    ? isExpiredForActions(actionVersion, request)
    : false;
  const overallExpired =
    Boolean(request.is_expired) ||
    request.status === 'EXPIRED' ||
    Boolean(currentVersion?.is_expired);
  const showActionBar =
    actionVersion !== null &&
    (canShowActions(actionVersion, request) || expiredForActions);

  const acceptEnabled = actionVersion ? canAcceptQuotation(actionVersion, request) : false;
  const rejectEnabled = actionVersion ? canRejectQuotation(actionVersion, request) : false;
  const changeEnabled = actionVersion
    ? canRequestQuotationChange(actionVersion, request)
    : false;

  const headerStatus =
    overallExpired &&
    request.status !== 'ACCEPTED' &&
    request.status !== 'REJECTED' &&
    request.status !== 'CANCELLED'
      ? 'EXPIRED'
      : request.status;

  // Build the sentence once; callers must not re-wrap it in the same
  // translation or the phrase is duplicated ("expired expired …").
  const expiryLabel = currentVersion?.valid_until
    ? t('quotationExpired', {
        date: ` ${formatQuotationDate(currentVersion.valid_until, locale, t)}`,
      })
    : t('quotationExpired', { date: '' });

  const summaryDeliverTo = [
    request.delivery_address,
    request.city,
    request.township,
    request.landmark ? t('nearLandmark', { landmark: request.landmark }) : null,
  ]
    .filter((part): part is string => Boolean(part))
    .join(', ');

  const acceptFieldError = actionFieldErrors.cod_terms_accepted?.[0] ?? null;
  const noteFieldError = actionFieldErrors.customer_note?.[0] ?? null;
  const changeError = noteFieldError;
  const rejectError = noteFieldError;

  if (isVersionPage && !selectedVersion) {
    return (
      <div className="space-y-4">
        <Link to={`/quotations/${id}`} className={linkClass}>
          <FiArrowLeft aria-hidden="true" className="h-4 w-4" />
          {t('backToRequest')}
        </Link>
        <Alert tone="error">
          <p className="font-bold">{t('quotationNotFound')}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Link to={`/quotations/${id}`} className={secondaryButtonClass}>
              {t('backToRequest')}
            </Link>
            <Link to="/quotations" className={secondaryButtonClass}>
              {t('backToMyQuotations')}
            </Link>
          </div>
        </Alert>
      </div>
    );
  }

  const selectedMeta = selectedVersion
    ? [
        formatValidity(
          selectedVersion.valid_until,
          Boolean(selectedVersion.is_expired),
          locale,
          t,
        ),
        deliveryDateFor(selectedVersion)
          ? t('deliveryOn', {
              date: formatQuotationDate(deliveryDateFor(selectedVersion), locale, t),
            })
          : null,
        selectedVersion.sent_at
          ? t('sentOn', {
              date: formatQuotationDateTime(selectedVersion.sent_at, locale, t),
            })
          : null,
      ]
        .filter((part): part is string => Boolean(part))
        .join(' · ')
    : '';

  return (
    <div className="space-y-4">
      <Link to={isVersionPage ? `/quotations/${id}` : '/quotations'} className={linkClass}>
        <FiArrowLeft aria-hidden="true" className="h-4 w-4" />
        {isVersionPage ? t('backToRequest') : t('backToMyQuotations')}
      </Link>

      {overallExpired && request.status !== 'ACCEPTED' ? (
        <NoticeBanner tone="warning" title={t('quotationExpiredHint')}>
          <span className="font-bold">{expiryLabel}</span>
        </NoticeBanner>
      ) : null}

      {refreshError ? (
        <NoticeBanner tone="error">
          {refreshError}{' '}
          <button type="button" onClick={refresh} className={`${linkClass} font-semibold`}>
            {t('tryAgain')}
          </button>
        </NoticeBanner>
      ) : null}

      {conflict ? <NoticeBanner tone="warning">{conflict}</NoticeBanner> : null}
      {notice ? <NoticeBanner tone={notice.tone}>{notice.text}</NoticeBanner> : null}
      {actionError ? <NoticeBanner tone="error">{actionError}</NoticeBanner> : null}

      {acceptedJustNow || request.status === 'ACCEPTED' ? (
        <NoticeBanner tone="success">
          <p className="font-bold">{t('quotationAccepted')}</p>
          <p className="mt-0.5">
            {orderSummary ? t('acceptedOrderCreated') : t('acceptedLocked')}
          </p>
        </NoticeBanner>
      ) : null}

      {isRefreshing ? (
        <p className="text-xs text-gray-500" aria-live="polite">
          {t('refreshingQuotation')}
        </p>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-mono text-xl font-bold tracking-tight text-ink sm:text-2xl">
            {request.quotation_number}
          </h1>
          <p className="mt-1 text-xs text-gray-500">
            {t('requestedDateLabel')}: {formatQuotationDate(request.created_at, locale, t)}
            {request.required_delivery_date
              ? ` · ${t('requiredDeliveryLabel')}: ${formatQuotationDate(
                  request.required_delivery_date,
                  locale,
                  t,
                )}`
              : ''}
          </p>
        </div>
        <QuotationStatusBadge status={headerStatus} size="md" className="flex-none" />
      </div>

      {!isVersionPage ? (
        latestVersion ? (
          <section
            className={`${cardClass} border-primary/20 bg-accent-soft p-4 sm:p-5`}
            aria-labelledby="final-quotation-title"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 id="final-quotation-title" className="text-sm font-semibold text-ink">
                  {t('version', { version: latestVersion.version })} ·{' '}
                  {formatValidity(
                    latestVersion.valid_until,
                    Boolean(latestVersion.is_expired),
                    locale,
                    t,
                  )}
                </h2>
              </div>
              <div className="sm:text-right">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  {t('total')}
                </p>
                <p className="text-xl font-bold tabular-nums text-primary">
                  {formatQuotationAmount(latestVersion.total_amount, t)}{' '}
                  <span className="text-xs font-semibold">{t('mmk')}</span>
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-primary/15 pt-3">
              <QuotationVersionPills requestId={id} versions={versions} request={request} />
              <Link
                to={`/quotations/${id}/versions/${latestVersion.id}`}
                className={primaryButtonClass}
              >
                {t('viewQuotation')}
              </Link>
            </div>
          </section>
        ) : (
          <section className={`${cardClass} p-4 sm:p-5`}>
            <h2 className="text-sm font-semibold text-ink">{t('noQuotationSent')}</h2>
            <p className="mt-1 text-sm text-gray-600">{t('noQuotationSentHint')}</p>
          </section>
        )
      ) : (
        <section className={`${cardClass} p-4 sm:p-5`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="min-w-0 text-sm font-semibold text-ink">
              {t('version', { version: selectedVersion!.version })}
              {selectedMeta ? (
                <span className="font-normal text-gray-500"> · {selectedMeta}</span>
              ) : null}
            </h2>
            <QuotationStatusBadge status={selectedVersion!.status} className="flex-none" />
          </div>
          <div className="mt-3 border-t border-rule pt-3">
            <QuotationVersionPills
              requestId={id}
              versions={versions}
              request={request}
              activeId={selectedVersion!.id}
            />
          </div>
        </section>
      )}

      {orderSummary && !isVersionPage ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-rule bg-plate px-4 py-2.5 text-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            {t('order')}
          </span>
          <span className="font-mono text-xs font-semibold text-ink">
            {orderSummary.order_number}
          </span>
          <span className="hidden text-gray-300 sm:inline" aria-hidden="true">
            ·
          </span>
          <span className="tabular-nums text-gray-700">
            {formatQuotationAmount(orderSummary.total_amount, t)} {t('mmk')}
          </span>
          <span className="ml-auto flex flex-wrap items-center gap-2">
            <StatusBadge status={orderSummary.payment_status} />
            <StatusBadge status={orderSummary.delivery_status} />
          </span>
        </div>
      ) : null}

      {!isVersionPage ? (
        <section className={`${cardClass} p-4 sm:p-5`}>
          <div className="grid gap-4 sm:grid-cols-2 sm:gap-6">
            <div>
              <h2 className={cardTitleClass}>{t('requestDetails')}</h2>
              <dl className="mt-2 grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-2 gap-y-1 text-sm">
                <dt className="text-gray-500">{t('name')}</dt>
                <dd className="min-w-0 text-ink">
                  {request.customer_name}
                  {request.company_name ? (
                    <span className="text-gray-500"> · {request.company_name}</span>
                  ) : null}
                </dd>
                <dt className="text-gray-500">{t('phone')}</dt>
                <dd className="min-w-0 text-gray-700">{request.phone}</dd>
                {request.email ? (
                  <>
                    <dt className="text-gray-500">{t('email')}</dt>
                    <dd className="min-w-0 break-all text-gray-700">{request.email}</dd>
                  </>
                ) : null}
              </dl>
            </div>

            <div className="border-t border-rule pt-3 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
              <h2 className={cardTitleClass}>{t('deliveryDetails')}</h2>
              <dl className="mt-2 grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-2 gap-y-1 text-sm">
                <dt className="text-gray-500">{t('deliverTo')}</dt>
                <dd className="min-w-0 whitespace-pre-line text-gray-700">{summaryDeliverTo}</dd>
                {request.required_delivery_date ? (
                  <>
                    <dt className="text-gray-500">{t('requiredDeliveryLabel')}</dt>
                    <dd className="min-w-0 text-gray-700">
                      {formatQuotationDate(request.required_delivery_date, locale, t)}
                    </dd>
                  </>
                ) : null}
              </dl>
            </div>
          </div>

          {request.customer_note ? (
            <div className="mt-4 border-t border-rule pt-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                {t('yourNote')}
              </h3>
              <p className="mt-1 whitespace-pre-line text-sm text-gray-700">
                {request.customer_note}
              </p>
            </div>
          ) : null}
        </section>
      ) : null}

      {!isVersionPage ? <QuotationRequestItemsCard items={request.items} /> : null}

      {isVersionPage && selectedVersion ? (
        <div className="space-y-4">
                <section className={`${cardClass} overflow-hidden`}>
                  <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-3 pt-4 sm:px-6">
                    <h3 className={cardTitleClass}>{t('items')}</h3>
                    <p className="text-xs text-gray-500">
                      {t('itemCount', {
                        count: selectedVersion.items.length,
                        noun: t(
                          selectedVersion.items.length === 1 ? 'item' : 'itemsPlural',
                        ),
                      })}
                    </p>
                  </div>

                  {selectedVersion.items.length === 0 ? (
                    <p className="border-t border-rule px-4 py-4 text-sm text-gray-500 sm:px-6">
                      {t('noPricedItems')}
                    </p>
                  ) : (
                    <>
                      {/* Mobile: stacked cards keep long product names readable. */}
                      <ul className="divide-y divide-rule border-t border-rule sm:hidden">
                        {selectedVersion.items.map((item, index) => {
                          const supplier = quotationItemSupplier(item);
                          const lineDiscount = item.line_discount ?? item.discount ?? 0;

                          return (
                            <li
                              key={item.id ?? `${item.product_name_snapshot}-${index}`}
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
                                  <p className="text-ink">
                                    {item.product_name_snapshot}
                                  </p>
                                  {supplier ? (
                                    <p className="text-xs text-gray-500">{supplier}</p>
                                  ) : null}
                                  {item.specification_snapshot ? (
                                    <p className="text-xs text-gray-500">
                                      {item.specification_snapshot}
                                    </p>
                                  ) : null}
                                </div>
                              </div>

                              <dl className="grid grid-cols-3 gap-2 text-xs">
                                <div>
                                  <dt className="text-gray-500">{t('qty')}</dt>
                                  <dd className="mt-0.5 tabular-nums text-gray-700">
                                    {item.quantity}
                                  </dd>
                                </div>
                                <div>
                                  <dt className="text-gray-500">{t('unitPrice')}</dt>
                                  <dd className="mt-0.5 tabular-nums text-gray-700">
                                    {formatQuotationAmount(item.unit_price, t)}
                                  </dd>
                                </div>
                                <div className="text-right">
                                  <dt className="text-gray-500">{t('lineTotal')}</dt>
                                  <dd className="mt-0.5 font-semibold tabular-nums text-ink">
                                    {formatQuotationAmount(quotationLineTotal(item), t)}{' '}
                                    {t('mmk')}
                                  </dd>
                                </div>
                              </dl>

                              {lineDiscount > 0 ? (
                                <p className="text-right text-xs text-gray-500">
                                  {t('discount')}:{' '}
                                  {formatQuotationAmount(lineDiscount, t)} {t('mmk')}
                                </p>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>

                      {/* Desktop: right-aligned numbers and a consistent MMK suffix. */}
                      <div className="hidden overflow-x-auto border-t border-rule sm:block">
                        <table className="min-w-full text-sm">
                          <caption className="sr-only">
                            {t('quotationVersionItems', { version: selectedVersion.version })}
                          </caption>
                          <thead className="bg-gray-50/70 text-xs font-bold text-gray-500">
                            <tr>
                              <th scope="col" className="px-5 py-2.5 text-left sm:px-6">
                                {t('itemLabel')}
                              </th>
                              <th scope="col" className="px-4 py-2.5 text-right">
                                {t('qty')}
                              </th>
                              <th scope="col" className="px-4 py-2.5 text-right">
                                {t('unitPrice')}
                              </th>
                              <th scope="col" className="px-4 py-2.5 text-right">
                                {t('discount')}
                              </th>
                              <th scope="col" className="px-5 py-2.5 text-right sm:px-6">
                                {t('lineTotal')}
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-rule">
                            {selectedVersion.items.map((item, index) => {
                              const supplier = quotationItemSupplier(item);
                              return (
                                <tr
                                  key={item.id ?? `${item.product_name_snapshot}-${index}`}
                                  className="align-top"
                                >
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
                                        <p className="text-ink">
                                          {item.product_name_snapshot}
                                        </p>
                                        {supplier ? (
                                          <p className="text-xs text-gray-500">{supplier}</p>
                                        ) : null}
                                        {item.specification_snapshot ? (
                                          <p className="text-xs text-gray-500">
                                            {item.specification_snapshot}
                                          </p>
                                        ) : null}
                                        {item.supplier_note || item.warranty_note ? (
                                          <p className="mt-1 text-xs text-gray-600">
                                            {[item.supplier_note, item.warranty_note]
                                              .filter(Boolean)
                                              .join(' · ')}
                                          </p>
                                        ) : null}
                                      </div>
                                    </div>
                                  </th>
                                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-gray-700">
                                    {item.quantity}
                                  </td>
                                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-gray-700">
                                    {formatQuotationAmount(item.unit_price, t)}
                                  </td>
                                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-gray-700">
                                    {formatQuotationAmount(
                                      item.line_discount ?? item.discount ?? 0,
                                      t,
                                    )}
                                  </td>
                                  <td className="whitespace-nowrap px-5 py-3 text-right font-semibold tabular-nums text-ink sm:px-6">
                                    {formatQuotationAmount(quotationLineTotal(item), t)}{' '}
                                    <span className="text-xs font-normal text-gray-500">
                                      {t('mmk')}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                  <div className="border-t border-rule px-4 py-4 sm:px-6">
                    <dl className="ml-auto grid w-full max-w-sm gap-1.5 text-sm">
                      <div className="flex items-center justify-between gap-6">
                        <dt className={fieldLabelClass}>{t('subtotal')}</dt>
                        <dd className="tabular-nums text-gray-700">
                          {formatQuotationAmount(selectedVersion.subtotal, t)} {t('mmk')}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-6">
                        <dt className={fieldLabelClass}>{t('discount')}</dt>
                        <dd className="tabular-nums text-gray-700">
                          {formatQuotationAmount(selectedVersion.discount_amount, t)}{' '}
                          {t('mmk')}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-6">
                        <dt className={fieldLabelClass}>{t('deliveryFee')}</dt>
                        <dd className="tabular-nums text-gray-700">
                          {formatQuotationAmount(selectedVersion.delivery_fee, t)} {t('mmk')}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-6">
                        <dt className={fieldLabelClass}>
                          {t('serviceFee', {
                            percent: selectedVersion.service_fee_percentage,
                          })}
                        </dt>
                        <dd className="tabular-nums text-gray-700">
                          {formatQuotationAmount(selectedVersion.service_fee, t)} {t('mmk')}
                        </dd>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-6 border-t border-rule pt-2.5">
                        <dt className="text-sm font-bold text-ink">{t('total')}</dt>
                        <dd className="text-base font-bold tabular-nums text-ink">
                          {formatQuotationAmount(selectedVersion.total_amount, t)}{' '}
                          <span className="text-xs font-semibold text-gray-500">
                            {t('mmk')}
                          </span>
                        </dd>
                      </div>
                    </dl>
                  </div>
                </section>

                <section className={`${cardClass} p-4 sm:p-5`} aria-label={t('quotationActions')}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <h4 className={cardTitleClass}>{t('paymentTerms')}</h4>
                      <p className="mt-1.5 whitespace-pre-line text-sm text-gray-700">
                        {codTermsFor(selectedVersion, t)}
                      </p>
                    </div>
                    <div>
                      <h4 className={cardTitleClass}>{t('salesTeamNote')}</h4>
                      <p className="mt-1.5 whitespace-pre-line text-sm text-gray-700">
                        {selectedVersion.admin_note?.trim() || t('statusNoValue')}
                      </p>
                    </div>
                  </div>

                  <div
                    className="mt-4 border-t border-rule pt-3"
                    aria-label={t('actionHistoryVersion', { version: selectedVersion.version })}
                  >
                    <h4 className={cardTitleClass}>{t('actionHistory')}</h4>
                  {selectedVersion.actions.length === 0 ? (
                    <p className="mt-2 text-sm text-gray-500">{t('noActionsYet')}</p>
                  ) : (
                    <ol className="mt-3 space-y-3 border-l border-rule pl-4">
                      {selectedVersion.actions.map((action, index) => {
                        const actor = quotationActorLabel(action.actor_type, t);
                        return (
                          <li key={`${action.action}-${action.created_at}-${index}`}>
                            <p className="text-sm text-ink">
                              {quotationActionLabel(action.action, t)}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatQuotationDateTime(action.created_at, locale, t)}
                              {actor ? ` · ${actor}` : ''}
                            </p>
                            {action.customer_note ? (
                              <p className="mt-1 whitespace-pre-line rounded bg-gray-50 px-3 py-2 text-sm text-gray-700">
                                {action.customer_note}
                              </p>
                            ) : null}
                          </li>
                        );
                      })}
                    </ol>
                  )}
                  </div>

                {showActionBar && actionVersion ? (
                  <div className="mt-4 border-t border-rule pt-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                      <button
                        type="button"
                        onClick={(event) => openPanel('accept', event.currentTarget)}
                        disabled={!acceptEnabled || actionBusy}
                        title={
                          expiredForActions
                            ? t('acceptDisabledExpired')
                            : !request.can_accept
                              ? t('acceptDisabled')
                              : undefined
                        }
                        className={`${primaryButtonClass} w-full sm:w-auto`}
                      >
                        {t('acceptQuotation')}
                      </button>
                      <button
                        type="button"
                        onClick={(event) => openPanel('reject', event.currentTarget)}
                        disabled={!rejectEnabled || actionBusy}
                        title={
                          !request.can_reject
                            ? t('rejectDisabled')
                            : undefined
                        }
                        className={`${secondaryButtonClass} w-full sm:w-auto`}
                      >
                        {t('reject')}
                      </button>
                      <button
                        type="button"
                        onClick={(event) => openPanel('change', event.currentTarget)}
                        disabled={!changeEnabled || actionBusy}
                        title={
                          !request.can_request_change
                            ? t('changeDisabled')
                            : undefined
                        }
                        className={`${secondaryButtonClass} w-full sm:w-auto`}
                      >
                        {t('requestChange')}
                      </button>
                    </div>

                    {panel === 'accept' ? (
                      <form
                        ref={panelRef}
                        onSubmit={submitAccept}
                        className="mt-4 rounded-xl border border-rule bg-plate p-4"
                        aria-labelledby="accept-panel-title"
                      >
                        <h4 id="accept-panel-title" className={cardTitleClass}>
                          {t('acceptVersion', { version: actionVersion.version })}
                        </h4>
                        <p className="mt-1 text-sm text-gray-600">
                          {t('acceptVersionHint')}
                        </p>

                        <dl className="mt-3 grid gap-2 rounded border border-rule bg-gray-50 px-3 py-2 text-sm sm:grid-cols-2">
                          <div>
                            <dt className={fieldLabelClass}>{t('total')}</dt>
                            <dd className="font-semibold tabular-nums text-ink">
                              {formatQuotationAmount(actionVersion.total_amount, t)} {t('mmk')}
                            </dd>
                          </div>
                          <div>
                            <dt className={fieldLabelClass}>{t('payment')}</dt>
                            <dd className="text-ink">{t('cashOnDelivery')}</dd>
                          </div>
                        </dl>

                        <div className="mt-3 rounded border border-rule bg-gray-50 px-3 py-2">
                          <p className={fieldLabelClass}>{t('codTerms')}</p>
                          <p className="mt-1 whitespace-pre-line text-sm text-gray-700">
                            {codTermsFor(actionVersion, t)}
                          </p>
                        </div>

                        <div className="mt-4">
                          <label
                            htmlFor="accept-cod"
                            className="flex items-start gap-2 text-sm text-gray-800"
                          >
                            <input
                              id="accept-cod"
                              data-autofocus
                              type="checkbox"
                              checked={acceptAck}
                              onChange={(event) => setAcceptAck(event.target.checked)}
                              disabled={actionBusy}
                              aria-invalid={Boolean(acceptFieldError) || undefined}
                              aria-describedby={joinIds(
                                acceptFieldError ? 'accept-cod-error' : null,
                              )}
                              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-accent"
                            />
                            <span>
                              {t('acceptCodAcknowledgement', {
                                total: formatQuotationAmount(actionVersion.total_amount, t),
                              })}
                            </span>
                          </label>
                          {acceptFieldError ? (
                            <p id="accept-cod-error" role="alert" className="mt-1.5 text-sm text-red-600">
                              {acceptFieldError}
                            </p>
                          ) : null}
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <button type="submit" disabled={actionBusy} className={primaryButtonClass}>
                            {actionBusy ? t('accepting') : t('acceptQuotation')}
                          </button>
                          <button
                            type="button"
                            onClick={closePanel}
                            disabled={actionBusy}
                            className={secondaryButtonClass}
                          >
                            {t('cancel')}
                          </button>
                        </div>
                      </form>
                    ) : null}

                    {panel === 'reject' ? (
                      <form
                        ref={panelRef}
                        onSubmit={submitReject}
                        className="mt-4 rounded-xl border border-rule bg-plate p-4"
                        aria-labelledby="reject-panel-title"
                      >
                        <h4 id="reject-panel-title" className={cardTitleClass}>
                          {t('rejectVersion', { version: actionVersion.version })}
                        </h4>
                        <Alert tone="warning" className="mt-3">
                          {t('rejectWarning')}
                        </Alert>

                        <div className="mt-3">
                          <Field
                            label={t('reasonOptional')}
                            htmlFor="reject-note"
                            error={rejectError ? [rejectError] : null}
                            hint={t('characterCount', {
                              count: rejectNote.length.toLocaleString(locale === 'my' ? 'my-MM' : 'en-US'),
                              max: CUSTOMER_NOTE_MAX_LENGTH.toLocaleString(locale === 'my' ? 'my-MM' : 'en-US'),
                            })}
                            hintId="reject-note-hint"
                          >
                            <textarea
                              id="reject-note"
                              data-autofocus
                              rows={3}
                              maxLength={CUSTOMER_NOTE_MAX_LENGTH}
                              value={rejectNote}
                              onChange={(event) => setRejectNote(event.target.value)}
                              disabled={actionBusy}
                              aria-invalid={Boolean(rejectError) || undefined}
                              aria-describedby={joinIds(
                                'reject-note-hint',
                                rejectError ? 'reject-note-error' : null,
                              )}
                              className={inputClass(Boolean(rejectError))}
                            />
                          </Field>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <button type="submit" disabled={actionBusy} className={dangerButtonClass}>
                            {actionBusy ? t('rejecting') : t('reject')}
                          </button>
                          <button
                            type="button"
                            onClick={closePanel}
                            disabled={actionBusy}
                            className={secondaryButtonClass}
                          >
                            {t('keepReviewing')}
                          </button>
                        </div>
                      </form>
                    ) : null}

                    {panel === 'change' ? (
                      <form
                        ref={panelRef}
                        onSubmit={submitChange}
                        className="mt-4 rounded-xl border border-rule bg-plate p-4"
                        aria-labelledby="change-panel-title"
                      >
                        <h4 id="change-panel-title" className={cardTitleClass}>
                          {t('requestChangeVersion', { version: actionVersion.version })}
                        </h4>
                        <p className="mt-1 text-sm text-gray-600">
                          {t('requestChangeHint')}
                        </p>

                        <div className="mt-3">
                          <Field
                            label={t('whatChanged')}
                            htmlFor="change-note"
                            required
                            error={changeError ? [changeError] : null}
                            hint={t('requiredCharacterCount', {
                              count: changeNote.length.toLocaleString(locale === 'my' ? 'my-MM' : 'en-US'),
                              max: CUSTOMER_NOTE_MAX_LENGTH.toLocaleString(locale === 'my' ? 'my-MM' : 'en-US'),
                            })}
                            hintId="change-note-hint"
                          >
                            <textarea
                              id="change-note"
                              data-autofocus
                              rows={4}
                              maxLength={CUSTOMER_NOTE_MAX_LENGTH}
                              value={changeNote}
                              onChange={(event) => setChangeNote(event.target.value)}
                              disabled={actionBusy}
                              aria-invalid={Boolean(changeError) || undefined}
                              aria-describedby={joinIds(
                                'change-note-hint',
                                changeError ? 'change-note-error' : null,
                              )}
                              className={inputClass(Boolean(changeError))}
                            />
                          </Field>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <button type="submit" disabled={actionBusy} className={primaryButtonClass}>
                            {actionBusy ? t('sending') : t('sendChangeRequest')}
                          </button>
                          <button
                            type="button"
                            onClick={closePanel}
                            disabled={actionBusy}
                            className={secondaryButtonClass}
                          >
                            {t('cancel')}
                          </button>
                        </div>
                      </form>
                    ) : null}
                  </div>
                ) : null}
                </section>
        </div>
      ) : null}
    </div>
  );
}
