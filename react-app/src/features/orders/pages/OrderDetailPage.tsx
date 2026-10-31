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
import { useI18n, type Translator } from '../../../lib/i18n-context';
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
  orderStatusLabel,
  paymentMethodLabel,
} from '../lib/orderDisplay';

function ItemRow({ item, t }: { item: OrderItem; t: Translator }) {
  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{item.product_name_snapshot}</p>
          <p className="mt-0.5 text-xs text-gray-500">
            {item.sku_snapshot ? `${item.sku_snapshot} · ` : ''}
            {item.supplier?.shop_name ?? t('supplierDefault')}
          </p>
          {item.specification_snapshot ? (
            <p className="mt-1 text-xs text-gray-600">{item.specification_snapshot}</p>
          ) : null}
        </div>

        <div className="flex-none text-left sm:text-right">
          <p className="font-mono text-sm tabular-nums text-ink">
            {formatMMK(item.line_total)} {t('mmk')}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            {item.quantity} × {formatMMK(item.unit_price)} {t('mmk')}
          </p>
          {item.discount > 0 ? (
            <p className="text-xs text-green-700">
              −{formatMMK(item.discount)} {t('mmk')} {t('lineDiscount')}
            </p>
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
  const { locale, t } = useI18n();
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
      setLoadError({ message: t('invalidOrderLink'), needsLogin: false });
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
        setLoadError(describeCustomerLoadError(response, t('orderLoadSubject')));
      }

      setIsLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [orderId, reloadToken, t]);

  const downloadReceipt = async () => {
    if (!order) return;

    setDownloadingReceipt(true);
    setReceiptError(null);

    const response = await downloadOrderReceipt(order.id);

    if (response.success && response.data) {
      saveDownloadedFile(response.data);
    } else {
      setReceiptError(response.message ?? t('receiptDownloadFailed'));
    }

    setDownloadingReceipt(false);
  };

  if (isLoading && order === null) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('orderDetail')} />
        <LoadingPanel label={t('loadingOrder')} />
      </div>
    );
  }

  if (loadError && order === null) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('orderDetail')} />
        <Alert tone="error">
          <div>
            <p className="font-semibold">{t('orderUnavailable')}</p>
            <p className="mt-1">{loadError.message}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setReloadToken((token) => token + 1)}
                className={primaryButtonClass}
              >
                {t('tryAgain')}
              </button>
              {loadError.needsLogin ? (
                <Link to="/login" className={linkClass}>
                  {t('goToLogin')}
                </Link>
              ) : null}
              <Link to="/orders" className={linkClass}>
                {t('backToOrders')}
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
        {t('myOrders')}
      </Link>

      <PageHeader
        title={t('orderNumberValue', { number: order.order_number })}
        description={t('placedOn', { date: formatOrderDateTime(order.created_at, locale, t) })}
        action={<StatusBadge status={order.order_status} />}
      />

      {isLoading ? (
        <p className="px-1 text-xs text-gray-500" role="status" aria-live="polite">
          {t('refreshingOrder')}
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
              {t('reloadOrder')}
            </button>
          </div>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section
            className="overflow-hidden rounded-lg border border-rule bg-plate"
            aria-label={t('orderItems')}
          >
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-rule px-4 py-3">
              <h2 className="text-sm font-semibold text-ink">{t('items')}</h2>
              <p className="text-xs text-gray-500">
                {t('copiedQuotationVersion', {
                  version: order.quotation?.version ?? t('statusNoValue'),
                })}
              </p>
            </header>

            <ul className="divide-y divide-rule px-4">
              {order.items.map((item) => (
                <ItemRow key={item.id} item={item} t={t} />
              ))}
            </ul>

            <div className="border-t border-rule bg-paper px-4 py-4">
              <dl className="ml-auto max-w-sm space-y-1.5 text-sm">
                <InfoRow label={t('subtotal')} value={`${formatMMK(order.subtotal)} ${t('mmk')}`} />
                {order.discount > 0 ? (
                  <InfoRow label={t('discount')} value={`−${formatMMK(order.discount)} ${t('mmk')}`} />
                ) : null}
                <InfoRow label={t('deliveryFee')} value={`${formatMMK(order.delivery_fee)} ${t('mmk')}`} />
                <InfoRow
                  label={t('serviceFee', { percent: order.service_fee_percentage })}
                  value={`${formatMMK(order.service_fee)} ${t('mmk')}`}
                />
                <div className="flex justify-between gap-6 border-t border-rule pt-2">
                  <dt className="font-semibold text-ink">{t('total')}</dt>
                  <dd className="font-mono text-base font-semibold tabular-nums text-ink">
                    {formatMMK(order.total_amount)} {t('mmk')}
                  </dd>
                </div>
              </dl>
            </div>
          </section>

          <section className="rounded-lg border border-rule bg-plate p-4" aria-label={t('delivery')}>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
              <FiTruck aria-hidden="true" className="h-4 w-4 text-gray-400" />
              {t('delivery')}
            </h2>

            {delivery ? (
              <div className="mt-3 grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-gray-500">{t('deliverTo')}</p>
                  <p className="mt-0.5 text-ink">{delivery.delivery_contact_name}</p>
                  <p className="text-gray-600">{delivery.delivery_phone}</p>
                </div>
                <div>
                  <p className="text-gray-500">{t('address')}</p>
                  <p className="mt-0.5 text-ink">{delivery.delivery_address}</p>
                  <p className="text-gray-600">
                    {delivery.city}
                    {delivery.township ? `, ${delivery.township}` : ''}
                    {delivery.landmark ? ` · ${delivery.landmark}` : ''}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">{t('status')}</p>
                  <div className="mt-1">
                    <StatusBadge status={delivery.delivery_status} />
                  </div>
                </div>
                <div>
                  <p className="text-gray-500">{t('estimatedDelivery')}</p>
                  <p className="mt-0.5 text-ink">
                    {delivery.estimated_delivery_date
                      ? formatOrderDate(delivery.estimated_delivery_date, locale, t)
                      : t('toBeConfirmed')}
                  </p>
                  {delivery.tracking_number ? (
                    <p className="text-gray-600">
                      {delivery.delivery_partner ?? t('deliveryPartner')} ·{' '}
                      <span className="font-mono">{delivery.tracking_number}</span>
                    </p>
                  ) : null}
                </div>
                {delivery.customer_note ? (
                  <div className="sm:col-span-2">
                    <p className="text-gray-500">{t('deliveryNote')}</p>
                    <p className="mt-0.5 whitespace-pre-line text-ink">{delivery.customer_note}</p>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="mt-2 text-sm text-gray-600">{t('deliveryDetailsPending')}</p>
            )}
          </section>

          <section
            className="rounded-lg border border-rule bg-plate p-4"
            aria-label={t('cashPayment')}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <FiCreditCard aria-hidden="true" className="h-4 w-4 text-gray-400" />
                {t('cashPayment')}
              </h2>
              {payment ? <StatusBadge status={payment.status} /> : null}
            </div>

            {payment ? (
              <dl className="mt-3 max-w-md space-y-1.5 text-sm">
                <InfoRow label={t('paymentMethod')} value={paymentMethodLabel(order.payment_method, t)} />
                <InfoRow label={t('amountDue')} value={`${formatMMK(payment.amount_due)} ${t('mmk')}`} />
                <InfoRow label={t('collected')} value={`${formatMMK(payment.amount_collected)} ${t('mmk')}`} />
                <div className="flex justify-between gap-6 border-t border-rule pt-2">
                  <dt className="font-semibold text-ink">{t('remaining')}</dt>
                  <dd className="font-mono text-base font-semibold tabular-nums text-ink">
                    {formatMMK(payment.amount_remaining)} {t('mmk')}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="mt-2 text-sm text-gray-600">{t('paymentUnavailable')}</p>
            )}

            {payment ? (
              <p className="mt-3 text-xs text-gray-500">
                {t('receipt')} <span className="font-mono">{payment.receipt_number}</span>
                {payment.collected_at
                  ? ` · ${t('collectedOn', { date: formatOrderDateTime(payment.collected_at, locale, t) })}`
                  : ''}
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
                {downloadingReceipt ? t('downloading') : t('downloadReceipt')}
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
            aria-label={t('statusHistory')}
          >
            <header className="border-b border-rule px-4 py-3">
              <h2 className="text-sm font-semibold text-ink">{t('statusHistory')}</h2>
            </header>
            <ol className="divide-y divide-rule">
              {order.status_histories.map((entry) => (
                <li key={entry.id} className="flex gap-3 px-4 py-3">
                  <FiClock aria-hidden="true" className="mt-0.5 h-4 w-4 flex-none text-gray-400" />
                  <div className="min-w-0">
                    <p className="text-sm text-ink">
                      {entry.old_status ? (
                        <>
                          {orderStatusLabel(entry.old_status, t)} →{' '}
                          <span className="font-semibold">
                            {orderStatusLabel(entry.new_status, t)}
                          </span>
                        </>
                      ) : (
                        <span className="font-semibold">
                          {orderStatusLabel(entry.new_status, t)}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatOrderDateTime(entry.created_at, locale, t)} ·{' '}
                      {entry.changed_by_type === 'SYSTEM'
                        ? t('cosupplySystem')
                        : entry.changed_by_type === 'ADMIN'
                          ? t('supplierTeam')
                          : t('statusUnknown', { status: formatStatusLabel(entry.changed_by_type) })}
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
          <section className="rounded-lg border border-rule bg-plate p-4" aria-label={t('orderStatus')}>
            <div className="flex items-center gap-2">
              <FiCheckCircle aria-hidden="true" className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-semibold text-ink">{orderStatusLabel(order.order_status, t)}</h2>
            </div>
            <p className="mt-1 text-sm text-gray-600">{orderStatusHint(order.order_status, t)}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <StatusBadge status={order.payment_status} />
              <StatusBadge status={order.delivery_status} />
            </div>
          </section>

          <section className="rounded-lg border border-rule bg-plate p-4" aria-label={t('orderDetails')}>
            <h2 className="text-sm font-semibold text-ink">{t('orderDetails')}</h2>
            <dl className="mt-3 space-y-3 text-sm">
              <div>
                <dt className="text-gray-500">{t('contact')}</dt>
                <dd className="mt-0.5 text-ink">
                  {order.customer_name}
                  {order.company_name ? ` · ${order.company_name}` : ''}
                </dd>
                <dd className="text-gray-600">{order.phone}</dd>
                {order.email ? <dd className="text-gray-600">{order.email}</dd> : null}
              </div>
              <div>
                <dt className="text-gray-500">{t('deliveryAddress')}</dt>
                <dd className="mt-0.5 text-ink">{order.delivery_address}</dd>
                <dd className="text-gray-600">
                  {order.city}
                  {order.township ? `, ${order.township}` : ''}
                </dd>
                {order.landmark ? <dd className="text-gray-600">{order.landmark}</dd> : null}
              </div>
              {order.customer_note ? (
                <div>
                  <dt className="text-gray-500">{t('yourNote')}</dt>
                  <dd className="mt-0.5 whitespace-pre-line text-ink">{order.customer_note}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          {order.quotation ? (
            <section className="rounded-lg border border-rule bg-plate p-4" aria-label={t('sourceQuotation')}>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <FiFileText aria-hidden="true" className="h-4 w-4 text-gray-400" />
                {t('sourceQuotation')}
              </h2>
              <p className="mt-2 font-mono text-sm text-ink">{order.quotation.quotation_number}</p>
              <p className="text-xs text-gray-500">
                {t('versionAccepted', {
                  version: order.quotation.version,
                  date: formatOrderDateTime(order.quotation.accepted_at, locale, t),
                })}
              </p>
              <Link
                to={`/quotations/${order.quotation_request_id}`}
                className={`${linkClass} mt-3`}
              >
                {t('viewQuotation')}
              </Link>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
