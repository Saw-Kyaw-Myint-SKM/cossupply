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
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  EmptyState,
  Field,
  PageHeader,
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
  visibleQuotationVersions,
} from '../lib/quotationView';

type ActionKind = 'accept' | 'reject' | 'change';

interface ActionNotice {
  tone: 'success' | 'warning';
  text: string;
}

const dangerButtonClass =
  'inline-flex items-center justify-center rounded-md border border-transparent bg-red-700 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-red-800 active:scale-[.99] focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 motion-safe:transition-colors disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100';

function QuotationDetailSkeleton({ label }: { label: string }) {
  return (
    <div
      className="space-y-4"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="space-y-4">
        <div className="h-36 animate-pulse rounded-lg border border-rule bg-plate motion-reduce:animate-none" />
        <div className="h-16 animate-pulse rounded-lg border border-rule bg-plate motion-reduce:animate-none" />
        <div className="space-y-3 rounded-lg border border-rule bg-plate p-4">
          <div className="h-4 w-1/3 animate-pulse rounded bg-gray-200 motion-reduce:animate-none" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-gray-100 motion-reduce:animate-none" />
          <div className="h-24 animate-pulse rounded bg-gray-100 motion-reduce:animate-none" />
        </div>
        <div className="h-12 animate-pulse rounded-lg border border-rule bg-plate motion-reduce:animate-none" />
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

export default function QuotationDetailPage() {
  const { t, locale } = useI18n();
  const { id: idParam } = useParams<{ id: string }>();
  const id = Number(idParam);
  const navigate = useNavigate();

  const [detail, setDetail] = useState<QuotationRequestDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<LoadErrorState | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);

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
        setSelectedVersionId((previous) => {
          const versions = visibleQuotationVersions(next.versions);
          if (previous !== null && versions.some((version) => version.id === previous)) {
            return previous;
          }
          return (versions.find((version) => version.is_current) ?? versions[0])?.id ?? null;
        });
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
      <div className="space-y-6">
        <PageHeader
          title={t('quotation')}
          action={
            <Link to="/quotations" className={linkClass}>
              {t('backToMyQuotations')}
            </Link>
          }
        />
        <QuotationDetailSkeleton label={t('loadingQuotation')} />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t('quotation')}
          action={
            <Link to="/quotations" className={linkClass}>
              {t('backToMyQuotations')}
            </Link>
          }
        />
        <Alert tone="error">
          <p className="font-semibold">{t('quotationOpenFailed')}</p>
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
  const selectedVersion =
    versions.find((version) => version.id === selectedVersionId) ?? versions[0] ?? null;
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

  const expiryLabel = currentVersion?.valid_until
    ? t('quotationExpired', { date: ` ${formatQuotationDate(currentVersion.valid_until, locale, t)}` })
    : '';

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

  return (
    <div className="space-y-6">
      <PageHeader
        title={request.quotation_number}
        description={t('requested', { date: formatQuotationDateTime(request.created_at, locale, t) }) + (
          request.required_delivery_date
            ? ` · ${t('requestedDelivery', { date: formatQuotationDate(request.required_delivery_date, locale, t) })}`
            : ''
        )}
        action={
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <div className="flex flex-wrap items-center gap-2">
              <QuotationStatusBadge status={request.status} />
              {currentVersion ? (
                <>
                  <span className="text-xs text-gray-500">
                    {t('version', { version: currentVersion.version })}
                  </span>
                  <QuotationStatusBadge status={currentVersion.status} />
                </>
              ) : null}
            </div>
            <Link to="/quotations" className={linkClass}>
              {t('backToMyQuotations')}
            </Link>
          </div>
        }
      />

      {isRefreshing ? (
        <p className="text-xs text-gray-500" aria-live="polite">
          {t('refreshingQuotation')}
        </p>
      ) : null}

      {refreshError ? (
        <Alert tone="error">
          {refreshError}{' '}
          <button type="button" onClick={refresh} className={`${linkClass} font-semibold`}>
            {t('tryAgain')}
          </button>
        </Alert>
      ) : null}

      {conflict ? <Alert tone="warning">{conflict}</Alert> : null}

      {acceptedJustNow || request.status === 'ACCEPTED' ? (
        <div className="space-y-3">
          <Alert tone="success">
            <p className="font-semibold">{t('quotationAccepted')}</p>
            <p className="mt-1">
              {orderSummary
                ? t('acceptedOrderCreated')
                : t('acceptedLocked')}
            </p>
          </Alert>

          {orderSummary ? (
            <section
              className="rounded-lg border border-rule bg-plate p-4"
              aria-labelledby="accepted-order-title"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 id="accepted-order-title" className="text-base font-semibold text-ink">
                    {t('orderCreated')}
                  </h2>
                  <p className="mt-1 text-sm text-gray-600">
                    {t('orderCreatedHint')}
                  </p>
                </div>
                <StatusBadge status={orderSummary.order_status} />
              </div>

              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <dt className="text-xs text-gray-500">{t('orderNumber')}</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums text-ink">
                    {orderSummary.order_number}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">{t('total')}</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums text-ink">
                    {formatQuotationAmount(orderSummary.total_amount, t)} {t('mmk')}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">{t('created')}</dt>
                  <dd className="mt-0.5 text-gray-700">
                    {formatQuotationDateTime(orderSummary.created_at, locale, t)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">{t('payment')}</dt>
                  <dd className="mt-0.5">
                    <StatusBadge status={orderSummary.payment_status} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">{t('delivery')}</dt>
                  <dd className="mt-0.5">
                    <StatusBadge status={orderSummary.delivery_status} />
                  </dd>
                </div>
              </dl>
            </section>
          ) : null}
        </div>
      ) : null}

      {notice ? <Alert tone={notice.tone}>{notice.text}</Alert> : null}
      {actionError ? <Alert tone="error">{actionError}</Alert> : null}

      {overallExpired && request.status !== 'ACCEPTED' ? (
        <Alert tone="warning">
          <p className="font-semibold">{t('quotationExpired', { date: expiryLabel })}</p>
          <p className="mt-1">
            {t('quotationExpiredHint')}
          </p>
        </Alert>
      ) : null}

      <section
        className="rounded-lg border border-rule bg-plate p-4 sm:p-6"
        aria-label={t('requestDetails')}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-ink">{t('requestDetails')}</h2>
            <p className="mt-1 text-sm text-gray-600">
              {t('requestDetailsHint')}
            </p>
          </div>
          <p className="text-xs text-gray-500">
            {t('itemCount', { count: request.items.length, noun: t(request.items.length === 1 ? 'item' : 'itemsPlural') })}
          </p>
        </div>

        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              {t('contact')}
            </dt>
            <dd className="mt-1 text-gray-800">
              {request.customer_name}
              {request.company_name ? ` · ${request.company_name}` : ''}
            </dd>
            <dd className="mt-0.5 text-gray-600">
              {request.phone}
              {request.email ? ` · ${request.email}` : ''}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              {t('deliverTo')}
            </dt>
            <dd className="mt-1 whitespace-pre-line text-gray-800">{summaryDeliverTo}</dd>
            {request.required_delivery_date ? (
              <dd className="mt-1 text-xs text-gray-500">
                {t('requiredBy', { date: formatQuotationDate(request.required_delivery_date, locale, t) })}
              </dd>
            ) : null}
          </div>
          {request.customer_note ? (
            <div className="sm:col-span-2">
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {t('yourNote')}
              </dt>
              <dd className="mt-1 whitespace-pre-line rounded bg-gray-50 px-3 py-2 text-gray-700">
                {request.customer_note}
              </dd>
            </div>
          ) : null}
        </dl>
      </section>

      {versions.length === 0 ? (
        <EmptyState
          title={t('noQuotationSent')}
          hint={t('noQuotationSentHint')}
        />
      ) : (
        <>
          <section className="space-y-2" aria-label={t('quotationVersions')}>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2 className="text-lg font-semibold text-ink">{t('quotationVersions')}</h2>
              <p className="text-xs text-gray-500">
                {t('quotationVersionsHint')}
              </p>
            </div>
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label={t('chooseQuotationVersion')}
            >
              {versions.map((version) => {
                const selected = selectedVersion?.id === version.id;

                return (
                  <button
                    key={version.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setSelectedVersionId(version.id)}
                    className={`flex min-w-[9.5rem] flex-col items-start gap-1.5 rounded-lg border px-3 py-2 text-left motion-safe:transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 ${
                      selected
                        ? 'border-ink bg-plate ring-1 ring-ink'
                        : 'border-rule bg-plate hover:bg-gray-50'
                    }`}
                  >
                    <span className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-ink">
                      {t('version', { version: version.version })}
                      {version.is_current ? (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-800">
                          {t('current')}
                        </span>
                      ) : null}
                    </span>
                    <QuotationStatusBadge status={version.status} />
                  </button>
                );
              })}
            </div>
          </section>

          {selectedVersion ? (
            <article className="overflow-hidden rounded-lg border border-rule bg-plate">
              <header className="border-b border-rule bg-gray-50 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-ink">
                    {t('version', { version: selectedVersion.version })}
                  </h3>
                  <QuotationStatusBadge status={selectedVersion.status} />
                  {selectedVersion.is_current ? (
                    <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800">
                      {t('current')}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {formatValidity(
                    selectedVersion.valid_until,
                    Boolean(selectedVersion.is_expired),
                    locale,
                    t,
                  )}
                  {deliveryDateFor(selectedVersion)
                    ? ` · ${t('deliveryOn', { date: formatQuotationDate(deliveryDateFor(selectedVersion), locale, t) })}`
                    : ''}
                  {selectedVersion.sent_at
                    ? ` · ${t('sentOn', { date: formatQuotationDateTime(selectedVersion.sent_at, locale, t) })}`
                    : ''}
                </p>
              </header>

              <dl className="grid gap-3 border-b border-rule px-4 py-3 text-sm sm:grid-cols-3 lg:grid-cols-5">
                <div>
                  <dt className="text-xs text-gray-500">{t('subtotal')}</dt>
                  <dd className="mt-0.5 font-medium tabular-nums text-ink">
                    {formatQuotationAmount(selectedVersion.subtotal, t)} {t('mmk')}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">{t('discount')}</dt>
                  <dd className="mt-0.5 font-medium tabular-nums text-ink">
                    {formatQuotationAmount(selectedVersion.discount_amount, t)} {t('mmk')}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">{t('deliveryFee')}</dt>
                  <dd className="mt-0.5 font-medium tabular-nums text-ink">
                    {formatQuotationAmount(selectedVersion.delivery_fee, t)} {t('mmk')}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">
                    {t('serviceFee', { percent: selectedVersion.service_fee_percentage })}
                  </dt>
                  <dd className="mt-0.5 font-medium tabular-nums text-ink">
                    {formatQuotationAmount(selectedVersion.service_fee, t)} {t('mmk')}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">{t('total')}</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums text-ink">
                    {formatQuotationAmount(selectedVersion.total_amount, t)} {t('mmk')}
                  </dd>
                </div>
              </dl>

              {selectedVersion.items.length === 0 ? (
                <p className="border-b border-rule px-4 py-3 text-sm text-gray-500">
                  {t('noPricedItems')}
                </p>
              ) : (
                <div className="overflow-x-auto border-b border-rule">
                  <table className="min-w-full divide-y divide-rule text-sm">
                    <caption className="sr-only">
                      {t('quotationVersionItems', { version: selectedVersion.version })}
                    </caption>
                    <thead className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <tr>
                        <th scope="col" className="px-4 py-2">
                          {t('itemLabel')}
                        </th>
                        <th scope="col" className="px-4 py-2">
                          {t('qty')}
                        </th>
                        <th scope="col" className="px-4 py-2">
                          {t('unitPrice')}
                        </th>
                        <th scope="col" className="px-4 py-2">
                          {t('discount')}
                        </th>
                        <th scope="col" className="px-4 py-2">
                          {t('lineTotal')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-rule">
                      {selectedVersion.items.map((item, index) => {
                        const supplier = quotationItemSupplier(item);
                        return (
                          <tr key={item.id ?? `${item.product_name_snapshot}-${index}`}>
                            <th scope="row" className="px-4 py-2 text-left font-normal">
                              <p className="font-medium text-ink">
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
                            </th>
                            <td className="px-4 py-2 tabular-nums text-gray-700">
                              {item.quantity}
                            </td>
                            <td className="px-4 py-2 tabular-nums text-gray-700">
                              {formatQuotationAmount(item.unit_price, t)}
                            </td>
                            <td className="px-4 py-2 tabular-nums text-gray-700">
                              {formatQuotationAmount(
                                item.line_discount ?? item.discount ?? 0,
                                t,
                              )}
                            </td>
                            <td className="px-4 py-2 tabular-nums font-medium text-ink">
                              {formatQuotationAmount(quotationLineTotal(item), t)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="grid gap-4 border-b border-rule px-4 py-4 text-sm md:grid-cols-2">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {t('cashOnDeliveryTerms')}
                  </h4>
                  <p className="mt-1 whitespace-pre-line text-gray-700">
                    {codTermsFor(selectedVersion, t)}
                  </p>
                </div>
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {t('salesTeamNote')}
                  </h4>
                  <p className="mt-1 whitespace-pre-line text-gray-700">
                    {selectedVersion.admin_note?.trim() || t('statusNoValue')}
                  </p>
                </div>
              </div>

              <section
                className="px-4 py-4"
                aria-label={t('actionHistoryVersion', { version: selectedVersion.version })}
              >
                <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {t('actionHistory')}
                </h4>
                {selectedVersion.actions.length === 0 ? (
                  <p className="mt-2 text-sm text-gray-500">{t('noActionsYet')}</p>
                ) : (
                  <ol className="mt-3 space-y-3 border-l border-rule pl-4">
                    {selectedVersion.actions.map((action, index) => {
                      const actor = quotationActorLabel(action.actor_type, t);
                      return (
                        <li key={`${action.action}-${action.created_at}-${index}`}>
                          <p className="text-sm font-medium text-ink">
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
              </section>

              {showActionBar && actionVersion ? (
                <section
                  className="border-t border-rule bg-gray-50/70 px-4 py-4"
                  aria-label={t('quotationActions')}
                >
                  {expiredForActions ? (
                    <Alert tone="warning" className="mb-3">
                      {t('versionExpiredAction', { date: expiryLabel })}
                    </Alert>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-2">
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
                      className={primaryButtonClass}
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
                      className={secondaryButtonClass}
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
                      className={secondaryButtonClass}
                    >
                      {t('requestChange')}
                    </button>
                  </div>

                  {expiredForActions ? (
                    <p className="mt-2 text-xs text-amber-800">
                      {t('acceptDisabledExpired')}
                    </p>
                  ) : null}

                  {panel === 'accept' ? (
                    <form
                      ref={panelRef}
                      onSubmit={submitAccept}
                      className="mt-4 rounded-lg border border-rule bg-plate p-4"
                      aria-labelledby="accept-panel-title"
                    >
                      <h4 id="accept-panel-title" className="text-base font-semibold text-ink">
                        {t('acceptVersion', { version: actionVersion.version })}
                      </h4>
                      <p className="mt-1 text-sm text-gray-600">
                        {t('acceptVersionHint')}
                      </p>

                      <dl className="mt-3 grid gap-2 rounded border border-rule bg-gray-50 px-3 py-2 text-sm sm:grid-cols-2">
                        <div>
                          <dt className="text-xs text-gray-500">{t('total')}</dt>
                          <dd className="font-semibold tabular-nums text-ink">
                            {formatQuotationAmount(actionVersion.total_amount, t)} {t('mmk')}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-gray-500">{t('payment')}</dt>
                          <dd className="font-medium text-ink">{t('cashOnDelivery')}</dd>
                        </div>
                      </dl>

                      <div className="mt-3 rounded border border-rule bg-gray-50 px-3 py-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          {t('codTerms')}
                        </p>
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
                      className="mt-4 rounded-lg border border-rule bg-plate p-4"
                      aria-labelledby="reject-panel-title"
                    >
                      <h4 id="reject-panel-title" className="text-base font-semibold text-ink">
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
                      className="mt-4 rounded-lg border border-rule bg-plate p-4"
                      aria-labelledby="change-panel-title"
                    >
                      <h4 id="change-panel-title" className="text-base font-semibold text-ink">
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
                </section>
              ) : null}
            </article>
          ) : null}
        </>
      )}
    </div>
  );
}
