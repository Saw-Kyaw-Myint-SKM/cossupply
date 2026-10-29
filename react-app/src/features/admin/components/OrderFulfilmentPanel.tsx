/**
 * Admin delivery and COD fulfilment panel (Task 10).
 *
 * Delivery is full-only: the admin walks the order through
 * READY_TO_SHIP → OUT_FOR_DELIVERY → DELIVERED, or records a failed/returned
 * delivery. Cash collection is accepted only after full delivery and must
 * equal `amount_due`; payment confirmation completes the order. All actions
 * return the refreshed order so the status trail and receipt stay canonical.
 */
import { useState, type FormEvent } from 'react';
import {
  FiAlertTriangle,
  FiCheck,
  FiCreditCard,
  FiDownload,
  FiTruck,
  FiXCircle,
} from 'react-icons/fi';
import {
  Alert,
  describeRequestError,
  formatStatusLabel,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
  textareaClass,
} from '../../../components/catalog-ui/CatalogUi';
import { formatMMK } from '../../../lib/money';
import {
  collectCash,
  confirmCashPayment,
  downloadOrderReceipt,
  recordCustomerRefusal,
  updateDeliveryStatus,
  type DeliveryWorkflowStatus,
  type RefusalDeliveryOutcome,
} from '../api/orderAdminApi';
import type { OrderDetail } from '../../orders/api/ordersApi';
import { saveDownloadedFile } from '../../../lib/downloadFile';

type Panel =
  | { kind: 'delivery'; target: DeliveryWorkflowStatus }
  | { kind: 'cash' }
  | { kind: 'confirm' }
  | { kind: 'refused' }
  | null;

interface DeliveryAction {
  target: DeliveryWorkflowStatus;
  label: string;
  danger?: boolean;
}

interface Props {
  order: OrderDetail;
  onOrderUpdated: (order: OrderDetail) => void;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
}

function deliveryActions(order: OrderDetail): DeliveryAction[] {
  switch (order.order_status) {
    case 'PREPARING':
      return [{ target: 'READY_TO_SHIP', label: 'Mark ready to ship' }];
    case 'READY_TO_SHIP':
      return [{ target: 'OUT_FOR_DELIVERY', label: 'Dispatch for delivery' }];
    case 'OUT_FOR_DELIVERY':
      return [
        { target: 'DELIVERED', label: 'Delivered in full' },
        { target: 'DELIVERY_FAILED', label: 'Delivery failed', danger: true },
        { target: 'RETURNED', label: 'Return order', danger: true },
      ];
    case 'DELIVERY_FAILED':
      return [
        { target: 'READY_TO_SHIP', label: 'Prepare re-delivery' },
        { target: 'RETURNED', label: 'Return order', danger: true },
      ];
    case 'DELIVERED':
      return [{ target: 'RETURNED', label: 'Return order', danger: true }];
    default:
      return [];
  }
}

function panelTitle(panel: Panel): string {
  if (!panel) return '';
  if (panel.kind === 'cash') return 'Record full cash collection';
  if (panel.kind === 'confirm') return 'Verify and confirm payment';
  if (panel.kind === 'refused') return 'Record customer refusal';
  switch (panel.target) {
    case 'READY_TO_SHIP':
      return 'Mark ready to ship?';
    case 'OUT_FOR_DELIVERY':
      return 'Dispatch this order?';
    case 'DELIVERED':
      return 'Confirm full delivery?';
    case 'DELIVERY_FAILED':
      return 'Record a failed delivery?';
    case 'RETURNED':
      return 'Return this order?';
    default:
      return 'Update delivery?';
  }
}

