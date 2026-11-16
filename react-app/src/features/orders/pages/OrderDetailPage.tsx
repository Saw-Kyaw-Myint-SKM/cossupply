/**
 * Customer order detail (Task 09).
 *
 * Shows the immutable order snapshot created when the quotation was accepted:
 * item lines copied from the accepted quotation version, the delivery record,
 * the full COD payment record and the append-only status trail. Supplier
 * contact details are intentionally server-hidden on the customer endpoint.
 *
 * The page is a guided sequence: a journey band answers "where is it and what
 * do I do next", then four numbered cards (items, delivery, payment, history)
 * each explain their own purpose before showing data.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  FiArrowLeft,
  FiClock,
  FiCreditCard,
  FiDownload,
  FiFileText,
  FiInfo,
  FiPackage,
  FiTruck,
  FiUser,
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
  orderStatusLabel,
  paymentMethodLabel,
} from '../lib/orderDisplay';
import { OrderJourney } from '../components/OrderJourney';
import { OrderSection } from '../components/OrderSection';

/** Small uppercase label used above every value inside a card. */
const MICRO_LABEL = 'text-[11px] font-medium uppercase tracking-wide text-subtle';

function ItemRow({ item, t }: { item: OrderItem; t: Translator }) {
  return (
    <li className="flex flex-col gap-2 py-3.5 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <p className="text-sm font-semibold leading-snug text-ink">{item.product_name_snapshot}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
          {item.sku_snapshot ? <span className="font-mono">{item.sku_snapshot}</span> : null}
          {item.sku_snapshot ? (
            <span aria-hidden="true" className="text-line">
              ·
            </span>
          ) : null}
          <span>{item.supplier?.shop_name ?? t('supplierDefault')}</span>
        </p>
        {item.specification_snapshot ? (
          <p className="mt-1 text-xs leading-relaxed text-subtle">{item.specification_snapshot}</p>
        ) : null}
      </div>

      <div className="flex flex-none items-baseline justify-between gap-3 sm:flex-col sm:items-end sm:gap-0.5 sm:text-right">
        <p className="font-mono text-sm font-semibold tabular-nums text-ink">
          {formatMMK(item.line_total)} {t('mmk')}
        </p>
        <p className="text-xs text-muted">
          {item.quantity} × {formatMMK(item.unit_price)} {t('mmk')}
        </p>
        {item.discount > 0 ? (
          <p className="text-xs font-medium text-success">
            −{formatMMK(item.discount)} {t('mmk')} {t('lineDiscount')}
          </p>
        ) : null}
      </div>
    </li>
  );
}

