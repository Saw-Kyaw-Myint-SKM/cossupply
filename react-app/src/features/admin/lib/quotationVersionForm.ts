/**
 * Pure helpers for the Admin quotation version builder (Task 07).
 *
 * The form keeps every number as a string while the Admin types. This module
 * converts the state into the API payload (server owns real totals) and
 * provides a transparent local preview of the same formulas.
 */
import type {
  AdminQuotationRequest,
  QuotationVersion,
  QuotationVersionInput,
} from '../api/quotationAdminApi';

export interface VersionLineState {
  key: string;
  product_id: number;
  product_name: string;
  specification: string;
  sku: string | null;
  supplier_name: string | null;
  quantity: string;
  unit_price: string;
  discount: string;
  delivery_date: string;
  warranty_note: string;
  supplier_note: string;
}

export interface VersionFormState {
  items: VersionLineState[];
  discount: string;
  delivery_fee: string;
  service_fee_percentage: string;
  payment_terms: string;
  valid_until: string;
  admin_note: string;
}

export interface TotalsPreview {
  lineTotals: number[];
  subtotal: number;
  service_fee: number;
  total_amount: number;
}

export const DEFAULT_COD_TERMS = 'Full payment on delivery (COD).';

export function todayISODate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function addDaysISODate(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);

  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function parseWhole(value: string): number {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

export function createVersionFormState(
  request: AdminQuotationRequest,
  serviceFeeDefault: number,
  validityDays: number,
): VersionFormState {
  return {
    items: request.items.map((item, index) => ({
      key: `${item.product_id}-${index}`,
      product_id: item.product_id,
      product_name: item.product_name_snapshot,
      specification: item.specification_snapshot ?? '',
      sku: item.sku ?? null,
      supplier_name: item.supplier?.shop_name ?? null,
      quantity: String(item.quantity),
      unit_price: item.display_price !== null ? String(item.display_price) : '',
      discount: '0',
      delivery_date: '',
      warranty_note: '',
      supplier_note: '',
    })),
    discount: '0',
    delivery_fee: '0',
    service_fee_percentage: String(serviceFeeDefault),
    payment_terms: DEFAULT_COD_TERMS,
    valid_until: addDaysISODate(validityDays),
    admin_note: '',
  };
}

export function editVersionFormState(quotation: QuotationVersion): VersionFormState {
  return {
    items: quotation.items.map((item, index) => ({
      key: `${item.product_id ?? 'free'}-${item.id}-${index}`,
      product_id: item.product_id ?? 0,
      product_name: item.product_name_snapshot,
      specification: item.specification_snapshot ?? '',
      sku: item.sku_snapshot,
      supplier_name: item.supplier?.shop_name ?? null,
      quantity: String(item.quantity),
      unit_price: String(item.unit_price),
      discount: String(item.discount),
      delivery_date: item.delivery_date ?? '',
      warranty_note: item.warranty_note ?? '',
      supplier_note: item.supplier_note ?? '',
    })),
    discount: String(quotation.discount),
    delivery_fee: String(quotation.delivery_fee),
    service_fee_percentage: String(quotation.service_fee_percentage),
    payment_terms: quotation.payment_terms,
    valid_until: quotation.valid_until,
    admin_note: quotation.admin_note ?? '',
  };
}

export function buildVersionPayload(state: VersionFormState): QuotationVersionInput {
  return {
    items: state.items.map((item) => ({
      product_id: item.product_id,
      quantity: parseWhole(item.quantity),
      unit_price: parseWhole(item.unit_price),
      discount: parseWhole(item.discount),
      delivery_date: item.delivery_date.trim() || null,
      warranty_note: item.warranty_note.trim() || null,
      supplier_note: item.supplier_note.trim() || null,
    })),
    discount: parseWhole(state.discount),
    delivery_fee: parseWhole(state.delivery_fee),
    service_fee_percentage: parseWhole(state.service_fee_percentage),
    payment_terms: state.payment_terms.trim() || DEFAULT_COD_TERMS,
    valid_until: state.valid_until,
    admin_note: state.admin_note.trim() || null,
  };
}

export function previewTotals(state: VersionFormState): TotalsPreview {
  const lineTotals = state.items.map((item) => {
    const gross = parseWhole(item.quantity) * parseWhole(item.unit_price);
    return Math.max(gross - parseWhole(item.discount), 0);
  });

  const subtotal = lineTotals.reduce((sum, value) => sum + value, 0);
  const percentage = parseWhole(state.service_fee_percentage);
  const serviceFee = Math.round((subtotal * percentage) / 100);
  const total =
    subtotal - parseWhole(state.discount) + parseWhole(state.delivery_fee) + serviceFee;

  return {
    lineTotals,
    subtotal,
    service_fee: serviceFee,
    total_amount: total,
  };
}

/**
 * First local problem that should block a save. Server validation remains
 * authoritative, but this catches the common "empty price" case early.
 */
export function localVersionError(state: VersionFormState): string | null {
  if (state.items.length === 0) {
    return 'Keep at least one item in the quotation.';
  }

  for (const item of state.items) {
    if (parseWhole(item.quantity) < 1) {
      return `Enter a quantity of at least 1 for ${item.product_name}.`;
    }
    if (item.unit_price.trim() === '') {
      return `Enter a confirmed unit price for ${item.product_name}.`;
    }
    if (parseWhole(item.unit_price) < 0) {
      return `The unit price for ${item.product_name} cannot be negative.`;
    }
    if (parseWhole(item.discount) < 0) {
      return `The discount for ${item.product_name} cannot be negative.`;
    }
    if (parseWhole(item.discount) > parseWhole(item.quantity) * parseWhole(item.unit_price)) {
      return `The discount for ${item.product_name} cannot exceed the line value.`;
    }
    if (item.delivery_date.trim() !== '' && item.delivery_date < todayISODate()) {
      return `The delivery date for ${item.product_name} cannot be in the past.`;
    }
  }

  if (parseWhole(state.discount) > previewTotals(state).subtotal) {
    return 'The quotation discount cannot exceed the subtotal.';
  }

  if (state.service_fee_percentage.trim() === '') {
    return 'Enter a service fee percentage (use 0 for no service fee).';
  }

  const percentage = parseWhole(state.service_fee_percentage);
  if (percentage < 0 || percentage > 100) {
    return 'The service fee percentage must be between 0 and 100.';
  }

  if (state.valid_until.trim() === '') {
    return 'Choose a validity date.';
  }

  if (state.valid_until < todayISODate()) {
    return 'The validity date cannot be in the past.';
  }

  return null;
}