export default function OrderFulfilmentPanel({
  order,
  onOrderUpdated,
  onNotice,
  onError,
}: Props) {
  const payment = order.cash_payment;
  const delivery = order.delivery;

  const [panel, setPanel] = useState<Panel>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [note, setNote] = useState('');
  const [receivedBy, setReceivedBy] = useState('');
  const [partner, setPartner] = useState('');
  const [tracking, setTracking] = useState('');
  const [amount, setAmount] = useState('');
  const [receiver, setReceiver] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [outcome, setOutcome] = useState<RefusalDeliveryOutcome>('DELIVERY_FAILED');
  const [responsible, setResponsible] = useState('');

  const [downloading, setDownloading] = useState(false);

  const actions = deliveryActions(order);
  const canCollect =
    order.order_status === 'DELIVERED' &&
    (payment?.status === 'CASH_COLLECTION_PENDING' || payment?.status === 'NOT_PAID');
  const canConfirm =
    order.order_status === 'DELIVERED' && payment?.status === 'CASH_COLLECTED';
  const canRefuse =
    order.order_status === 'OUT_FOR_DELIVERY' &&
    (payment?.status === 'CASH_COLLECTION_PENDING' || payment?.status === 'NOT_PAID');
  const canDownloadReceipt = payment?.receipt_available === true;

  const reset = () => {
    setPanel(null);
    setError(null);
    setNote('');
    setReceivedBy('');
    setPartner('');
    setTracking('');
    setAmount('');
    setReceiver('');
    setReceiptNumber('');
    setOutcome('DELIVERY_FAILED');
    setResponsible('');
  };

  const openDelivery = (target: DeliveryWorkflowStatus) => {
    reset();
    setPanel({ kind: 'delivery', target });
    if (target === 'DELIVERED') {
      setReceivedBy(delivery?.received_by ?? delivery?.delivery_contact_name ?? '');
    }
  };

  const openCash = () => {
    reset();
    setPanel({ kind: 'cash' });
    setAmount(payment ? String(payment.amount_due) : '');
    setReceiver(payment?.received_by ?? '');
    setReceiptNumber(payment?.receipt_number ?? '');
  };

  const openConfirm = () => {
    reset();
    setPanel({ kind: 'confirm' });
  };

  const openRefused = () => {
    reset();
    setPanel({ kind: 'refused' });
    setOutcome('DELIVERY_FAILED');
  };

  const succeed = (updated: OrderDetail, message: string) => {
    onOrderUpdated(updated);
    onNotice(message);
    reset();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!panel) return;

    const trimmedNote = note.trim();
    setBusy(true);
    setError(null);

    if (panel.kind === 'delivery') {
      if (
        (panel.target === 'DELIVERY_FAILED' || panel.target === 'RETURNED') &&
        trimmedNote.length < 3
      ) {
        setError('Explain why the delivery failed or was returned.');
        setBusy(false);
        return;
      }

      if (panel.target === 'DELIVERED' && receivedBy.trim().length < 2) {
        setError('Record who received the full delivery.');
        setBusy(false);
        return;
      }

      const response = await updateDeliveryStatus(order.id, {
        status: panel.target,
        note: trimmedNote,
        received_by: receivedBy,
        delivery_partner: partner,
        tracking_number: tracking,
      });

      if (response.success && response.data) {
        succeed(
          response.data.order,
          panel.target === 'DELIVERED'
            ? 'Full delivery recorded. Record the cash collection next.'
            : 'Delivery status updated.',
        );
      } else {
        setError(describeRequestError(response, 'Could not update the delivery status.'));
      }

      setBusy(false);
      return;
    }

    if (panel.kind === 'cash') {
      const collected = Number(amount);

      if (!Number.isInteger(collected) || collected < 1) {
        setError('Enter the cash amount as a whole number of MMK.');
        setBusy(false);
        return;
      }

      if (payment && collected !== payment.amount_due) {
        setError(
          `Full payment only: collect exactly ${formatMMK(payment.amount_due)} MMK.`,
        );
        setBusy(false);
        return;
      }

      if (receiver.trim().length < 2) {
        setError('Record who received the cash.');
        setBusy(false);
        return;
      }

      const response = await collectCash(order.id, {
        amount_collected: collected,
        received_by: receiver,
        receipt_number: receiptNumber,
        note: trimmedNote,
      });

      if (response.success && response.data) {
        succeed(
          response.data.order,
          'Cash collection recorded. The receipt is ready to download.',
        );
      } else {
        setError(describeRequestError(response, 'Could not record the cash collection.'));
      }

      setBusy(false);
      return;
    }

    if (panel.kind === 'confirm') {
      const response = await confirmCashPayment(order.id, trimmedNote);

      if (response.success && response.data) {
        succeed(response.data.order, 'Payment confirmed. The order is COMPLETED.');
      } else {
        setError(describeRequestError(response, 'Could not confirm the payment.'));
      }

      setBusy(false);
      return;
    }

    if (responsible.trim().length < 2) {
      setError('Record the admin or receiver who handled the refusal.');
      setBusy(false);
      return;
    }

    if (trimmedNote.length < 3) {
      setError('Explain why the customer refused to pay.');
      setBusy(false);
      return;
    }

    const response = await recordCustomerRefusal(order.id, {
      delivery_outcome: outcome,
      responsible_person: responsible,
      note: trimmedNote,
    });

    if (response.success && response.data) {
      succeed(
        response.data.order,
        'Customer refusal recorded with the delivery outcome.',
      );
    } else {
      setError(describeRequestError(response, 'Could not record the payment refusal.'));
    }

    setBusy(false);
  };

  const downloadReceipt = async () => {
    setDownloading(true);
    onError('');

    const response = await downloadOrderReceipt(order.id);

    if (response.success && response.data) {
      saveDownloadedFile(response.data);
    } else {
      onError(response.message ?? 'The receipt could not be downloaded.');
    }

    setDownloading(false);
  };

  return (
    <>
      <section
        className="rounded-lg border border-rule bg-plate p-4"
        aria-label="Delivery actions"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <FiTruck aria-hidden="true" className="h-4 w-4 text-gray-400" />
            Delivery workflow
          </h2>
          {delivery ? (
            <span className="text-xs text-gray-600">
              {formatStatusLabel(delivery.delivery_status)}
            </span>
          ) : null}
        </div>

        {actions.length > 0 ? (
          <div className="mt-3 space-y-2">
            {actions.map((action) => (
              <button
                key={action.target}
                type="button"
                onClick={() => openDelivery(action.target)}
                className={
                  action.danger
                    ? 'inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-red-300 bg-plate px-4 py-1.5 text-sm font-semibold text-red-700 shadow-sm hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'
                    : `${secondaryButtonClass} w-full`
                }
              >
                {action.danger ? (
                  <FiXCircle aria-hidden="true" className="h-4 w-4" />
                ) : (
                  <FiCheck aria-hidden="true" className="h-4 w-4" />
                )}
                {action.label}
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-gray-600">
            No delivery action is available for this order.
          </p>
        )}

        {panel?.kind === 'delivery' ? (
          <form className="mt-3 border-t border-rule pt-3" onSubmit={(event) => void submit(event)}>
            <p className="text-sm font-semibold text-ink">{panelTitle(panel)}</p>

            {panel.target === 'OUT_FOR_DELIVERY' ? (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div>
                  <label htmlFor="delivery-partner" className="block text-xs font-medium text-ink">
                    Delivery partner (optional)
                  </label>
                  <input
                    id="delivery-partner"
                    type="text"
                    value={partner}
                    onChange={(event) => setPartner(event.target.value)}
                    className={`${inputClass(false)} mt-1 w-full`}
                    placeholder="e.g. Royal Express"
                  />
                </div>
                <div>
                  <label htmlFor="tracking-number" className="block text-xs font-medium text-ink">
                    Tracking number (optional)
                  </label>
                  <input
                    id="tracking-number"
                    type="text"
                    value={tracking}
                    onChange={(event) => setTracking(event.target.value)}
                    className={`${inputClass(false)} mt-1 w-full`}
                    placeholder="e.g. TRK-9012"
                  />
                </div>
              </div>
            ) : null}

            {panel.target === 'DELIVERED' ? (
              <div className="mt-2">
                <label htmlFor="delivery-received-by" className="block text-xs font-medium text-ink">
                  Received by<span className="text-red-600"> *</span>
                </label>
                <input
                  id="delivery-received-by"
                  type="text"
                  value={receivedBy}
                  onChange={(event) => setReceivedBy(event.target.value)}
                  required
                  minLength={2}
                  maxLength={255}
                  className={`${inputClass(false)} mt-1 w-full`}
                />
              </div>
            ) : null}

            <label htmlFor="delivery-note" className="mt-2 block text-xs font-medium text-ink">
              Note
              {panel.target === 'DELIVERY_FAILED' || panel.target === 'RETURNED' ? (
                <span className="text-red-600"> *</span>
              ) : (
                ' (optional)'
              )}
            </label>
            <textarea
              id="delivery-note"
              rows={2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              minLength={
                panel.target === 'DELIVERY_FAILED' || panel.target === 'RETURNED' ? 3 : undefined
              }
              required={panel.target === 'DELIVERY_FAILED' || panel.target === 'RETURNED'}
              maxLength={2000}
              className={`${textareaClass} mt-1`}
              placeholder={
                panel.target === 'DELIVERY_FAILED'
                  ? 'e.g. Customer was not at home.'
                  : panel.target === 'RETURNED'
                    ? 'e.g. Customer rejected the goods at the door.'
                    : 'Optional note for the status history.'
              }
            />

            <div className="mt-3 flex flex-wrap gap-2">
              <button type="submit" disabled={busy} className={primaryButtonClass}>
                {busy ? 'Saving…' : 'Save delivery step'}
              </button>
              <button type="button" onClick={reset} disabled={busy} className={secondaryButtonClass}>
                Cancel
              </button>
            </div>

            {error ? (
              <div className="mt-3">
                <Alert tone="error">
                  <p>{error}</p>
                </Alert>
              </div>
            ) : null}
          </form>
        ) : null}
      </section>

      <section
        className="rounded-lg border border-rule bg-plate p-4"
        aria-label="Cash collection actions"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <FiCreditCard aria-hidden="true" className="h-4 w-4 text-gray-400" />
            COD collection
          </h2>
          {payment ? (
            <span className="text-xs text-gray-600">{formatStatusLabel(payment.status)}</span>
          ) : null}
        </div>

        {payment ? (
          <dl className="mt-3 space-y-1 text-xs">
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Amount due</dt>
              <dd className="font-mono tabular-nums text-ink">{formatMMK(payment.amount_due)} MMK</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Collected</dt>
              <dd className="font-mono tabular-nums text-ink">
                {formatMMK(payment.amount_collected)} MMK
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Remaining</dt>
              <dd className="font-mono tabular-nums text-ink">
                {formatMMK(payment.amount_remaining)} MMK
              </dd>
            </div>
          </dl>
        ) : null}

        <div className="mt-3 space-y-2">
          {canCollect ? (
            <button type="button" onClick={openCash} className={`${primaryButtonClass} w-full`}>
              Record cash collection
            </button>
          ) : null}
          {canConfirm ? (
            <button type="button" onClick={openConfirm} className={`${primaryButtonClass} w-full`}>
              Verify and confirm payment
            </button>
          ) : null}
          {canRefuse ? (
            <button
              type="button"
              onClick={openRefused}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-red-300 bg-plate px-4 py-1.5 text-sm font-semibold text-red-700 shadow-sm hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FiAlertTriangle aria-hidden="true" className="h-4 w-4" />
              Customer refused to pay
            </button>
          ) : null}
          {canDownloadReceipt ? (
            <button
              type="button"
              onClick={() => void downloadReceipt()}
              disabled={downloading}
              className={`${secondaryButtonClass} w-full`}
            >
              <FiDownload aria-hidden="true" className="mr-1.5 h-4 w-4" />
              {downloading ? 'Downloading…' : 'Download receipt'}
            </button>
          ) : null}
          {!canCollect && !canConfirm && !canRefuse && !canDownloadReceipt ? (
            <p className="text-sm text-gray-600">
              No cash action is available until the order is out for delivery or delivered.
            </p>
          ) : null}
        </div>

        {panel?.kind === 'cash' ? (
          <form className="mt-3 border-t border-rule pt-3" onSubmit={(event) => void submit(event)}>
            <p className="text-sm font-semibold text-ink">{panelTitle(panel)}</p>
            <p className="mt-1 text-xs text-gray-600">
              Full payment only. The amount must equal the amount due.
            </p>

            <label htmlFor="cash-amount" className="mt-2 block text-xs font-medium text-ink">
              Amount collected (MMK)<span className="text-red-600"> *</span>
            </label>
            <input
              id="cash-amount"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
              className={`${inputClass(false)} mt-1 w-full font-mono tabular-nums`}
            />

            <label htmlFor="cash-receiver" className="mt-2 block text-xs font-medium text-ink">
              Received by<span className="text-red-600"> *</span>
            </label>
            <input
              id="cash-receiver"
              type="text"
              value={receiver}
              onChange={(event) => setReceiver(event.target.value)}
              required
              minLength={2}
              maxLength={255}
              className={`${inputClass(false)} mt-1 w-full`}
              placeholder="Admin or receiver name"
            />

            <label htmlFor="cash-receipt" className="mt-2 block text-xs font-medium text-ink">
              Receipt number
            </label>
            <input
              id="cash-receipt"
              type="text"
              value={receiptNumber}
              onChange={(event) => setReceiptNumber(event.target.value)}
              maxLength={100}
              className={`${inputClass(false)} mt-1 w-full font-mono`}
            />

            <label htmlFor="cash-note" className="mt-2 block text-xs font-medium text-ink">
              Note (optional)
            </label>
            <textarea
              id="cash-note"
              rows={2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={2000}
              className={`${textareaClass} mt-1`}
            />

            <div className="mt-3 flex flex-wrap gap-2">
              <button type="submit" disabled={busy} className={primaryButtonClass}>
                {busy ? 'Saving…' : 'Record collection'}
              </button>
              <button type="button" onClick={reset} disabled={busy} className={secondaryButtonClass}>
                Cancel
              </button>
            </div>
          </form>
        ) : null}

        {panel?.kind === 'confirm' ? (
          <form className="mt-3 border-t border-rule pt-3" onSubmit={(event) => void submit(event)}>
            <p className="text-sm font-semibold text-ink">{panelTitle(panel)}</p>
            <p className="mt-1 text-xs text-gray-600">
              Confirming completes the delivered order and keeps the receipt available.
            </p>

            <label htmlFor="confirm-note" className="mt-2 block text-xs font-medium text-ink">
              Note (optional)
            </label>
            <textarea
              id="confirm-note"
              rows={2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={2000}
              className={`${textareaClass} mt-1`}
              placeholder="e.g. Cash counted and verified against the receipt."
            />

            <div className="mt-3 flex flex-wrap gap-2">
              <button type="submit" disabled={busy} className={primaryButtonClass}>
                {busy ? 'Confirming…' : 'Confirm payment'}
              </button>
              <button type="button" onClick={reset} disabled={busy} className={secondaryButtonClass}>
                Cancel
              </button>
            </div>
          </form>
        ) : null}

        {panel?.kind === 'refused' ? (
          <form className="mt-3 border-t border-rule pt-3" onSubmit={(event) => void submit(event)}>
            <p className="text-sm font-semibold text-ink">{panelTitle(panel)}</p>

            <label htmlFor="refusal-outcome" className="mt-2 block text-xs font-medium text-ink">
              Delivery outcome<span className="text-red-600"> *</span>
            </label>
            <select
              id="refusal-outcome"
              value={outcome}
              onChange={(event) => setOutcome(event.target.value as RefusalDeliveryOutcome)}
              className={`${inputClass(false)} mt-1 w-full`}
            >
              <option value="DELIVERY_FAILED">Delivery failed</option>
              <option value="RETURNED">Returned</option>
            </select>

            <label htmlFor="refusal-responsible" className="mt-2 block text-xs font-medium text-ink">
              Responsible person<span className="text-red-600"> *</span>
            </label>
            <input
              id="refusal-responsible"
              type="text"
              value={responsible}
              onChange={(event) => setResponsible(event.target.value)}
              required
              minLength={2}
              maxLength={255}
              className={`${inputClass(false)} mt-1 w-full`}
            />

            <label htmlFor="refusal-note" className="mt-2 block text-xs font-medium text-ink">
              Note<span className="text-red-600"> *</span>
            </label>
            <textarea
              id="refusal-note"
              rows={2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              required
              minLength={3}
              maxLength={2000}
              className={`${textareaClass} mt-1`}
              placeholder="Why did the customer refuse to pay?"
            />

            <div className="mt-3 flex flex-wrap gap-2">
              <button type="submit" disabled={busy} className={primaryButtonClass}>
                {busy ? 'Saving…' : 'Record refusal'}
              </button>
              <button type="button" onClick={reset} disabled={busy} className={secondaryButtonClass}>
                Cancel
              </button>
            </div>
          </form>
        ) : null}

        {error && panel !== null && panel.kind !== 'delivery' ? (
          <div className="mt-3">
            <Alert tone="error">
              <p>{error}</p>
            </Alert>
          </div>
        ) : null}
      </section>
    </>
  );
}
