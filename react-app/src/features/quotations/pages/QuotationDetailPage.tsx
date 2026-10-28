/**
 * Quotation detail and customer decisions (Task 08).
 *
 * Shows the request-time contact/delivery snapshots, the current Final
 * Quotation version with immutable item and money snapshots, version history,
 * and the three customer decisions allowed by LogicFlow §8: accept, reject or
 * request a change. Only the current, unexpired SENT/VIEWED version can be
 * acted on; the server returns `can_*` flags so this page never re-implements
 * the expiry/current rules.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  FiArrowLeft,
  FiCheck,
  FiClock,
  FiEdit3,
  FiFileText,
  FiLock,
  FiTruck,
} from 'react-icons/fi';
import {
  acceptQuotation,
  getQuotationRequest,
  rejectQuotation,
  requestQuotationChange,
  type CustomerQuotationDetail,
  type QuotationVersion,
  type QuotationVersionItem,
} from '../api/quotationsApi';
import {
  Alert,
  EmptyState,
  LoadingPanel,
  PageHeader,
  StatusBadge,
  dangerLinkClass,
  describeCustomerLoadError,
  describeCustomerRequestError,
  formatStatusLabel,
  linkClass,
  primaryButtonClass,
  secondaryButtonClass,
  textareaClass,
  type LoadErrorState,
} from '../../../components/catalog-ui/CatalogUi';
import { formatMMK } from '../../../lib/money';

type Panel = 'accept' | 'reject' | 'change';
type PendingAction = Panel | null;

function formatDateOnly(value: string): string {
  const [year, month, day] = value.split('-').map(Number);

  if (!year || !month || !day) return value;

  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(value: string | null): string {
  return value ? new Date(value).toLocaleString() : '—';
}

function paymentMethodLabel(value: string): string {
  return value === 'CASH_ON_DELIVERY' ? 'Cash on delivery' : formatStatusLabel(value);
}

function ActionPrompt({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-md border border-rule bg-paper p-3">
      <p className="text-sm font-semibold text-ink">{title}</p>
      {children}
    </div>
  );
}

function ItemRow({ item }: { item: QuotationVersionItem }) {
  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{item.product_name_snapshot}</p>
          <p className="mt-0.5 text-xs text-gray-500">
            {item.sku_snapshot ? `${item.sku_snapshot} · ` : ''}
            {item.supplier?.shop_name ?? 'Supplier confirmed on quotation'}
          </p>
          {item.specification_snapshot ? (
            <p className="mt-1 text-xs text-gray-600">{item.specification_snapshot}</p>
          ) : null}
          {item.delivery_date || item.warranty_note ? (
            <p className="mt-1 text-xs text-gray-500">
              {item.delivery_date ? `Delivery ${formatDateOnly(item.delivery_date)}` : null}
              {item.delivery_date && item.warranty_note ? ' · ' : null}
              {item.warranty_note}
            </p>
          ) : null}
        </div>

        <div className="flex-none text-left sm:text-right">
          <p className="font-mono text-sm tabular-nums text-ink">
            {formatMMK(item.line_total)} MMK
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            {item.quantity} × {formatMMK(item.unit_price)} MMK
          </p>
          {item.discount > 0 ? (
            <p className="text-xs text-green-700">−{formatMMK(item.discount)} MMK line discount</p>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function QuotationSheet({
  quotation,
  expired,
}: {
  quotation: QuotationVersion;
  expired: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-rule bg-plate" aria-label="Final quotation">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-rule p-4">
        <div>
          <p className="text-xs font-medium text-gray-500">
            Version {quotation.version}
            {quotation.is_current ? ' · current' : ''}
          </p>
          <h2 className="mt-0.5 text-lg font-semibold tracking-tight text-ink">
            Final quotation
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            {quotation.quotation_number} · sent {formatDateTime(quotation.sent_at)}
          </p>
        </div>
        <div className="text-left sm:text-right">
          <StatusBadge status={quotation.status} />
          <p className={`mt-2 text-sm ${expired ? 'font-medium text-red-700' : 'text-gray-600'}`}>
            {quotation.valid_until
              ? `${expired ? 'Expired' : 'Valid until'} ${formatDateOnly(quotation.valid_until)}`
              : 'No validity date'}
          </p>
        </div>
      </header>

      <ul className="divide-y divide-rule px-4">
        {quotation.items.map((item) => (
          <ItemRow key={item.id} item={item} />
        ))}
      </ul>

      <div className="border-t border-rule bg-paper px-4 py-4">
        <dl className="ml-auto max-w-sm space-y-1.5 text-sm">
          <div className="flex justify-between gap-6">
            <dt className="text-gray-600">Subtotal</dt>
            <dd className="font-mono tabular-nums text-ink">{formatMMK(quotation.subtotal)} MMK</dd>
          </div>
          {quotation.discount > 0 ? (
            <div className="flex justify-between gap-6">
              <dt className="text-gray-600">Discount</dt>
              <dd className="font-mono tabular-nums text-green-700">
                −{formatMMK(quotation.discount)} MMK
              </dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-6">
            <dt className="text-gray-600">Delivery fee</dt>
            <dd className="font-mono tabular-nums text-ink">
              {formatMMK(quotation.delivery_fee)} MMK
            </dd>
          </div>
          <div className="flex justify-between gap-6">
            <dt className="text-gray-600">
              Service fee ({quotation.service_fee_percentage}%)
            </dt>
            <dd className="font-mono tabular-nums text-ink">{formatMMK(quotation.service_fee)} MMK</dd>
          </div>
          <div className="flex justify-between gap-6 border-t border-rule pt-2">
            <dt className="font-semibold text-ink">Total</dt>
            <dd className="font-mono text-base font-semibold tabular-nums text-ink">
              {formatMMK(quotation.total_amount)} MMK
            </dd>
          </div>
        </dl>
      </div>

      <div className="space-y-3 border-t border-rule px-4 py-4 text-sm">
        <p className="flex items-start gap-2 text-gray-700">
          <FiTruck aria-hidden="true" className="mt-0.5 h-4 w-4 flex-none text-gray-400" />
          <span>
            <span className="font-medium text-ink">{paymentMethodLabel(quotation.payment_method)}</span>
            {' — '}
            {quotation.payment_terms}
          </span>
        </p>
        {quotation.admin_note ? (
          <p className="flex items-start gap-2 text-gray-700">
            <FiFileText aria-hidden="true" className="mt-0.5 h-4 w-4 flex-none text-gray-400" />
            <span className="whitespace-pre-line">{quotation.admin_note}</span>
          </p>
        ) : null}
      </div>
    </section>
  );
}

export default function QuotationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const quotationRequestId = Number(id);

  const [detail, setDetail] = useState<CustomerQuotationDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<LoadErrorState | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [panel, setPanel] = useState<Panel | null>(null);
  const [note, setNote] = useState('');
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [createdOrder, setCreatedOrder] = useState<{ id: number; order_number: string } | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!Number.isInteger(quotationRequestId) || quotationRequestId <= 0) {
      setLoadError({ message: 'This quotation link is not valid.', needsLogin: false });
      setIsLoading(false);
      return;
    }

    const load = async () => {
      setIsLoading(true);
      setLoadError(null);

      const response = await getQuotationRequest(quotationRequestId);

      if (cancelled) return;

      if (response.success && response.data) {
        setDetail(response.data.quotation_request);
      } else {
        setLoadError(describeCustomerLoadError(response, 'this quotation'));
      }

      setIsLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [quotationRequestId, reloadToken]);

  const current = detail?.current_quotation ?? null;
  const openDecision = (next: Panel) => {
    setPanel(next);
    setActionError(null);
    setNotice(null);
    setCreatedOrder(null);
    setNote('');
  };

  const closeDecision = () => {
    setPanel(null);
    setActionError(null);
    setNote('');
  };

  const runDecision = async (action: Panel) => {
    if (!current) return;

    setActionError(null);
    setNotice(null);
    setPendingAction(action);

    let response: Awaited<ReturnType<typeof acceptQuotation>>;

    if (action === 'accept') {
      response = await acceptQuotation(current.id);
    } else if (action === 'reject') {
      response = await rejectQuotation(current.id, note);
    } else {
      if (note.trim().length < 5) {
        setActionError('Add a note with at least 5 characters so the supplier team knows what to change.');
        setPendingAction(null);
        return;
      }

      response = await requestQuotationChange(current.id, note.trim());
    }

    if (response.success) {
      setPanel(null);
      setNote('');
      setCreatedOrder(action === 'accept' ? (response.data?.order ?? null) : null);
      setNotice(
        action === 'accept'
          ? 'Quotation accepted. Your order has been created and we have recorded your confirmation.'
          : action === 'reject'
            ? 'Quotation rejected. The supplier team has been notified.'
            : 'Change request sent. The supplier team will prepare a revised quotation.',
      );
      setReloadToken((token) => token + 1);
    } else {
      setActionError(
        describeCustomerRequestError(
          response,
          action === 'accept'
            ? 'Could not accept this quotation.'
            : action === 'reject'
              ? 'Could not reject this quotation.'
              : 'Could not send the change request.',
        ),
      );
    }

    setPendingAction(null);
  };

  if (isLoading && detail === null) {
    return (
      <div className="space-y-6">
        <PageHeader title="Quotation detail" />
        <LoadingPanel label="Loading quotation…" />
      </div>
    );
  }

  if (loadError && detail === null) {
    return (
      <div className="space-y-6">
        <PageHeader title="Quotation detail" />
        <Alert tone="error">
          <p className="font-semibold">This quotation is unavailable</p>
          <p className="mt-1">{loadError.message}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setReloadToken((token) => token + 1)}
              className={primaryButtonClass}
            >
              Try again
            </button>
            {loadError.needsLogin ? (
              <Link to="/login" className={linkClass}>
                Go to login
              </Link>
            ) : null}
            <Link to="/quotations" className={linkClass}>
              Back to my quotations
            </Link>
          </div>
        </Alert>
      </div>
    );
  }

  if (detail === null) {
    return null;
  }

  const actionable = detail.can_accept || detail.can_reject || detail.can_request_change;
  const submittedAt = formatDateTime(detail.created_at);

  return (
    <div className="space-y-6">
      <Link to="/quotations" className={linkClass}>
        <FiArrowLeft aria-hidden="true" className="h-4 w-4" />
        My quotations
      </Link>

      <PageHeader
        title={`Quotation ${detail.quotation_number}`}
        description={`Submitted ${submittedAt}`}
        action={<StatusBadge status={detail.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {current ? (
            <QuotationSheet quotation={current} expired={detail.is_expired} />
          ) : (
            <div className="space-y-4">
              <EmptyState
                title="Your quotation is being prepared"
                hint="The supplier team is confirming stock, prices and delivery. Your final quotation will appear here."
              />
              {detail.items.length > 0 ? (
                <section className="rounded-lg border border-rule bg-plate p-4">
                  <h2 className="text-sm font-semibold text-ink">What you requested</h2>
                  <ul className="mt-3 divide-y divide-rule">
                    {detail.items.map((item) => (
                      <li
                        key={`${item.product_id}-${item.product_name_snapshot}`}
                        className="flex items-start justify-between gap-4 py-2 first:pt-0 last:pb-0"
                      >
                        <div className="min-w-0">
                          <p className="text-sm text-ink">{item.product_name_snapshot}</p>
                          <p className="text-xs text-gray-500">
                            {item.quantity} × {formatMMK(item.display_price)} MMK display price
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-xs text-gray-500">
                    Display prices are not final; the supplier confirms them in the quotation.
                  </p>
                </section>
              ) : null}
            </div>
          )}

          {detail.quotation_history.length > 0 ? (
            <section className="rounded-lg border border-rule bg-plate" aria-label="Quotation versions">
              <header className="border-b border-rule px-4 py-3">
                <h2 className="text-sm font-semibold text-ink">Version history</h2>
              </header>
              <ul className="divide-y divide-rule">
                {detail.quotation_history.map((version) => (
                  <li
                    key={version.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-ink">Version {version.version}</span>
                      <StatusBadge status={version.status} />
                      {version.is_current ? (
                        <span className="text-xs font-medium text-accent">Current</span>
                      ) : null}
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="font-mono text-sm tabular-nums text-ink">
                        {formatMMK(version.total_amount)} MMK
                      </p>
                      <p className="text-xs text-gray-500">
                        {version.valid_until
                          ? `Valid until ${formatDateOnly(version.valid_until)}`
                          : 'No validity date'}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="rounded-lg border border-rule bg-plate p-4" aria-label="Request details">
            <h2 className="text-sm font-semibold text-ink">Request details</h2>
            <dl className="mt-3 grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-gray-500">Contact</dt>
                <dd className="mt-0.5 text-ink">
                  {detail.customer_name}
                  {detail.company_name ? ` · ${detail.company_name}` : ''}
                </dd>
                <dd className="text-gray-600">{detail.phone}</dd>
                {detail.email ? <dd className="text-gray-600">{detail.email}</dd> : null}
              </div>
              <div>
                <dt className="text-gray-500">Delivery address</dt>
                <dd className="mt-0.5 text-ink">{detail.delivery_address}</dd>
                <dd className="text-gray-600">
                  {detail.city}
                  {detail.township ? `, ${detail.township}` : ''}
                </dd>
                {detail.landmark ? <dd className="text-gray-600">{detail.landmark}</dd> : null}
              </div>
              {detail.required_delivery_date ? (
                <div>
                  <dt className="text-gray-500">Requested delivery date</dt>
                  <dd className="mt-0.5 text-ink">
                    {formatDateOnly(detail.required_delivery_date)}
                  </dd>
                </div>
              ) : null}
              {detail.customer_note ? (
                <div className="sm:col-span-2">
                  <dt className="text-gray-500">Your note</dt>
                  <dd className="mt-0.5 whitespace-pre-line text-ink">{detail.customer_note}</dd>
                </div>
              ) : null}
            </dl>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          {isLoading ? (
            <p className="text-xs text-gray-500" role="status" aria-live="polite">
              Refreshing quotation…
            </p>
          ) : null}

          {loadError ? (
            <Alert tone="warning">
              <p>{loadError.message}</p>
              <button
                type="button"
                onClick={() => setReloadToken((token) => token + 1)}
                className={`${secondaryButtonClass} mt-2`}
              >
                Reload quotation
              </button>
            </Alert>
          ) : null}

          {notice ? (
            <Alert tone="success">
              <div>
                <p>{notice}</p>
                {createdOrder ? (
                  <Link
                    to={`/orders/${createdOrder.id}`}
                    className={`${linkClass} mt-2`}
                  >
                    View order {createdOrder.order_number} →
                  </Link>
                ) : null}
              </div>
            </Alert>
          ) : null}

          {actionError ? (
            <Alert tone="error">
              <p>{actionError}</p>
            </Alert>
          ) : null}

          {actionable ? (
            <section className="rounded-lg border border-rule bg-plate p-4" aria-label="Your decision">
              <h2 className="text-sm font-semibold text-ink">Your decision</h2>
              <p className="mt-1 text-sm text-gray-600">
                Accepting confirms the quoted prices, delivery and cash-on-delivery terms.
              </p>

              {panel === null ? (
                <div className="mt-4 space-y-2">
                  <button
                    type="button"
                    onClick={() => openDecision('accept')}
                    className={`${primaryButtonClass} w-full`}
                  >
                    <FiCheck aria-hidden="true" className="mr-1.5 h-4 w-4" />
                    Accept quotation
                  </button>
                  <button
                    type="button"
                    onClick={() => openDecision('change')}
                    className={`${secondaryButtonClass} w-full`}
                  >
                    <FiEdit3 aria-hidden="true" className="mr-1.5 h-4 w-4" />
                    Request a change
                  </button>
                  <button
                    type="button"
                    onClick={() => openDecision('reject')}
                    className={`${dangerLinkClass} w-full px-2 py-2 text-left`}
                  >
                    Reject quotation
                  </button>
                </div>
              ) : null}

              {panel === 'accept' ? (
                <div className="mt-4">
                  <ActionPrompt title="Accept this quotation?">
                    <p className="mt-1 text-sm text-gray-600">
                      This records your confirmation and prepares the order hand-off. You cannot
                      undo an accepted quotation.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void runDecision('accept')}
                        disabled={pendingAction !== null}
                        className={primaryButtonClass}
                      >
                        {pendingAction === 'accept' ? 'Accepting…' : 'Confirm acceptance'}
                      </button>
                      <button
                        type="button"
                        onClick={closeDecision}
                        disabled={pendingAction !== null}
                        className={secondaryButtonClass}
                      >
                        Cancel
                      </button>
                    </div>
                  </ActionPrompt>
                </div>
              ) : null}

              {panel === 'reject' ? (
                <form
                  className="mt-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void runDecision('reject');
                  }}
                >
                  <ActionPrompt title="Reject this quotation?">
                    <label htmlFor="reject-note" className="mt-2 block text-sm text-gray-700">
                      Reason (optional)
                    </label>
                    <textarea
                      id="reject-note"
                      rows={3}
                      maxLength={2000}
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      className={`${textareaClass} mt-1`}
                      placeholder="Tell the supplier team why this quotation does not work."
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="submit"
                        disabled={pendingAction !== null}
                        className={primaryButtonClass}
                      >
                        {pendingAction === 'reject' ? 'Rejecting…' : 'Confirm rejection'}
                      </button>
                      <button
                        type="button"
                        onClick={closeDecision}
                        disabled={pendingAction !== null}
                        className={secondaryButtonClass}
                      >
                        Cancel
                      </button>
                    </div>
                  </ActionPrompt>
                </form>
              ) : null}

              {panel === 'change' ? (
                <form
                  className="mt-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void runDecision('change');
                  }}
                >
                  <ActionPrompt title="What should change?">
                    <label htmlFor="change-note" className="mt-2 block text-sm text-gray-700">
                      Change request <span className="text-red-600">*</span>
                    </label>
                    <textarea
                      id="change-note"
                      rows={4}
                      required
                      minLength={5}
                      maxLength={2000}
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      aria-describedby="change-note-hint"
                      className={`${textareaClass} mt-1`}
                      placeholder="For example: reduce the delivery fee, change the quantity, or confirm the delivery date."
                    />
                    <p id="change-note-hint" className="mt-1 text-xs text-gray-500">
                      At least 5 characters. This note goes to the supplier team with your request.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="submit"
                        disabled={pendingAction !== null}
                        className={primaryButtonClass}
                      >
                        {pendingAction === 'change' ? 'Sending…' : 'Send change request'}
                      </button>
                      <button
                        type="button"
                        onClick={closeDecision}
                        disabled={pendingAction !== null}
                        className={secondaryButtonClass}
                      >
                        Cancel
                      </button>
                    </div>
                  </ActionPrompt>
                </form>
              ) : null}
            </section>
          ) : (
            <section className="rounded-lg border border-rule bg-plate p-4" aria-label="Quotation status">
              <h2 className="text-sm font-semibold text-ink">
                {detail.is_expired
                  ? 'This quotation has expired'
                  : current
                    ? formatStatusLabel(current.status)
                    : 'Quotation in progress'}
              </h2>
              <p className="mt-1 text-sm text-gray-600">{decisionExplanation(detail)}</p>
            </section>
          )}

          {detail.actions.length > 0 ? (
            <section className="rounded-lg border border-rule bg-plate p-4" aria-label="Your activity">
              <h2 className="text-sm font-semibold text-ink">Your activity</h2>
              <ul className="mt-2 space-y-2 text-sm">
                {detail.actions.map((action) => (
                  <li key={action.id}>
                    <p className="flex items-center gap-1.5 text-ink">
                      <FiClock aria-hidden="true" className="h-3.5 w-3.5 text-gray-400" />
                      {formatStatusLabel(action.action)}
                      <span className="text-xs text-gray-500">
                        {formatDateTime(action.created_at)}
                      </span>
                    </p>
                    {action.customer_note ? (
                      <p className="mt-0.5 pl-5 text-xs text-gray-600">{action.customer_note}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {current ? (
            <div className="flex items-start gap-2 rounded-md border border-rule bg-paper p-3 text-xs text-gray-600">
              <FiLock aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 flex-none text-gray-400" />
              Quotation links are private to your account. There is no token or email-link access.
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

/** Plain-language explanation for the non-actionable state. */
function decisionExplanation(detail: CustomerQuotationDetail): string {
  const current = detail.current_quotation;

  if (!current) {
    return 'The supplier team is confirming stock, prices and delivery. You will see the final quotation here once it is sent.';
  }

  if (detail.is_expired) {
    return current.valid_until
      ? `This quotation was valid until ${formatDateOnly(current.valid_until)}. Ask the supplier team for a new quotation if you still need these items.`
      : 'This quotation is no longer valid. Ask the supplier team for a new quotation.';
  }

  switch (current.status) {
    case 'ACCEPTED':
      return 'You accepted this quotation. The order hand-off is the next step.';
    case 'REJECTED':
      return 'You rejected this quotation. No order will be created from it.';
    case 'CHANGE_REQUESTED':
      return 'Your change request is with the supplier team. They will prepare a revised quotation.';
    case 'SUPERSEDED':
      return 'A newer quotation version replaced this one. Open the current version to review it.';
    case 'CANCELLED':
      return 'This quotation was cancelled.';
    default:
      return 'This quotation cannot be accepted right now. Check the status or contact the supplier team.';
  }
}
