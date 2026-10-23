/**
 * Admin order detail and supplier confirmation (Task 09).
 *
 * The server owns the transition table. Buttons come only from
 * `available_statuses`; every successful PATCH reloads the detail so the next
 * allowed actions, statuses, and history are canonical. Delivery and cash
 * collection are read-only here — Task 10 owns those actions.
 */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Field,
  LoadingPanel,
  PageHeader,
  describeLoadError,
  describeRequestError,
  formatStatusLabel,
  inputClass,
  joinIds,
  linkClass,
  primaryButtonClass,
  secondaryButtonClass,
  type LoadErrorState,
} from '../../../components/catalog-ui/CatalogUi';
import { formatMMK } from '../../../lib/money';
import {
  getAdminOrder,
  updateAdminOrderStatus,
  type AdminOrderDetail,
} from '../api/ordersApi';
import OrderStatusBadge from '../components/OrderStatusBadge';
import {
  ORDER_NOTE_MAX_LENGTH,
  buildOrderStatusPayload,
  formatOrderDate,
  formatOrderDateTime,
  orderActionButtons,
  orderActionIsDestructive,
  orderActionReasonLabel,
  orderActionRequiresNote,
  orderHistoryActorLabel,
  orderStatusLabel,
  orderStatusTransitionLabel,
  type OrderStatusAction,
} from '../lib/orderStatus';

const dangerButtonClass =
  'inline-flex items-center justify-center rounded-md border border-transparent bg-red-700 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-red-800 active:scale-[.99] focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 motion-safe:transition-colors disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100';

function actionGuidance(status: string): string {
  switch (status) {
    case 'ORDER_CONFIRMED':
      return 'Record this after the supplier confirms the products, quantities, and delivery date. The order can then move into preparation.';
    case 'PREPARING':
      return 'Use this only after the order is confirmed. Delivery and cash status stay unchanged in this step.';
    case 'SUPPLIER_UNAVAILABLE':
      return 'This ends supplier confirmation for the order. Contact the customer about a revised quotation or cancellation.';
    case 'CANCELLED':
      return 'Cancelling is final in this workflow. The order cannot be reopened from this screen; a new order needs a new accepted quotation.';
    default:
      return 'This records the next step in the order workflow.';
  }
}

function deliverySummary(order: AdminOrderDetail): string {
  return [
    order.delivery_address,
    order.city,
    order.township,
    order.landmark ? `Near ${order.landmark}` : null,
  ]
    .filter((part): part is string => Boolean(part))
    .join(', ');
}

