/**
 * Customer order detail (Task 09).
 *
 * Shows the immutable order snapshot created when the quotation was accepted:
 * item lines copied from the accepted quotation version, the delivery record,
 * the full COD payment record and the append-only status trail. Supplier
 * contact details are intentionally server-hidden on the customer endpoint.
 */
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  FiArrowLeft,
  FiCheckCircle,
  FiClock,
  FiCreditCard,
  FiDownload,
  FiFileText,
  FiTruck,
} from 'react-icons/fi';
import {
  Alert,
  LoadingPanel,
  PageHeader,
  StatusBadge,
  describeCustomerLoadError,
  formatStatusLabel,
  linkClass,
  primaryButtonClass,
  secondaryButtonClass,
  type LoadErrorState,
} from '../../../components/catalog-ui/CatalogUi';
import { formatMMK } from '../../../lib/money';
import { saveDownloadedFile } from '../../../lib/downloadFile';
import {
  downloadOrderReceipt,
  getOrder,
  type OrderDetail,
  type OrderItem,
} from '../api/ordersApi';
import {
  formatOrderDate,
  formatOrderDateTime,
  orderStatusHint,
  paymentMethodLabel,
} from '../lib/orderDisplay';

function ItemRow({ item }: { item: OrderItem }) {
  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{item.product_name_snapshot}</p>
          <p className="mt-0.5 text-xs text-gray-500">
            {item.sku_snapshot ? `${item.sku_snapshot} · ` : ''}
            {item.supplier?.shop_name ?? 'Supplier'}
          </p>
          {item.specification_snapshot ? (
            <p className="mt-1 text-xs text-gray-600">{item.specification_snapshot}</p>
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-6">
      <dt className="text-gray-600">{label}</dt>
      <dd className="font-mono tabular-nums text-ink">{value}</dd>
    </div>
  );
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const orderId = Number(id);

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<LoadErrorState | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [downloadingReceipt, setDownloadingReceipt] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!Number.isInteger(orderId) || orderId <= 0) {
      setLoadError({ message: 'This order link is not valid.', needsLogin: false });
      setIsLoading(false);
      return;
    }

    const load = async () => {
      setIsLoading(true);
      setLoadError(null);

      const response = await getOrder(orderId);

      if (cancelled) return;

      if (response.success && response.data) {
        setOrder(response.data.order);
      } else {
        setLoadError(describeCustomerLoadError(response, 'this order'));
      }

      setIsLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [orderId, reloadToken]);

  const downloadReceipt = async () => {
    if (!order) return;

    setDownloadingReceipt(true);
    setReceiptError(null);

    const response = await downloadOrderReceipt(order.id);

    if (response.success && response.data) {
      saveDownloadedFile(response.data);
    } else {
      setReceiptError(response.message ?? 'The receipt could not be downloaded.');
    }

    setDownloadingReceipt(false);
  };

  if (isLoading && order === null) {
    return (
      <div className="space-y-6">
        <PageHeader title="Order detail" />
        <LoadingPanel label="Loading your order…" />
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
                <Link to="/login" className={linkClass}>
                  Go to login
                </Link>
              ) : null}
              <Link to="/orders" className={linkClass}>
                Back to my orders
              </Link>
            </div>
          </div>
        </Alert>
      </div>
    );
  }

  if (order === null) return null;

  const payment = order.cash_payment;
  const delivery = order.delivery;

  return (
    <div className="space-y-6">
      <Link to="/orders" className={linkClass}>
        <FiArrowLeft aria-hidden="true" className="h-4 w-4" />
        My orders
      </Link>

      <PageHeader
        title={`Order ${order.order_number}`}
        description={`Placed ${formatOrderDateTime(order.created_at)}`}
        action={<StatusBadge status={order.order_status} />}
      />

      {isLoading ? (
        <p className="px-1 text-xs text-gray-500" role="status" aria-live="polite">
          Refreshing order…
        </p>
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
            aria-label="Order items"
          >
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-rule px-4 py-3">
              <h2 className="text-sm font-semibold text-ink">Items</h2>
              <p className="text-xs text-gray-500">
                Copied from accepted quotation version {order.quotation?.version ?? '—'}
              </p>
            </header>

            <ul className="divide-y divide-rule px-4">
              {order.items.map((item) => (
                <ItemRow key={item.id} item={item} />
              ))}
            </ul>

            <div className="border-t border-rule bg-paper px-4 py-4">
              <dl className="ml-auto max-w-sm space-y-1.5 text-sm">
                <InfoRow label="Subtotal" value={`${formatMMK(order.subtotal)} MMK`} />
                {order.discount > 0 ? (
                  <InfoRow label="Discount" value={`−${formatMMK(order.discount)} MMK`} />
                ) : null}
                <InfoRow label="Delivery fee" value={`${formatMMK(order.delivery_fee)} MMK`} />
                <InfoRow
                  label={`Service fee (${order.service_fee_percentage}%)`}
                  value={`${formatMMK(order.service_fee)} MMK`}
                />
                <div className="flex justify-between gap-6 border-t border-rule pt-2">
                  <dt className="font-semibold text-ink">Total</dt>
                  <dd className="font-mono text-base font-semibold tabular-nums text-ink">
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
                  <p className="text-gray-500">Deliver to</p>
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
                      : 'To be confirmed'}
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
              <p className="mt-2 text-sm text-gray-600">
                Delivery details will appear once the order is handed to the delivery team.
              </p>
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
              <dl className="mt-3 max-w-md space-y-1.5 text-sm">
                <InfoRow label="Payment method" value={paymentMethodLabel(order.payment_method)} />
                <InfoRow label="Amount due" value={`${formatMMK(payment.amount_due)} MMK`} />
                <InfoRow
                  label="Collected"
                  value={`${formatMMK(payment.amount_collected)} MMK`}
                />
                <div className="flex justify-between gap-6 border-t border-rule pt-2">
                  <dt className="font-semibold text-ink">Remaining</dt>
                  <dd className="font-mono text-base font-semibold tabular-nums text-ink">
                    {formatMMK(payment.amount_remaining)} MMK
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="mt-2 text-sm text-gray-600">Payment details are not available yet.</p>
            )}

            {payment ? (
              <p className="mt-3 text-xs text-gray-500">
                Receipt <span className="font-mono">{payment.receipt_number}</span>
                {payment.collected_at ? ` · collected ${formatOrderDateTime(payment.collected_at)}` : ''}
              </p>
            ) : null}

            {payment?.receipt_available ? (
              <button
                type="button"
                onClick={() => void downloadReceipt()}
                disabled={downloadingReceipt}
                className={`${secondaryButtonClass} mt-3`}
              >
                <FiDownload aria-hidden="true" className="mr-1.5 h-4 w-4" />
                {downloadingReceipt ? 'Downloading…' : 'Download receipt'}
              </button>
            ) : null}

            {receiptError ? (
              <div className="mt-3">
                <Alert tone="error">
                  <p>{receiptError}</p>
                </Alert>
              </div>
            ) : null}
          </section>

          <section
            className="rounded-lg border border-rule bg-plate"
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
                      {entry.changed_by_type === 'SYSTEM'
                        ? 'CoSupply system'
                        : entry.changed_by_type === 'ADMIN'
                          ? 'Supplier team'
                          : formatStatusLabel(entry.changed_by_type)}
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
          <section className="rounded-lg border border-rule bg-plate p-4" aria-label="Order status">
            <div className="flex items-center gap-2">
              <FiCheckCircle aria-hidden="true" className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-semibold text-ink">{formatStatusLabel(order.order_status)}</h2>
            </div>
            <p className="mt-1 text-sm text-gray-600">{orderStatusHint(order.order_status)}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <StatusBadge status={order.payment_status} />
              <StatusBadge status={order.delivery_status} />
            </div>
          </section>

          <section className="rounded-lg border border-rule bg-plate p-4" aria-label="Order details">
            <h2 className="text-sm font-semibold text-ink">Order details</h2>
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
                  <dt className="text-gray-500">Your note</dt>
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
                Version {order.quotation.version} · accepted{' '}
                {formatOrderDateTime(order.quotation.accepted_at)}
              </p>
              <Link
                to={`/quotations/${order.quotation_request_id}`}
                className={`${linkClass} mt-3`}
              >
                View quotation
              </Link>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
