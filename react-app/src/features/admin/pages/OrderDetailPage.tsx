/**
 * Admin order workspace (Task 09).
 *
 * The admin confirms supplier availability over Viber, then the server moves
 * the order through `ORDER_CONFIRMED → PREPARING`. An unavailable supplier is
 * recorded with a mandatory note, and any order in a cancellable status can
 * be cancelled with a reason. Every mutation returns the refreshed order so
 * the snapshot, status trail and actions stay canonical.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  FiAlertTriangle,
  FiArrowLeft,
  FiCheck,
  FiClock,
  FiCreditCard,
  FiFileText,
  FiMail,
  FiMessageCircle,
  FiPhone,
  FiTruck,
  FiXCircle,
} from 'react-icons/fi';
import {
  Alert,
  LoadingPanel,
  PageHeader,
  StatusBadge,
  describeLoadError,
  describeRequestError,
  formatStatusLabel,
  linkClass,
  primaryButtonClass,
  secondaryButtonClass,
  textareaClass,
  type LoadErrorState,
} from '../../../components/catalog-ui/CatalogUi';
import { formatMMK } from '../../../lib/money';
import {
  cancelOrder,
  confirmSupplier,
  getAdminOrder,
} from '../api/orderAdminApi';
import OrderFulfilmentPanel from '../components/OrderFulfilmentPanel';
import type {
  OrderDetail,
  OrderItem,
  OrderSupplierGroup,
} from '../../orders/api/ordersApi';
import {
  canCancelOrder,
  formatOrderDate,
  formatOrderDateTime,
  orderStatusHint,
  paymentMethodLabel,
} from '../../orders/lib/orderDisplay';

type Panel = 'confirm' | 'unavailable' | 'cancel' | null;

function ItemRow({ item }: { item: OrderItem }) {
  return (
    <li className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{item.product_name_snapshot}</p>
        <p className="text-xs text-gray-500">
          {item.sku_snapshot ? `${item.sku_snapshot} · ` : ''}
          {item.quantity} × {formatMMK(item.unit_price)} MMK
        </p>
        {item.specification_snapshot ? (
          <p className="mt-0.5 text-xs text-gray-600">{item.specification_snapshot}</p>
        ) : null}
      </div>
      <p className="flex-none font-mono text-sm tabular-nums text-ink">
        {formatMMK(item.line_total)} MMK
      </p>
    </li>
  );
}

function ContactLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-1.5 rounded text-sm font-medium text-ink hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
    >
      <span aria-hidden="true" className="text-gray-400">
        {icon}
      </span>
      {children}
    </a>
  );
}

function SupplierCard({ group }: { group: OrderSupplierGroup }) {
  const { supplier } = group;
  const phone = supplier.viber_phone ?? supplier.phone;

  return (
    <li className="px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-ink">{supplier.shop_name ?? 'Supplier'}</p>
          {supplier.contact_person ? (
            <p className="text-xs text-gray-600">{supplier.contact_person}</p>
          ) : null}
        </div>
        {supplier.delivery_time ? (
          <p className="text-xs text-gray-500">Lead time: {supplier.delivery_time}</p>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
        {supplier.viber_phone ? (
          <ContactLink href={`viber://chat?number=${encodeURIComponent(supplier.viber_phone)}`} icon={<FiMessageCircle />}>
            Viber {supplier.viber_phone}
          </ContactLink>
        ) : null}
        {phone ? (
          <ContactLink href={`tel:${phone}`} icon={<FiPhone />}>
            {phone}
          </ContactLink>
        ) : null}
        {supplier.email ? (
          <ContactLink href={`mailto:${supplier.email}`} icon={<FiMail />}>
            {supplier.email}
          </ContactLink>
        ) : null}
      </div>

      {supplier.warranty_policy ? (
        <p className="mt-2 text-xs text-gray-600">Warranty: {supplier.warranty_policy}</p>
      ) : null}

      <ul className="mt-3 space-y-1 text-sm text-gray-700">
        {group.items.map((item) => (
          <li key={item.id} className="flex justify-between gap-4">
            <span className="min-w-0">
              {item.product_name_snapshot}
              {item.specification_snapshot ? (
                <span className="text-xs text-gray-500"> · {item.specification_snapshot}</span>
              ) : null}
            </span>
            <span className="flex-none tabular-nums text-gray-500">× {item.quantity}</span>
          </li>
        ))}
      </ul>
    </li>
  );
}

export default function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const id = Number(orderId);

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<LoadErrorState | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [panel, setPanel] = useState<Panel>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!Number.isInteger(id) || id <= 0) {
      setLoadError({ message: 'This order link is not valid.', needsLogin: false });
      setIsLoading(false);
      return;
    }

    const load = async () => {
      setIsLoading(true);
      setLoadError(null);

      const response = await getAdminOrder(id);

      if (cancelled) return;

      if (response.success && response.data) {
        setOrder(response.data.order);
      } else {
        setLoadError(describeLoadError(response, 'this order'));
      }

      setIsLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [id, reloadToken]);

  const openPanel = (next: Exclude<Panel, null>) => {
    setPanel(next);
    setNote('');
    setActionError(null);
    setNotice(null);
  };

  const closePanel = () => {
    setPanel(null);
    setNote('');
    setActionError(null);
  };

  const runAction = async () => {
    if (!order) return;

    const trimmed = note.trim();

    if (panel === 'unavailable' && trimmed.length < 3) {
      setActionError('Add a short note explaining why the supplier cannot fulfil this order.');
      return;
    }

    if (panel === 'cancel' && trimmed.length < 3) {
      setActionError('Add a reason for cancelling this order.');
      return;
    }

    setBusy(true);
    setActionError(null);
    setNotice(null);

    const response =
      panel === 'confirm'
        ? await confirmSupplier(order.id, 'CONFIRMED', trimmed)
        : panel === 'unavailable'
          ? await confirmSupplier(order.id, 'UNAVAILABLE', trimmed)
          : await cancelOrder(order.id, trimmed);

    if (response.success && response.data) {
      setOrder(response.data.order);
      setNotice(
        panel === 'confirm'
          ? 'Supplier confirmed. The order moved to PREPARING.'
          : panel === 'unavailable'
            ? 'Supplier marked unavailable. The order is closed for confirmation.'
            : 'Order cancelled.',
      );
      setPanel(null);
      setNote('');
    } else {
      setActionError(
        describeRequestError(
          response,
          panel === 'confirm'
            ? 'Could not record the supplier confirmation.'
            : panel === 'unavailable'
              ? 'Could not mark the supplier unavailable.'
              : 'Could not cancel this order.',
        ),
      );
    }

    setBusy(false);
  };

  if (isLoading && order === null) {
    return (
      <div className="space-y-6">
        <PageHeader title="Order detail" />
        <LoadingPanel label="Loading order…" />
      </div>
    );
  }

  if (loadError && order === null) {
    return (
      <div className="space-y-6">
        <PageHeader title="Order detail" />
        <Alert tone="error">
          <div>
            <p className="font-semibold">This order is unavailable</p>
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
                <Link to="/admin/login" className={linkClass}>
                  Go to admin login
                </Link>
              ) : null}
              <Link to="/admin/orders" className={linkClass}>
                Back to orders
              </Link>
            </div>
          </div>
        </Alert>
      </div>
    );
  }

  if (order === null) return null;

  const awaitingSupplier = order.order_status === 'SUPPLIER_CONFIRMATION_REQUIRED';
  const cancellable = canCancelOrder(order.order_status);
  const payment = order.cash_payment;
  const delivery = order.delivery;

  return (
    <div className="space-y-6">
      <Link to="/admin/orders" className={linkClass}>
        <FiArrowLeft aria-hidden="true" className="h-4 w-4" />
        Orders
      </Link>

      <PageHeader
        title={`Order ${order.order_number}`}
        description={`Placed ${formatOrderDateTime(order.created_at)} · ${formatMMK(order.total_amount)} MMK`}
        action={<StatusBadge status={order.order_status} />}
      />

      {isLoading ? (
        <p className="px-1 text-xs text-gray-500" role="status" aria-live="polite">
          Refreshing order…
        </p>
      ) : null}

      {notice ? (
        <Alert tone="success">
          <p>{notice}</p>
        </Alert>
      ) : null}

      {actionError ? (
        <Alert tone="error">
          <p>{actionError}</p>
        </Alert>
      ) : null}

      {loadError ? (
        <Alert tone="warning">
          <div>
            <p>{loadError.message}</p>
            <button
              type="button"
              onClick={() => setReloadToken((token) => token + 1)}
              className={`${secondaryButtonClass} mt-2`}
            >
              Reload order
            </button>
          </div>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section
            className="overflow-hidden rounded-lg border border-rule bg-plate"
            aria-label="Supplier contacts"
          >
            <header className="border-b border-rule px-4 py-3">
              <h2 className="text-sm font-semibold text-ink">Supplier confirmation</h2>
              <p className="mt-0.5 text-xs text-gray-500">
                Contact each supplier over Viber, confirm product, quantity and delivery date,
                then record the result.
              </p>
            </header>

            {order.suppliers.length > 0 ? (
              <ul className="divide-y divide-rule">
                {order.suppliers.map((group) => (
                  <SupplierCard key={group.supplier.id} group={group} />
                ))}
              </ul>
            ) : (
              <p className="px-4 py-3 text-sm text-gray-600">
                No supplier is attached to these order lines.
              </p>
            )}
          </section>

          <section
            className="overflow-hidden rounded-lg border border-rule bg-plate"
            aria-label="Order items"
          >
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-rule px-4 py-3">
              <h2 className="text-sm font-semibold text-ink">Order items</h2>
              <p className="text-xs text-gray-500">
                Quotation {order.quotation?.quotation_number ?? '—'} · version{' '}
                {order.quotation?.version ?? '—'}
              </p>
            </header>

            <ul className="divide-y divide-rule px-4">
              {order.items.map((item) => (
                <ItemRow key={item.id} item={item} />
              ))}
            </ul>

            <div className="border-t border-rule bg-paper px-4 py-3">
              <dl className="ml-auto max-w-sm space-y-1 text-sm">
                <div className="flex justify-between gap-6">
                  <dt className="text-gray-600">Subtotal</dt>
                  <dd className="font-mono tabular-nums text-ink">
                    {formatMMK(order.subtotal)} MMK
                  </dd>
                </div>
                {order.discount > 0 ? (
                  <div className="flex justify-between gap-6">
                    <dt className="text-gray-600">Discount</dt>
                    <dd className="font-mono tabular-nums text-green-700">
                      −{formatMMK(order.discount)} MMK
                    </dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-6">
                  <dt className="text-gray-600">Delivery fee</dt>
                  <dd className="font-mono tabular-nums text-ink">
                    {formatMMK(order.delivery_fee)} MMK
                  </dd>
                </div>
                <div className="flex justify-between gap-6">
                  <dt className="text-gray-600">
                    Service fee ({order.service_fee_percentage}%)
                  </dt>
                  <dd className="font-mono tabular-nums text-ink">
                    {formatMMK(order.service_fee)} MMK
                  </dd>
                </div>
                <div className="flex justify-between gap-6 border-t border-rule pt-1.5">
                  <dt className="font-semibold text-ink">Total</dt>
                  <dd className="font-mono font-semibold tabular-nums text-ink">
                    {formatMMK(order.total_amount)} MMK
                  </dd>
                </div>
              </dl>
            </div>
          </section>

          <section className="rounded-lg border border-rule bg-plate p-4" aria-label="Delivery">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
              <FiTruck aria-hidden="true" className="h-4 w-4 text-gray-400" />
              Delivery
            </h2>

            {delivery ? (
              <div className="mt-3 grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-gray-500">Contact</p>
                  <p className="mt-0.5 text-ink">{delivery.delivery_contact_name}</p>
                  <p className="text-gray-600">{delivery.delivery_phone}</p>
                </div>
                <div>
                  <p className="text-gray-500">Address</p>
                  <p className="mt-0.5 text-ink">{delivery.delivery_address}</p>
                  <p className="text-gray-600">
                    {delivery.city}
                    {delivery.township ? `, ${delivery.township}` : ''}
                    {delivery.landmark ? ` · ${delivery.landmark}` : ''}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Status</p>
                  <div className="mt-1">
                    <StatusBadge status={delivery.delivery_status} />
                  </div>
                </div>
                <div>
                  <p className="text-gray-500">Estimated delivery</p>
                  <p className="mt-0.5 text-ink">
                    {delivery.estimated_delivery_date
                      ? formatOrderDate(delivery.estimated_delivery_date)
                      : 'Not set'}
                  </p>
                  {delivery.tracking_number ? (
                    <p className="text-gray-600">
                      {delivery.delivery_partner ?? 'Delivery partner'} ·{' '}
                      <span className="font-mono">{delivery.tracking_number}</span>
                    </p>
                  ) : null}
                </div>
                {delivery.customer_note ? (
                  <div className="sm:col-span-2">
                    <p className="text-gray-500">Delivery note</p>
                    <p className="mt-0.5 whitespace-pre-line text-ink">{delivery.customer_note}</p>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="mt-2 text-sm text-gray-600">No delivery record for this order.</p>
            )}
          </section>

          <section
            className="rounded-lg border border-rule bg-plate p-4"
            aria-label="Cash payment"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <FiCreditCard aria-hidden="true" className="h-4 w-4 text-gray-400" />
                Cash payment
              </h2>
              {payment ? <StatusBadge status={payment.status} /> : null}
            </div>

            {payment ? (
              <div className="mt-3 grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-gray-500">Method</p>
                  <p className="mt-0.5 text-ink">{paymentMethodLabel(order.payment_method)}</p>
                  <p className="text-xs text-gray-500">
                    Receipt <span className="font-mono">{payment.receipt_number}</span>
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Amounts</p>
                  <p className="mt-0.5 font-mono tabular-nums text-ink">
                    Due {formatMMK(payment.amount_due)} MMK
                  </p>
                  <p className="font-mono tabular-nums text-gray-600">
                    Collected {formatMMK(payment.amount_collected)} MMK · remaining{' '}
                    {formatMMK(payment.amount_remaining)} MMK
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm text-gray-600">No cash payment record for this order.</p>
            )}
          </section>

          <section
            className="overflow-hidden rounded-lg border border-rule bg-plate"
            aria-label="Order status history"
          >
            <header className="border-b border-rule px-4 py-3">
              <h2 className="text-sm font-semibold text-ink">Status history</h2>
            </header>
            <ol className="divide-y divide-rule">
              {order.status_histories.map((entry) => (
                <li key={entry.id} className="flex gap-3 px-4 py-3">
                  <FiClock aria-hidden="true" className="mt-0.5 h-4 w-4 flex-none text-gray-400" />
                  <div className="min-w-0">
                    <p className="text-sm text-ink">
                      {entry.old_status ? (
                        <>
                          {formatStatusLabel(entry.old_status)} →{' '}
                          <span className="font-semibold">
                            {formatStatusLabel(entry.new_status)}
                          </span>
                        </>
                      ) : (
                        <span className="font-semibold">
                          {formatStatusLabel(entry.new_status)}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatOrderDateTime(entry.created_at)} ·{' '}
                      {formatStatusLabel(entry.changed_by_type)}
                      {entry.changed_by_id ? ` #${entry.changed_by_id}` : ''}
                    </p>
                    {entry.note ? (
                      <p className="mt-1 whitespace-pre-line text-xs text-gray-600">{entry.note}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <section className="rounded-lg border border-rule bg-plate p-4" aria-label="Order actions">
            <h2 className="text-sm font-semibold text-ink">Actions</h2>
            <p className="mt-1 text-xs text-gray-600">{orderStatusHint(order.order_status)}</p>

            {panel === null ? (
              <div className="mt-3 space-y-2">
                {awaitingSupplier ? (
                  <>
                    <button
                      type="button"
                      onClick={() => openPanel('confirm')}
                      className={`${primaryButtonClass} w-full`}
                    >
                      <FiCheck aria-hidden="true" className="mr-1.5 h-4 w-4" />
                      Supplier confirmed
                    </button>
                    <button
                      type="button"
                      onClick={() => openPanel('unavailable')}
                      className={`${secondaryButtonClass} w-full`}
                    >
                      <FiAlertTriangle aria-hidden="true" className="mr-1.5 h-4 w-4" />
                      Supplier unavailable
                    </button>
                  </>
                ) : (
                  <p className="text-sm text-gray-600">
                    No supplier action is pending for this order.
                  </p>
                )}

                {cancellable ? (
                  <button
                    type="button"
                    onClick={() => openPanel('cancel')}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-red-300 bg-plate px-4 py-1.5 text-sm font-semibold text-red-700 shadow-sm hover:bg-red-50 active:scale-[.99] focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 motion-safe:transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <FiXCircle aria-hidden="true" className="h-4 w-4" />
                    Cancel order
                  </button>
                ) : null}
              </div>
            ) : null}

            {panel !== null ? (
              <form
                className="mt-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  void runAction();
                }}
              >
                <p className="text-sm font-semibold text-ink">
                  {panel === 'confirm'
                    ? 'Confirm this order?'
                    : panel === 'unavailable'
                      ? 'Mark supplier unavailable?'
                      : 'Cancel this order?'}
                </p>
                <p className="mt-1 text-xs text-gray-600">
                  {panel === 'confirm'
                    ? 'The order moves to ORDER_CONFIRMED and then PREPARING. Both steps are recorded in the status history.'
                    : panel === 'unavailable'
                      ? 'The order stops at SUPPLIER_UNAVAILABLE. Explain what the supplier said so the team can follow up.'
                      : 'The customer will see the cancelled status. Explain why the order cannot continue.'}
                </p>

                <label htmlFor="action-note" className="mt-3 block text-xs font-medium text-ink">
                  {panel === 'confirm' ? 'Note (optional)' : 'Reason'}
                  {panel !== 'confirm' ? <span className="text-red-600"> *</span> : null}
                </label>
                <textarea
                  id="action-note"
                  rows={3}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  maxLength={2000}
                  required={panel !== 'confirm'}
                  minLength={panel === 'confirm' ? undefined : 3}
                  className={`${textareaClass} mt-1`}
                  placeholder={
                    panel === 'confirm'
                      ? 'e.g. Supplier confirmed stock and delivery date over Viber.'
                      : panel === 'unavailable'
                        ? 'e.g. Supplier has no stock until next month.'
                        : 'e.g. Customer asked to cancel before dispatch.'
                  }
                />

                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="submit" disabled={busy} className={primaryButtonClass}>
                    {busy
                      ? 'Saving…'
                      : panel === 'confirm'
                        ? 'Confirm order'
                        : panel === 'unavailable'
                          ? 'Mark unavailable'
                          : 'Cancel order'}
                  </button>
                  <button
                    type="button"
                    onClick={closePanel}
                    disabled={busy}
                    className={secondaryButtonClass}
                  >
                    Keep order
                  </button>
                </div>
              </form>
            ) : null}
          </section>

          <OrderFulfilmentPanel
            order={order}
            onOrderUpdated={setOrder}
            onNotice={setNotice}
            onError={setActionError}
          />

          <section className="rounded-lg border border-rule bg-plate p-4" aria-label="Customer">
            <h2 className="text-sm font-semibold text-ink">Customer</h2>
            <dl className="mt-3 space-y-3 text-sm">
              <div>
                <dt className="text-gray-500">Contact</dt>
                <dd className="mt-0.5 text-ink">
                  {order.customer_name}
                  {order.company_name ? ` · ${order.company_name}` : ''}
                </dd>
                <dd className="text-gray-600">{order.phone}</dd>
                {order.email ? <dd className="text-gray-600">{order.email}</dd> : null}
              </div>
              <div>
                <dt className="text-gray-500">Delivery address</dt>
                <dd className="mt-0.5 text-ink">{order.delivery_address}</dd>
                <dd className="text-gray-600">
                  {order.city}
                  {order.township ? `, ${order.township}` : ''}
                </dd>
                {order.landmark ? <dd className="text-gray-600">{order.landmark}</dd> : null}
              </div>
              {order.customer_note ? (
                <div>
                  <dt className="text-gray-500">Customer note</dt>
                  <dd className="mt-0.5 whitespace-pre-line text-ink">{order.customer_note}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          {order.quotation ? (
            <section className="rounded-lg border border-rule bg-plate p-4" aria-label="Source quotation">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <FiFileText aria-hidden="true" className="h-4 w-4 text-gray-400" />
                Source quotation
              </h2>
              <p className="mt-2 font-mono text-sm text-ink">{order.quotation.quotation_number}</p>
              <p className="text-xs text-gray-500">
                Version {order.quotation.version} · {formatStatusLabel(order.quotation.status)} ·{' '}
                accepted {formatOrderDateTime(order.quotation.accepted_at)}
              </p>
              <Link
                to={`/admin/quotation-requests/${order.quotation_request_id}`}
                className={`${linkClass} mt-3`}
              >
                Open quotation request
              </Link>
            </section>
          ) : null}

          <section className="rounded-lg border border-rule bg-paper p-3 text-xs text-gray-600">
            Order status and money values are locked to the accepted quotation. Later catalog
            price changes never alter this order.
          </section>
        </aside>
      </div>
    </div>
  );
}
