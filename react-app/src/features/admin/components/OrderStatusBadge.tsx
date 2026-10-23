/**
 * Status pill for the Admin order surface (Task 09).
 *
 * Order, payment, and delivery share the same semantic tone system but read
 * from different vocabularies, so the badge takes the kind explicitly. Text is
 * always present; colour is never the only signal.
 */
import {
  ORDER_STATUS_TONE_CLASSES,
  deliveryStatusLabel,
  deliveryStatusTone,
  orderStatusLabel,
  orderStatusTone,
  paymentStatusLabel,
  paymentStatusTone,
} from '../lib/orderStatus';

type BadgeKind = 'order' | 'payment' | 'delivery';

const LABELERS: Record<BadgeKind, (status: string | null | undefined) => string> = {
  order: orderStatusLabel,
  payment: paymentStatusLabel,
  delivery: deliveryStatusLabel,
};

const TONERS: Record<BadgeKind, (status: string | null | undefined) => string> = {
  order: (status) => ORDER_STATUS_TONE_CLASSES[orderStatusTone(status)],
  payment: (status) => ORDER_STATUS_TONE_CLASSES[paymentStatusTone(status)],
  delivery: (status) => ORDER_STATUS_TONE_CLASSES[deliveryStatusTone(status)],
};

export default function OrderStatusBadge({
  kind = 'order',
  status,
  className = '',
}: {
  kind?: BadgeKind;
  status: string | null | undefined;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
        TONERS[kind](status)
      } ${className}`}
    >
      {LABELERS[kind](status)}
    </span>
  );
}
