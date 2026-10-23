/**
 * Pure quotation request form helpers (Task 06).
 *
 * Shared by the request form page and its unit tests: the payload is built
 * from the browser cart's snapshot lines plus the request-time contact /
 * delivery fields, so "items derived from the cart" is one deterministic,
 * testable step. Nothing here touches the network or React state.
 */
import type { CustomerAddress, CustomerAddressInput } from '../../customer/api/addressesApi';
import type { QuotationRequestInput } from '../api/quotationsApi';
import type { CartItem } from '../../../lib/cart-storage';
import { quantityError } from '../../../lib/cart-storage';

export type AddressMode = 'saved' | 'manual';

/** Contact fields prefilled from the customer profile but editable. */
export interface QuotationContactState {
  name: string;
  phone: string;
  company_name: string;
  email: string;
}

/** Manual "use a different address" entry; all fields are strings in state. */
export interface ManualAddressState {
  contact_name: string;
  phone: string;
  city: string;
  township: string;
  ward: string;
  street: string;
  building_no: string;
  landmark: string;
  full_address: string;
}

export function emptyManualAddress(): ManualAddressState {
  return {
    contact_name: '',
    phone: '',
    city: '',
    township: '',
    ward: '',
    street: '',
    building_no: '',
    landmark: '',
    full_address: '',
  };
}

/**
 * Compose a readable full address from the optional part fields. Trimming and
 * filtering keeps stray separators ("#, , Yangon") out of the snapshot.
 */
export function composeFullAddress(
  parts: Pick<
    ManualAddressState,
    'building_no' | 'street' | 'ward' | 'township' | 'city' | 'landmark'
  >,
): string {
  const pieces = [parts.building_no, parts.street, parts.ward, parts.township, parts.city]
    .map((piece) => piece.trim())
    .filter((piece) => piece !== '');

  const base = pieces.join(', ');
  const landmark = parts.landmark.trim();
  return landmark !== '' ? `${base ? `${base} — ` : ''}Near ${landmark}` : base;
}

/**
 * Resolve the effective delivery address text: the buyer's typed
 * `full_address` when given, otherwise composed from the address parts (the
 * contract allows `full_address` to be composed in the UI).
 */
export function resolveManualFullAddress(manual: ManualAddressState): string {
  const typed = manual.full_address.trim();
  return typed !== '' ? typed : composeFullAddress(manual);
}

/**
 * Paste a saved address into the manual form ("prefills from defaults").
 * Every field is copied so switching to manual entry starts from the address
 * the buyer was about to use.
 */
export function prefillManualFromAddress(address: CustomerAddress | null): ManualAddressState {
  if (!address) return emptyManualAddress();

  return {
    contact_name: address.contact_name,
    phone: address.phone,
    city: address.city,
    township: address.township ?? '',
    ward: address.ward ?? '',
    street: address.street ?? '',
    building_no: address.building_no ?? '',
    landmark: address.landmark ?? '',
    full_address: address.full_address,
  };
}

/** Local date in YYYY-MM-DD (the contract's `required_delivery_date` format). */
export function todayISODate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** ISO date check: well-formed and today-or-later (YYYY-MM-DD sorts lexically). */
export function requiredDeliveryDateError(value: string): string | null {
  const date = value.trim();

  if (date === '') return null;
  if (!ISO_DATE_PATTERN.test(date)) return 'Enter a valid date (YYYY-MM-DD).';

  return date >= todayISODate() ? null : 'The required delivery date cannot be in the past.';
}

export interface BuildQuotationPayloadArgs {
  contact: QuotationContactState;
  /** Chosen saved address id, or null. */
  selectedAddressId: number | null;
  mode: AddressMode;
  manual: ManualAddressState;
  /** The saved-address list the picker rendered. */
  addresses: CustomerAddress[];
  items: CartItem[];
  requiredDeliveryDate: string;
  customerNote: string;
  /** "Save to my addresses" checkbox in manual mode. */
  saveToAddressBook: boolean;
}

export interface BuiltQuotationRequest {
  /** true when the request can be sent (and optionally the address saved). */
  ok: boolean;
  /** null while local validation failed; see `fieldErrors` / `itemErrors`. */
  payload: QuotationRequestInput | null;
  fieldErrors: Record<string, string[]>;
  /** Per-line cart problems, keyed like the server as `items.<n>.quantity`. */
  itemErrors: Array<{ key: string; message: string }>;
  /** Input to save to the address book, when the buyer asked for that. */
  addressInput: CustomerAddressInput | null;
  addressErrors: Record<string, string[]>;
}

/**
 * Split server validation errors into form fields and per-item lines
 * (`items.0.product_id`, `items.1.quantity`) so the page can show item
 * problems in the order-summary banner instead of on a missing field.
 */
export function splitServerErrors(errors: Record<string, string[]>): {
  fieldErrors: Record<string, string[]>;
  itemErrors: Array<{ key: string; message: string }>;
} {
  const fieldErrors: Record<string, string[]> = {};
  const itemErrors: Array<{ key: string; message: string }> = [];

  for (const [key, messages] of Object.entries(errors)) {
    if (key.startsWith('items.')) {
      itemErrors.push({ key, message: messages.join(' ') });
    } else {
      fieldErrors[key] = messages;
    }
  }

  return { fieldErrors, itemErrors };
}

