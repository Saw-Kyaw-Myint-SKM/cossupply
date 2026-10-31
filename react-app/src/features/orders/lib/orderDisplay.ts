/**
 * Shared presentation helpers for customer and admin order views (Task 09).
 *
 * The order payload is a frozen snapshot: these helpers only format what the
 * server already calculated. No money value is ever derived in the browser.
 */
import { translate } from '../../../lib/i18n-context';
import type { Locale, TranslationKey, Translator } from '../../../lib/i18n-context';

const DATE_LOCALES: Record<Locale, string> = {
  en: 'en-US',
  my: 'my-MM',
};

const ORDER_STATUS_LABEL_KEYS: Record<string, TranslationKey> = {
  SUPPLIER_CONFIRMATION_REQUIRED: 'supplierConfirmationRequired',
  ORDER_CONFIRMED: 'statusOrderConfirmed',
  PREPARING: 'statusPreparing',
  READY_TO_SHIP: 'statusReadyToShip',
  OUT_FOR_DELIVERY: 'statusOutForDelivery',
  DELIVERED: 'statusDelivered',
  COMPLETED: 'statusCompleted',
  SUPPLIER_UNAVAILABLE: 'statusSupplierUnavailable',
  DELIVERY_FAILED: 'statusDeliveryFailed',
  RETURNED: 'statusReturned',
  CANCELLED: 'statusCancelled',
};

const englishTranslator: Translator = (key, values) => translate('en', key, values);

function unknownStatusLabel(status: string): string {
  const spaced = status.replace(/_/g, ' ').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function formatOrderDate(
  value: string | null | undefined,
  locale: Locale = 'en',
  t: Translator = englishTranslator,
): string {
  if (!value) return t('statusNoValue');

  // A date-only value (YYYY-MM-DD) is parsed as local time so the displayed
  // day never shifts because of a UTC offset.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);

    return new Date(year, month - 1, day).toLocaleDateString(DATE_LOCALES[locale], {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  return new Date(value).toLocaleDateString(DATE_LOCALES[locale], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatOrderDateTime(
  value: string | null | undefined,
  locale: Locale = 'en',
  t: Translator = englishTranslator,
): string {
  if (!value) return t('statusNoValue');

  return new Date(value).toLocaleString(DATE_LOCALES[locale], {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function paymentMethodLabel(value: string | null, t: Translator = englishTranslator): string {
  if (!value) return t('statusNoValue');

  if (value === 'CASH_ON_DELIVERY') return t('cashOnDelivery');
  return t('statusUnknown', { status: unknownStatusLabel(value) });
}

export function orderStatusLabel(status: string, t: Translator = englishTranslator): string {
  const key = ORDER_STATUS_LABEL_KEYS[status];
  return key ? t(key) : t('statusUnknown', { status: unknownStatusLabel(status) });
}

/** Statuses an admin may cancel from (mirrors the server transition map). */
export const CANCELLABLE_ORDER_STATUSES = [
  'SUPPLIER_CONFIRMATION_REQUIRED',
  'ORDER_CONFIRMED',
  'PREPARING',
  'READY_TO_SHIP',
  'DELIVERY_FAILED',
];

export function canCancelOrder(status: string): boolean {
  return CANCELLABLE_ORDER_STATUSES.includes(status);
}

/**
 * Plain-language explanation of what the current order status means for the
 * customer. Unknown values fall back to a neutral sentence.
 */
export function orderStatusHint(status: string, t: Translator = englishTranslator): string {
  switch (status) {
    case 'SUPPLIER_CONFIRMATION_REQUIRED':
      return t('orderStatusSupplierConfirmation');
    case 'ORDER_CONFIRMED':
      return t('orderStatusConfirmed');
    case 'PREPARING':
      return t('orderStatusPreparing');
    case 'READY_TO_SHIP':
      return t('orderStatusReadyToShip');
    case 'OUT_FOR_DELIVERY':
      return t('orderStatusOutForDelivery');
    case 'DELIVERED':
      return t('orderStatusDelivered');
    case 'COMPLETED':
      return t('orderStatusCompleted');
    case 'SUPPLIER_UNAVAILABLE':
      return t('orderStatusSupplierUnavailable');
    case 'DELIVERY_FAILED':
      return t('orderStatusDeliveryFailed');
    case 'RETURNED':
      return t('orderStatusReturned');
    case 'CANCELLED':
      return t('orderStatusCancelled');
    default:
      return t('orderStatusDefault');
  }
}

/** Orders that are still moving through the workflow. */
export const OPEN_ORDER_STATUSES = [
  'SUPPLIER_CONFIRMATION_REQUIRED',
  'ORDER_CONFIRMED',
  'PREPARING',
  'READY_TO_SHIP',
  'OUT_FOR_DELIVERY',
];

export function isOpenOrderStatus(status: string): boolean {
  return OPEN_ORDER_STATUSES.includes(status);
}