export default function OrderDetailPage() {
  const { id: idParam } = useParams<{ id: string }>();
  const id = Number(idParam);
  const navigate = useNavigate();

  const [order, setOrder] = useState<AdminOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<LoadErrorState | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [panel, setPanel] = useState<OrderStatusAction | null>(null);
  const [note, setNote] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionFieldErrors, setActionFieldErrors] = useState<Record<string, string[]>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);

  const loadedIdRef = useRef<number | null>(null);
  const panelRef = useRef<HTMLFormElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!Number.isInteger(id) || id <= 0) {
      setLoading(false);
      setLoadError({ message: 'That order number is not valid.', needsLogin: false });
      return;
    }

    const load = async () => {
      if (loadedIdRef.current === id) {
        setRefreshing(true);
      } else {
        setLoading(true);
        setOrder(null);
        setPanel(null);
        setNotice(null);
        setConflict(null);
        setActionError(null);
        setActionFieldErrors({});
        setNote('');
      }

      setLoadError(null);
      const response = await getAdminOrder(id);

      if (cancelled) return;

      if (response.success && response.data) {
        loadedIdRef.current = id;
        setOrder(response.data.order);
      } else if (response.status === 401) {
        navigate('/admin/login', { replace: true });
        return;
      } else {
        setOrder(null);
        setLoadError(describeLoadError(response, 'this order'));
      }

      setLoading(false);
      setRefreshing(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [id, reloadToken, navigate]);

  // Focus moves into the confirmation panel on open; closing returns to the
  // button that opened it so keyboard users keep their place.
  useEffect(() => {
    if (!panel) return;
    panelRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
  }, [panel]);

  const refresh = () => setReloadToken((token) => token + 1);

  const openPanel = (action: OrderStatusAction, trigger: HTMLButtonElement) => {
    triggerRef.current = trigger;
    setPanel(action);
    setNote('');
    setActionError(null);
    setActionFieldErrors({});
    setNotice(null);
    setConflict(null);
  };

  const closePanel = () => {
    setPanel(null);
    setNote('');
    setActionError(null);
    setActionFieldErrors({});
    triggerRef.current?.focus();
  };

  const submitAction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!order || !panel || actionBusy) return;

    setActionError(null);
    setActionFieldErrors({});
    const built = buildOrderStatusPayload(panel.status, note);
    if (!built.ok || !built.payload) {
      setActionFieldErrors(built.fieldErrors);
      return;
    }

    setActionBusy(true);
    const response = await updateAdminOrderStatus(order.id, {
      status: panel.status,
      note: built.payload.note,
    });
    setActionBusy(false);

    if (!response.success) {
      if (response.status === 401) {
        navigate('/admin/login', { replace: true });
        return;
      }

      if (response.status === 409) {
        setPanel(null);
        setActionFieldErrors({});
        setActionError(null);
        setConflict(
          response.message ??
            'This order changed while you were working on it. The latest state has been loaded.',
        );
        refresh();
        return;
      }

      if (response.status === 422) {
        setActionFieldErrors(response.errors ?? {});
        setActionError(response.message ?? 'Check the reason and try again.');
        return;
      }

      setActionError(describeRequestError(response, 'The order status could not be updated.'));
      return;
    }

    setNotice(`${panel.label} recorded. Order moved to ${orderStatusLabel(panel.status)}.`);
    setPanel(null);
    setNote('');
    refresh();
  };

  if (loading && !order) {
    return (
      <div className="space-y-6">
        <PageHeader title="Order" />
        <LoadingPanel label="Loading order" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Order"
          action={
            <Link to="/admin/orders" className={secondaryButtonClass}>
              Back to orders
            </Link>
          }
        />
        <Alert tone="error">
          <p>{loadError?.message ?? 'The order could not be loaded.'}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {loadError?.needsLogin ? (
              <Link to="/admin/login" className={linkClass}>
                Sign in again
              </Link>
            ) : (
              <button type="button" onClick={refresh} className={secondaryButtonClass}>
                Try again
              </button>
            )}
            <Link to="/admin/orders" className={secondaryButtonClass}>
              Back to orders
            </Link>
          </div>
        </Alert>
      </div>
    );
  }

  const actions = orderActionButtons(order.available_statuses);
  const requiresNote = panel ? orderActionRequiresNote(panel.status) : false;
  const noteError = actionFieldErrors.note?.[0] ?? null;
  const statusError = actionFieldErrors.status?.[0] ?? null;
  const deliverTo = deliverySummary(order);
  const isClosed =
    order.order_status === 'SUPPLIER_UNAVAILABLE' || order.order_status === 'CANCELLED';

  return (
    <div className="space-y-6" aria-busy={refreshing || actionBusy || undefined}>
      <PageHeader
        title={order.order_number}
        description={`Created ${formatOrderDateTime(order.created_at)} · Quotation ${order.quotation_number}`}
        action={
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <div className="flex flex-wrap items-center gap-2">
              <OrderStatusBadge status={order.order_status} />
              <OrderStatusBadge kind="payment" status={order.payment_status} />
              <OrderStatusBadge kind="delivery" status={order.delivery_status} />
            </div>
            <Link to="/admin/orders" className={linkClass}>
              Back to orders
            </Link>
          </div>
        }
      />

      {refreshing ? (
        <p className="text-xs text-gray-500" aria-live="polite">
          Refreshing order…
        </p>
      ) : null}

      {conflict ? <Alert tone="warning">{conflict}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}
      {actionError ? <Alert tone="error">{actionError}</Alert> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <section
          className="rounded-lg border border-rule bg-plate p-4 sm:p-6 lg:col-span-2"
          aria-label="Customer and delivery snapshot"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-ink">Customer &amp; delivery</h2>
              <p className="mt-1 text-sm text-gray-600">
                Snapshot copied from the accepted quotation; later profile edits do not change it.
              </p>
            </div>
            <p className="text-xs text-gray-500">
              {order.items.length} {order.items.length === 1 ? 'item' : 'items'}
            </p>
          </div>

          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Customer
              </dt>
              <dd className="mt-1 font-medium text-ink">{order.customer_name}</dd>
              {order.company_name ? (
                <dd className="text-gray-600">{order.company_name}</dd>
              ) : null}
              <dd className="mt-1 text-gray-700">{order.phone}</dd>
              <dd className="break-all text-gray-600">{order.email ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Deliver to
              </dt>
              <dd className="mt-1 whitespace-pre-line text-gray-800">{deliverTo || '—'}</dd>
            </div>
            {order.customer_note ? (
              <div className="sm:col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Customer note
                </dt>
                <dd className="mt-1 whitespace-pre-line rounded bg-gray-50 px-3 py-2 text-gray-700">
                  {order.customer_note}
                </dd>
              </div>
            ) : null}
          </dl>
        </section>

        <div className="space-y-4">
          <section
            className="rounded-lg border border-rule bg-plate p-4 lg:sticky lg:top-24"
            aria-label="Supplier confirmation"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-ink">Supplier confirmation</h2>
                <p className="mt-1 text-xs text-gray-600">
                  Actions are limited to what the server currently allows.
                </p>
              </div>
              <OrderStatusBadge status={order.order_status} />
            </div>

            {actions.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {actions.map((action) => (
                  <button
                    key={action.status}
                    type="button"
                    disabled={actionBusy}
                    onClick={(event) => openPanel(action, event.currentTarget)}
                    className={
                      action.destructive
                        ? dangerButtonClass
                        : action.status === 'ORDER_CONFIRMED'
                          ? primaryButtonClass
                          : secondaryButtonClass
                    }
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded border border-dashed border-rule px-3 py-2 text-sm text-gray-600">
                {isClosed
                  ? `This order is closed as ${orderStatusLabel(order.order_status)}. No further supplier-confirmation action is available here.`
                  : `No supplier-confirmation action is available at ${orderStatusLabel(
                      order.order_status,
                    )}.`}
              </p>
            )}

            {panel ? (
              <form
                ref={panelRef}
                onSubmit={submitAction}
                className="mt-4 rounded-lg border border-rule bg-gray-50/70 p-4"
                aria-labelledby="order-action-panel-title"
              >
                <h3 id="order-action-panel-title" className="text-base font-semibold text-ink">
                  {panel.label}
                </h3>
                <p className="mt-1 text-sm text-gray-600">{actionGuidance(panel.status)}</p>

                {orderActionIsDestructive(panel.status) ? (
                  <Alert tone="warning" className="mt-3">
                    {panel.status === 'CANCELLED'
                      ? 'This is final for this order. The customer will see the cancellation and the reason in the order history.'
                      : 'This ends supplier confirmation. The customer still needs a revised quotation or an agreed cancellation.'}
                  </Alert>
                ) : null}

                {statusError ? (
                  <p role="alert" className="mt-3 text-sm text-red-600">
                    {statusError}
                  </p>
                ) : null}

                <div className="mt-3">
                  <Field
                    label={orderActionReasonLabel(panel.status)}
                    htmlFor="order-action-note"
                    required={requiresNote}
                    error={noteError ? [noteError] : null}
                    hint={`${requiresNote ? 'Required · ' : 'Optional · '}${note.length.toLocaleString(
                      'en-US',
                    )} / ${ORDER_NOTE_MAX_LENGTH.toLocaleString('en-US')} characters`}
                    hintId="order-action-note-hint"
                  >
                    <textarea
                      id="order-action-note"
                      data-autofocus
                      rows={4}
                      maxLength={ORDER_NOTE_MAX_LENGTH}
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      disabled={actionBusy}
                      aria-invalid={Boolean(noteError) || undefined}
                      aria-describedby={joinIds(
                        'order-action-note-hint',
                        noteError ? 'order-action-note-error' : null,
                      )}
                      className={inputClass(Boolean(noteError))}
                    />
                  </Field>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={actionBusy}
                    className={
                      orderActionIsDestructive(panel.status)
                        ? dangerButtonClass
                        : primaryButtonClass
                    }
                  >
                    {actionBusy ? 'Saving…' : panel.label}
                  </button>
                  <button
                    type="button"
                    onClick={closePanel}
                    disabled={actionBusy}
                    className={secondaryButtonClass}
                  >
                    Keep order as is
                  </button>
                </div>
              </form>
            ) : null}
          </section>

          <section
            className="rounded-lg border border-rule bg-plate p-4"
            aria-label="Related quotation request"
          >
            <h2 className="text-base font-semibold text-ink">Quotation request</h2>
            <p className="mt-1 text-sm text-gray-600">
              {order.quotation_request.quotation_number} ·{' '}
              {formatStatusLabel(order.quotation_request.status)}
            </p>
            <p className="mt-2 text-xs text-gray-500">
              Log supplier calls and messages on the request before recording the supplier's
              answer here.
            </p>
            <Link
              to={`/admin/quotation-requests/${order.quotation_request.id}`}
              className={`${linkClass} mt-3`}
            >
              Open quotation request
            </Link>
          </section>
        </div>
      </div>

      <section
        className="overflow-hidden rounded-lg border border-rule bg-plate"
        aria-label="Order items and totals"
      >
        <div className="border-b border-rule px-4 py-3">
          <h2 className="text-base font-semibold text-ink">Items</h2>
          <p className="mt-1 text-xs text-gray-500">
            Immutable snapshots copied from the accepted quotation version.
          </p>
        </div>

        {order.items.length === 0 ? (
          <p className="px-4 py-4 text-sm text-gray-500">No order items are attached.</p>
        ) : (
          <div className="overflow-x-auto border-b border-rule">
            <table className="min-w-full divide-y divide-rule text-sm">
              <caption className="sr-only">Items in order {order.order_number}</caption>
              <thead className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th scope="col" className="px-4 py-2">
                    Item
                  </th>
                  <th scope="col" className="px-4 py-2">
                    Qty
                  </th>
                  <th scope="col" className="px-4 py-2 text-right">
                    Unit price
                  </th>
                  <th scope="col" className="px-4 py-2 text-right">
                    Discount
                  </th>
                  <th scope="col" className="px-4 py-2 text-right">
                    Line total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <th scope="row" className="px-4 py-2 text-left font-normal">
                      <p className="font-medium text-ink">{item.product_name_snapshot}</p>
                      <p className="text-xs text-gray-500">
                        {[item.sku_snapshot, item.specification_snapshot, item.supplier?.shop_name]
                          .filter(Boolean)
                          .join(' · ') || '—'}
                      </p>
                    </th>
                    <td className="px-4 py-2 tabular-nums text-gray-700">{item.quantity}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-gray-700">
                      {formatMMK(item.unit_price)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-gray-700">
                      {formatMMK(item.discount)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums font-medium text-ink">
                      {formatMMK(item.line_total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <dl className="grid gap-3 px-4 py-4 text-sm sm:grid-cols-3 lg:grid-cols-5">
          <div>
            <dt className="text-xs text-gray-500">Subtotal</dt>
            <dd className="mt-0.5 font-medium tabular-nums text-ink">
              {formatMMK(order.subtotal)} MMK
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Discount</dt>
            <dd className="mt-0.5 font-medium tabular-nums text-ink">
              {formatMMK(order.discount)} MMK
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Delivery fee</dt>
            <dd className="mt-0.5 font-medium tabular-nums text-ink">
              {formatMMK(order.delivery_fee)} MMK
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">
              Service fee ({order.service_fee_percentage}%)
            </dt>
            <dd className="mt-0.5 font-medium tabular-nums text-ink">
              {formatMMK(order.service_fee)} MMK
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Total</dt>
            <dd className="mt-0.5 font-semibold tabular-nums text-ink">
              {formatMMK(order.total_amount)} MMK
            </dd>
          </div>
        </dl>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section
          className="rounded-lg border border-rule bg-plate p-4"
          aria-label="Cash on delivery summary"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-ink">Cash on delivery</h2>
              <p className="mt-1 text-xs text-gray-600">
                {formatStatusLabel(order.payment_method)} · full cash payment only
              </p>
            </div>
            <OrderStatusBadge kind="payment" status={order.payment_status} />
          </div>

          <p className="mt-3 text-sm text-gray-600">
            This summary is read-only in the supplier-confirmation step. Cash collection and
            receipt confirmation are handled during delivery.
          </p>

          {order.cash_payment ? (
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-gray-500">Receipt</dt>
                <dd className="mt-0.5 font-medium text-ink">
                  {order.cash_payment.receipt_number ?? 'Not issued yet'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Record status</dt>
                <dd className="mt-0.5">
                  <OrderStatusBadge kind="payment" status={order.cash_payment.status} />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Amount due</dt>
                <dd className="mt-0.5 font-medium tabular-nums text-ink">
                  {formatMMK(order.cash_payment.amount_due)} MMK
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Collected</dt>
                <dd className="mt-0.5 font-medium tabular-nums text-ink">
                  {formatMMK(order.cash_payment.amount_collected)} MMK
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Remaining</dt>
                <dd className="mt-0.5 font-medium tabular-nums text-ink">
                  {formatMMK(order.cash_payment.amount_remaining)} MMK
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Collected at</dt>
                <dd className="mt-0.5 text-gray-700">
                  {order.cash_payment.collected_at
                    ? formatOrderDateTime(order.cash_payment.collected_at)
                    : '—'}
                </dd>
              </div>
            </dl>
          ) : (
            <Alert tone="warning" className="mt-4">
              No cash payment record is linked to this order yet.
            </Alert>
          )}
        </section>

        <section
          className="rounded-lg border border-rule bg-plate p-4"
          aria-label="Order status history"
        >
          <h2 className="text-base font-semibold text-ink">Status history</h2>
          <p className="mt-1 text-xs text-gray-500">Newest first.</p>

          {order.status_histories.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">No status changes recorded yet.</p>
          ) : (
            <ol className="mt-4 space-y-4 border-l border-rule pl-4">
              {order.status_histories.map((history, index) => {
                const actor = orderHistoryActorLabel(history.changed_by_type);
                return (
                  <li key={`${history.new_status}-${history.created_at}-${index}`}>
                    <p className="text-sm font-medium text-ink">
                      {orderStatusTransitionLabel(history.old_status, history.new_status)}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      <time dateTime={history.created_at}>
                        {formatOrderDateTime(history.created_at)}
                      </time>
                      {actor ? ` · ${actor}` : ''}
                    </p>
                    {history.note ? (
                      <p className="mt-1 whitespace-pre-line rounded bg-gray-50 px-3 py-2 text-sm text-gray-700">
                        {history.note}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>

      <p className="text-xs text-gray-500">
        Order created <time dateTime={order.created_at}>{formatOrderDate(order.created_at)}</time>
        {' · '}Quotation {order.quotation_number}
        {' · '}Request #{order.quotation_request_id}
      </p>
    </div>
  );
}