/** Nested helper state for building either the request or the address input. */
type DeliveryResolution = {
  name: string;
  phone: string;
  city: string;
  township: string;
  landmark: string;
  deliveryAddress: string;
};

function resolveDelivery(args: BuildQuotationPayloadArgs, fieldErrors: Record<string, string[]>): DeliveryResolution {
  const name = args.contact.name.trim();
  if (name === '') fieldErrors.name = ['Your name is required.'];

  const phone = args.contact.phone.trim();
  if (phone === '') fieldErrors.phone = ['A contact phone number is required.'];

  const saved =
    args.mode === 'saved' && args.selectedAddressId !== null
      ? (args.addresses.find((address) => address.id === args.selectedAddressId) ?? null)
      : null;

  if (saved) {
    return {
      name,
      phone,
      city: saved.city,
      township: saved.township ?? '',
      landmark: saved.landmark ?? '',
      deliveryAddress: saved.full_address,
    };
  }

  const manualCity = args.manual.city.trim();
  if (manualCity === '') fieldErrors.city = ['The delivery city is required.'];

  const deliveryAddress = resolveManualFullAddress(args.manual);
  if (deliveryAddress === '') {
    fieldErrors.delivery_address = [
      'Enter the full delivery address or every address part needed to compose it.',
    ];
  }

  return {
    name,
    phone,
    city: manualCity,
    township: args.manual.township.trim(),
    landmark: args.manual.landmark.trim(),
    deliveryAddress,
  };
}

/**
 * Build the POST body for `POST /customer/quotation-requests` from the cart
 * snapshot lines and the request-time contact/delivery state.
 *
 * Local pre-checks mirror the server contract (MoneyAndValidationRules §5):
 * required contact fields, a resolvable delivery address, a date not before
 * today, and a whole-number quantity at or above each line's MOQ — the same
 * `quantityError` rule the cart page enforces before navigation.
 *
 * When `saveToAddressBook` is on (manual mode only), the same manual values
 * are prepared as an address book POST; its required fields are validated
 * into `addressErrors`, and `ok` stays false until those pass too — the
 * request must never be submitted with an unsavable address.
 */
export function buildQuotationRequestPayload(args: BuildQuotationPayloadArgs): BuiltQuotationRequest {
  const fieldErrors: Record<string, string[]> = {};
  const itemErrors: Array<{ key: string; message: string }> = [];

  const delivery = resolveDelivery(args, fieldErrors);

  const dateOption = args.requiredDeliveryDate.trim();
  const dateError = requiredDeliveryDateError(dateOption);
  if (dateError) fieldErrors.required_delivery_date = [dateError];

  args.items.forEach((item, index) => {
    const error = quantityError(item.quantity, item.minimum_order_quantity);
    if (error) {
      itemErrors.push({ key: `items.${index}.quantity`, message: error });
    }
  });

  const companyName = args.contact.company_name.trim();
  const email = args.contact.email.trim();

  const payload =
    Object.keys(fieldErrors).length === 0 && itemErrors.length === 0
      ? {
          items: args.items.map((item) => ({
            product_id: item.product_id,
            quantity: item.quantity,
          })),
          name: delivery.name,
          phone: delivery.phone,
          ...(companyName !== '' ? { company_name: companyName } : {}),
          ...(email !== '' ? { email } : {}),
          city: delivery.city,
          ...(delivery.township !== '' ? { township: delivery.township } : {}),
          delivery_address: delivery.deliveryAddress,
          ...(delivery.landmark !== '' ? { landmark: delivery.landmark } : {}),
          ...(dateOption !== '' ? { required_delivery_date: dateOption } : {}),
          ...(args.customerNote.trim() !== '' ? { customer_note: args.customerNote.trim() } : {}),
        }
      : null;

  let addressInput: CustomerAddressInput | null = null;
  const addressErrors: Record<string, string[]> = {};

  if (args.mode === 'manual' && args.saveToAddressBook) {
    const contactName = args.manual.contact_name.trim();
    const addressPhone = args.manual.phone.trim();
    const township = args.manual.township.trim();
    const fullAddress = resolveManualFullAddress(args.manual);

    if (contactName === '') addressErrors.contact_name = ['The contact person is required.'];
    if (addressPhone === '') addressErrors.phone = ['A phone number is required.'];
    if (township === '') addressErrors.township = ['The township is required for a saved address.'];
    if (fullAddress === '') {
      addressErrors.full_address = [
        'Enter the full address, or the address parts needed to compose it.',
      ];
    }

    if (Object.keys(addressErrors).length === 0) {
      const ward = args.manual.ward.trim();
      const street = args.manual.street.trim();
      const buildingNo = args.manual.building_no.trim();
      const landmark = args.manual.landmark.trim();

      addressInput = {
        contact_name: contactName,
        phone: addressPhone,
        city: args.manual.city.trim(),
        township,
        ...(ward !== '' ? { ward } : {}),
        ...(street !== '' ? { street } : {}),
        ...(buildingNo !== '' ? { building_no: buildingNo } : {}),
        ...(landmark !== '' ? { landmark } : {}),
        full_address: fullAddress,
      };
    }
  }

  const ok = payload !== null && (!args.saveToAddressBook || addressInput !== null);

  return { ok, payload, fieldErrors, itemErrors, addressInput, addressErrors };
}