function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between gap-6">
      <dt className="text-muted">{label}</dt>
      <dd className={`text-right text-ink ${mono ? 'font-mono tabular-nums' : ''}`}>{value}</dd>
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

  // The translator changes with the locale. Keep the latest one readable from
  // async callbacks without re-running the query on a language switch, since
  // the order data itself is locale-independent.
  const tRef = useRef(t);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  useEffect(() => {
    let cancelled = false;

    if (!Number.isInteger(orderId) || orderId <= 0) {
      setLoadError({ message: tRef.current('invalidOrderLink'), needsLogin: false });
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
        setLoadError(describeCustomerLoadError(response, tRef.current('orderLoadSubject')));
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

  const paidPercent = payment
    ? payment.amount_due > 0
      ? Math.min(100, Math.max(0, Math.round((payment.amount_collected / payment.amount_due) * 100)))
      : payment.amount_collected > 0
        ? 100
        : 0
    : 0;

  const collectedLabel = payment
    ? t('collectedOfDue', {
        collected: `${formatMMK(payment.amount_collected)} ${t('mmk')}`,
        due: `${formatMMK(payment.amount_due)} ${t('mmk')}`,
      })
    : '';

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

      <OrderJourney
        status={order.order_status}
        paymentStatus={order.payment_status}
        deliveryStatus={order.delivery_status}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* 1 — Items ------------------------------------------------------ */}
          <OrderSection
            step={1}
            accent="sky"
            icon={<FiPackage aria-hidden="true" className="h-4 w-4" />}
            title={t('items')}
            hint={t('itemsHint')}
            meta={
              <p className="text-xs text-subtle">
                {t('copiedQuotationVersion', {
                  version: order.quotation?.version ?? t('statusNoValue'),
                })}
              </p>
            }
          >
            <ul className="divide-y divide-line/50">
              {order.items.map((item) => (
                <ItemRow key={item.id} item={item} t={t} />
              ))}
            </ul>

            <div className="mt-4 border-t border-line/50 pt-4">
              <dl className="space-y-1.5 rounded-xl bg-white/55 px-3.5 py-3 text-sm ring-1 ring-inset ring-line/40 sm:ml-auto sm:max-w-sm">
                <InfoRow
                  label={t('subtotal')}
                  value={`${formatMMK(order.subtotal)} ${t('mmk')}`}
                  mono
                />
                {order.discount > 0 ? (
                  <InfoRow
                    label={t('discount')}
                    value={`−${formatMMK(order.discount)} ${t('mmk')}`}
                    mono
                  />
                ) : null}
                <InfoRow
                  label={t('deliveryFee')}
                  value={`${formatMMK(order.delivery_fee)} ${t('mmk')}`}
                  mono
                />
                <InfoRow
                  label={t('serviceFee', { percent: order.service_fee_percentage })}
                  value={`${formatMMK(order.service_fee)} ${t('mmk')}`}
                  mono
                />
                <div className="flex justify-between gap-6 border-t border-line/50 pt-2">
                  <dt className="font-semibold text-ink">{t('total')}</dt>
                  <dd className="font-mono text-base font-bold tabular-nums text-ink">
                    {formatMMK(order.total_amount)} {t('mmk')}
                  </dd>
                </div>
              </dl>
            </div>
          </OrderSection>

          {/* 2 — Delivery --------------------------------------------------- */}
          <OrderSection
            step={2}
            accent="emerald"
            icon={<FiTruck aria-hidden="true" className="h-4 w-4" />}
            title={t('delivery')}
            hint={t('deliveryHint')}
          >
            {delivery ? (
              <>
                <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className={MICRO_LABEL}>{t('deliverTo')}</dt>
                    <dd className="mt-1 font-medium text-ink">{delivery.delivery_contact_name}</dd>
                    <dd className="text-muted">{delivery.delivery_phone}</dd>
                  </div>

                  <div>
                    <dt className={MICRO_LABEL}>{t('status')}</dt>
                    <dd className="mt-1.5">
                      <StatusBadge status={delivery.delivery_status} />
                    </dd>
                  </div>

                  <div className="sm:col-span-2">
                    <dt className={MICRO_LABEL}>{t('address')}</dt>
                    <dd className="mt-1 leading-relaxed text-ink">{delivery.delivery_address}</dd>
                    <dd className="text-muted">
                      {delivery.city}
                      {delivery.township ? `, ${delivery.township}` : ''}
                      {delivery.landmark ? ` · ${delivery.landmark}` : ''}
                    </dd>
                  </div>

                  <div>
                    <dt className={MICRO_LABEL}>{t('estimatedDelivery')}</dt>
                    <dd className="mt-1 font-medium text-ink">
                      {delivery.estimated_delivery_date
                        ? formatOrderDate(delivery.estimated_delivery_date, locale, t)
                        : t('toBeConfirmed')}
                    </dd>
                  </div>

                  <div>
                    <dt className={MICRO_LABEL}>{t('deliveryPartner')}</dt>
                    <dd className="mt-1 text-ink">
                      {delivery.delivery_partner ?? t('statusNoValue')}
                      {delivery.tracking_number ? (
                        <span className="ml-1.5 font-mono text-xs text-muted">
                          {delivery.tracking_number}
                        </span>
                      ) : null}
                    </dd>
                  </div>
                </dl>

                {delivery.tracking_number ? null : (
                  <p className="mt-3 flex items-start gap-2 rounded-xl bg-primary-light/60 px-3 py-2 text-xs font-medium leading-relaxed text-primary ring-1 ring-inset ring-primary/15">
                    <FiInfo aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 flex-none" />
                    {t('deliveryRiderPending')}
                  </p>
                )}

                {delivery.customer_note ? (
                  <div className="mt-3">
                    <p className={MICRO_LABEL}>{t('deliveryNote')}</p>
                    <p className="mt-1 whitespace-pre-line rounded-lg bg-white/55 px-2.5 py-2 text-sm text-muted ring-1 ring-inset ring-line/40">
                      {delivery.customer_note}
                    </p>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="rounded-xl border border-dashed border-line/60 bg-white/40 px-3 py-3 text-sm leading-relaxed text-muted">
                {t('deliveryDetailsPending')}
              </p>
            )}
          </OrderSection>

          {/* 3 — Payment ---------------------------------------------------- */}
          <OrderSection
            step={3}
            accent="amber"
            icon={<FiCreditCard aria-hidden="true" className="h-4 w-4" />}
            title={t('cashPayment')}
            hint={t('paymentHint')}
          >
            {payment ? (
              <>
                <div className="rounded-xl bg-amber-50/80 px-3.5 py-3 ring-1 ring-inset ring-amber-200/70">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className={`${MICRO_LABEL} text-amber-800/80`}>{t('amountDue')}</p>
                      <p className="mt-0.5 font-mono text-xl font-bold tabular-nums text-ink">
                        {formatMMK(payment.amount_due)}
                        <span className="ml-1 text-sm font-semibold text-muted">{t('mmk')}</span>
                      </p>
                    </div>
                    <StatusBadge status={payment.status} />
                  </div>

                  <div
                    role="progressbar"
                    aria-label={collectedLabel}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={paidPercent}
                    className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-amber-200/70"
                  >
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-sky-400 motion-safe:transition-[width] motion-safe:duration-300"
                      style={{ width: `${paidPercent}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-amber-900/80">{collectedLabel}</p>
                </div>

                <dl className="mt-4 space-y-1.5 text-sm">
                  <InfoRow
                    label={t('paymentMethod')}
                    value={paymentMethodLabel(order.payment_method, t)}
                  />
                  <InfoRow label={t('collected')} value={`${formatMMK(payment.amount_collected)} ${t('mmk')}`} mono />
                  <div className="flex justify-between gap-6 border-t border-line/50 pt-2">
                    <dt className="font-semibold text-ink">{t('remaining')}</dt>
                    <dd className="font-mono text-base font-semibold tabular-nums text-ink">
                      {formatMMK(payment.amount_remaining)} {t('mmk')}
                    </dd>
                  </div>
                </dl>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-subtle">
                    {t('receipt')}{' '}
                    <span className="font-mono text-muted">{payment.receipt_number}</span>
                    {payment.collected_at
                      ? ` · ${t('collectedOn', {
                          date: formatOrderDateTime(payment.collected_at, locale, t),
                        })}`
                      : ''}
                  </p>

                  {payment.receipt_available ? (
                    <button
                      type="button"
                      onClick={() => void downloadReceipt()}
                      disabled={downloadingReceipt}
                      className={secondaryButtonClass}
                    >
                      <FiDownload aria-hidden="true" className="mr-1.5 h-4 w-4" />
                      {downloadingReceipt ? t('downloading') : t('downloadReceipt')}
                    </button>
                  ) : null}
                </div>
              </>
            ) : (
              <p className="rounded-xl border border-dashed border-line/60 bg-white/40 px-3 py-3 text-sm leading-relaxed text-muted">
                {t('paymentPending')}
              </p>
            )}

            {receiptError ? (
              <div className="mt-3">
                <Alert tone="error">
                  <p>{receiptError}</p>
                </Alert>
              </div>
            ) : null}
          </OrderSection>

          {/* 4 — Status history --------------------------------------------- */}
          <OrderSection
            step={4}
            accent="violet"
            icon={<FiClock aria-hidden="true" className="h-4 w-4" />}
            title={t('statusHistory')}
            hint={t('historyHint')}
          >
            <ol>
              {order.status_histories.map((entry, index) => {
                const isLatest = index === order.status_histories.length - 1;
                const actor =
                  entry.changed_by_type === 'SYSTEM'
                    ? t('cosupplySystem')
                    : entry.changed_by_type === 'ADMIN'
                      ? t('supplierTeam')
                      : t('statusUnknown', { status: formatStatusLabel(entry.changed_by_type) });

                return (
                  <li key={entry.id} className="relative flex gap-3 pb-4 last:pb-0">
                    {isLatest ? null : (
                      <span
                        aria-hidden="true"
                        className="absolute left-[6px] top-3 h-full w-px bg-line/60"
                      />
                    )}
                    <span
                      aria-hidden="true"
                      className={`relative z-10 mt-0.5 h-3.5 w-3.5 flex-none rounded-full border-2 ${
                        isLatest
                          ? 'border-primary bg-primary ring-4 ring-primary/15'
                          : 'border-line bg-white'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug text-ink">
                        {entry.old_status ? (
                          <>
                            {orderStatusLabel(entry.old_status, t)}{' '}
                            <span aria-hidden="true" className="text-subtle">
                              →
                            </span>{' '}
                            <span className="font-semibold">
                              {orderStatusLabel(entry.new_status, t)}
                            </span>
                          </>
                        ) : (
                          <span className="font-semibold">{orderStatusLabel(entry.new_status, t)}</span>
                        )}
                      </p>

                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-subtle">
                        <span>{formatOrderDateTime(entry.created_at, locale, t)}</span>
                        <span aria-hidden="true" className="text-line">
                          •
                        </span>
                        <span className="rounded-full bg-white/70 px-2 py-0.5 font-medium text-muted ring-1 ring-inset ring-line/50">
                          {actor}
                        </span>
                      </div>

                      {entry.note ? (
                        <p className="mt-1.5 whitespace-pre-line rounded-lg bg-white/55 px-2.5 py-1.5 text-xs leading-relaxed text-muted ring-1 ring-inset ring-line/40">
                          {entry.note}
                        </p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          </OrderSection>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <OrderSection
            accent="sky"
            icon={<FiUser aria-hidden="true" className="h-4 w-4" />}
            title={t('orderDetails')}
            hint={t('orderDetailsHint')}
            contentClassName="px-4 pb-4 sm:px-5 sm:pb-5"
          >
            <dl className="space-y-3.5 text-sm">
              <div>
                <dt className={MICRO_LABEL}>{t('contact')}</dt>
                <dd className="mt-1 font-medium text-ink">
                  {order.customer_name}
                  {order.company_name ? ` · ${order.company_name}` : ''}
                </dd>
                <dd>
                  <a
                    href={`tel:${order.phone}`}
                    className="rounded text-primary hover:text-primary-hover hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {order.phone}
                  </a>
                </dd>
                {order.email ? (
                  <dd>
                    <a
                      href={`mailto:${order.email}`}
                      className="break-all text-muted hover:text-primary hover:underline"
                    >
                      {order.email}
                    </a>
                  </dd>
                ) : null}
              </div>

              {order.customer_note ? (
                <div>
                  <dt className={MICRO_LABEL}>{t('yourNote')}</dt>
                  <dd className="mt-1 whitespace-pre-line rounded-lg bg-white/55 px-2.5 py-2 leading-relaxed text-ink ring-1 ring-inset ring-line/40">
                    {order.customer_note}
                  </dd>
                </div>
              ) : null}
            </dl>
          </OrderSection>

          {order.quotation ? (
            <OrderSection
              accent="violet"
              icon={<FiFileText aria-hidden="true" className="h-4 w-4" />}
              title={t('sourceQuotation')}
              hint={t('sourceQuotationHint')}
            >
              <p className="font-mono text-sm font-semibold text-ink">
                {order.quotation.quotation_number}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {t('versionAccepted', {
                  version: order.quotation.version,
                  date: formatOrderDateTime(order.quotation.accepted_at, locale, t),
                })}
              </p>
              <Link to={`/quotations/${order.quotation_request_id}`} className={`${linkClass} mt-3`}>
                {t('viewQuotation')}
              </Link>
            </OrderSection>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
