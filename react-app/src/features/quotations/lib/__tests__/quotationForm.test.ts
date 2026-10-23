/**
 * Unit tests for the pure quotation-request form helpers (Task 06):
 * payload shape with items derived from cart lines, local validation, and
 * address-book input preparation.
 */
import { describe, expect, it } from 'vitest';
import type { CustomerAddress } from '../../../customer/api/addressesApi';
import type { CartItem } from '../../../../lib/cart-storage';
import {
  buildQuotationRequestPayload,
  composeFullAddress,
  emptyManualAddress,
  prefillManualFromAddress,
  requiredDeliveryDateError,
  resolveManualFullAddress,
  splitServerErrors,
  todayISODate,
  type QuotationContactState,
} from '../quotationForm';

function line(overrides: Partial<CartItem> = {}): CartItem {
  return {
    product_id: 1,
    slug: 'plastic-chair',
    sku: 'CHAIR-001',
    name_mm: 'ပလတ်စတစ်ကုတ်အင်္ကျီ',
    name_en: 'Plastic Chair',
    unit: 'pcs',
    photo_url: null,
    supplier_id: 10,
    supplier_name: 'Yangon Trading',
    category_name: 'Furniture',
    unit_price: 5000,
    minimum_order_quantity: 2,
    stock_status: 'IN_STOCK',
    stock_quantity: 20,
    quantity: 2,
    ...overrides,
  };
}

function address(overrides: Partial<CustomerAddress> = {}): CustomerAddress {
  return {
    id: 7,
    contact_name: 'U Min',
    phone: '09-770-000-111',
    city: 'Yangon',
    township: 'Bahan',
    ward: 'Ward 12',
    street: 'Cypress Lane',
    building_no: 'No. 40',
    landmark: null,
    full_address: 'No. 40, Cypress Lane, Ward 12, Bahan, Yangon',
    is_default: false,
    ...overrides,
  };
}

const baseContact: QuotationContactState = {
  name: 'Daw Hla',
  phone: '09-770-100-200',
  company_name: 'Hla Trading',
  email: 'hla@example.com',
};

const baseArgs = () => ({
  contact: baseContact,
  selectedAddressId: 7,
  mode: 'saved' as const,
  manual: emptyManualAddress(),
  addresses: [address()],
  items: [line()],
  requiredDeliveryDate: '',
  customerNote: '',
  saveToAddressBook: false,
});

describe('composeFullAddress / resolveManualFullAddress', () => {
  it('joins the non-empty parts with separators', () => {
    expect(composeFullAddress(emptyManualAddress())).toBe('');
    expect(
      composeFullAddress({ ...emptyManualAddress(), city: 'Yangon', township: 'Bahan' }),
    ).toBe('Bahan, Yangon');
    expect(
      composeFullAddress({
        ...emptyManualAddress(),
        building_no: 'No. 40',
        street: 'Cypress Lane',
        ward: 'Ward 12',
        township: 'Bahan',
        city: 'Yangon',
        landmark: 'Station',
      }),
    ).toBe('No. 40, Cypress Lane, Ward 12, Bahan, Yangon — Near Station');
  });

  it('prefers the typed full address over the composition', () => {
    const manual = { ...emptyManualAddress(), city: 'Yangon', full_address: 'Gate 3, Dagon Port' };

    expect(resolveManualFullAddress(manual)).toBe('Gate 3, Dagon Port');
    expect(resolveManualFullAddress(emptyManualAddress())).toBe('');
  });
});

describe('prefillManualFromAddress', () => {
  it('copies every saved field into the manual form', () => {
    const manual = prefillManualFromAddress(
      address({ ward: null, building_no: null, landmark: 'Kandawgyi' }),
    );

    expect(manual).toEqual({
      contact_name: 'U Min',
      phone: '09-770-000-111',
      city: 'Yangon',
      township: 'Bahan',
      ward: '',
      street: 'Cypress Lane',
      building_no: '',
      landmark: 'Kandawgyi',
      full_address: 'No. 40, Cypress Lane, Ward 12, Bahan, Yangon',
    });
  });

  it('returns empty fields when there is nothing to prefill', () => {
    expect(prefillManualFromAddress(null)).toEqual(emptyManualAddress());
  });
});

describe('requiredDeliveryDateError / todayISODate', () => {
  it('allows blank and today-or-later ISO dates', () => {
    expect(requiredDeliveryDateError('')).toBeNull();
    expect(requiredDeliveryDateError(todayISODate())).toBeNull();
    expect(requiredDeliveryDateError('2099-12-31')).toBeNull();
  });

  it('rejects past dates and malformed input', () => {
    expect(requiredDeliveryDateError('2000-01-01')).toMatch(/cannot be in the past/);
    expect(requiredDeliveryDateError('31/12/2099')).toMatch(/YYYY-MM-DD/);
  });
});

describe('buildQuotationRequestPayload — saved address mode', () => {
  it('derives items and snapshots the request-time contact/delivery fields', () => {
    const built = buildQuotationRequestPayload({
      ...baseArgs(),
      items: [line(), line({ product_id: 2, quantity: 4, minimum_order_quantity: 2 })],
      requiredDeliveryDate: '2099-01-31',
      customerNote: 'Call before delivery',
    });

    expect(built.ok).toBe(true);
    expect(built.payload).toEqual({
      items: [
        { product_id: 1, quantity: 2 },
        { product_id: 2, quantity: 4 },
      ],
      name: 'Daw Hla',
      phone: '09-770-100-200',
      company_name: 'Hla Trading',
      email: 'hla@example.com',
      city: 'Yangon',
      township: 'Bahan',
      delivery_address: 'No. 40, Cypress Lane, Ward 12, Bahan, Yangon',
      required_delivery_date: '2099-01-31',
      customer_note: 'Call before delivery',
    });
  });

  it('omits empty optional fields instead of sending blank strings', () => {
    const built = buildQuotationRequestPayload({
      ...baseArgs(),
      contact: { name: 'Daw Hla', phone: '091', company_name: '', email: '' },
      requiredDeliveryDate: ' ',
      customerNote: ' ',
    });

    expect(built.payload).toEqual({
      items: [{ product_id: 1, quantity: 2 }],
      name: 'Daw Hla',
      phone: '091',
      city: 'Yangon',
      township: 'Bahan',
      delivery_address: 'No. 40, Cypress Lane, Ward 12, Bahan, Yangon',
    });
  });

  it('uses the chosen address, not just the first one', () => {
    const built = buildQuotationRequestPayload({
      ...baseArgs(),
      addresses: [
        address(),
        address({
          id: 9,
          city: 'Mandalay',
          township: 'Chanayethazan',
          full_address: 'No. 5, 86th St, Chanayethazan, Mandalay',
        }),
      ],
      selectedAddressId: 9,
    });

    expect(built.payload?.city).toBe('Mandalay');
    expect(built.payload?.delivery_address).toContain('Mandalay');
  });
});

describe('buildQuotationRequestPayload — manual mode', () => {
  it('sends the typed full address and manual city', () => {
    const built = buildQuotationRequestPayload({
      ...baseArgs(),
      mode: 'manual',
      selectedAddressId: null,
      manual: {
        contact_name: 'U Min',
        phone: '09-1',
        city: 'Mandalay',
        township: 'Pyigyitagon',
        ward: '',
        street: '86th St',
        building_no: '',
        landmark: '',
        full_address: 'Room B, 86th St, Pyigyitagon, Mandalay',
      },
    });

    expect(built.ok).toBe(true);
    expect(built.payload?.delivery_address).toBe('Room B, 86th St, Pyigyitagon, Mandalay');
    expect(built.payload?.city).toBe('Mandalay');
  });

  it('composes the delivery address from parts when full_address is blank', () => {
    const built = buildQuotationRequestPayload({
      ...baseArgs(),
      mode: 'manual',
      selectedAddressId: null,
      manual: {
        ...emptyManualAddress(),
        city: 'Mandalay',
        township: 'Pyigyitagon',
        street: '86th St',
      },
    });

    expect(built.payload?.delivery_address).toBe('86th St, Pyigyitagon, Mandalay');
  });

  it('blocks on missing city or address and reports server-shaped keys', () => {
    const built = buildQuotationRequestPayload({
      ...baseArgs(),
      mode: 'manual',
      selectedAddressId: null,
      manual: emptyManualAddress(),
    });

    expect(built.ok).toBe(false);
    expect(built.payload).toBeNull();
    expect(Object.keys(built.fieldErrors)).toEqual(
      expect.arrayContaining(['city', 'delivery_address']),
    );
  });
});

describe('buildQuotationRequestPayload — local mirrors of contract validation', () => {
  it('requires name and phone and rejects dates in the past', () => {
    const built = buildQuotationRequestPayload({
      ...baseArgs(),
      contact: { ...baseContact, name: ' ', phone: '' },
      requiredDeliveryDate: '2000-01-01',
    });

    expect(built.ok).toBe(false);
    expect(built.fieldErrors.name).toHaveLength(1);
    expect(built.fieldErrors.phone).toHaveLength(1);
    expect(built.fieldErrors.required_delivery_date).toHaveLength(1);
    expect(built.payload).toBeNull();
  });

  it('flags cart lines below their MOQ as server-shaped item errors', () => {
    const built = buildQuotationRequestPayload({
      ...baseArgs(),
      items: [
        line(),
        line({ product_id: 2, quantity: 1, minimum_order_quantity: 3 }),
        line({ product_id: 3, quantity: 2.5, minimum_order_quantity: 1 }),
      ],
    });

    expect(built.ok).toBe(false);
    expect(built.itemErrors).toEqual([
      { key: 'items.1.quantity', message: expect.stringContaining('minimum order quantity of 3') },
      { key: 'items.2.quantity', message: expect.stringContaining('whole number') },
    ]);
    expect(built.payload).toBeNull();
  });
});

describe('buildQuotationRequestPayload — save-to-address-book preparation', () => {
  it('builds the address input with the same manual values', () => {
    const manual = {
      contact_name: 'U Min',
      phone: '09-770-000-111',
      city: 'Mandalay',
      township: 'Pyigyitagon',
      ward: 'Ward 9',
      street: '86th St',
      building_no: 'No. 12',
      landmark: 'Buddha Park',
      full_address: '',
    };

    const built = buildQuotationRequestPayload({
      ...baseArgs(),
      mode: 'manual',
      selectedAddressId: null,
      manual,
      saveToAddressBook: true,
    });

    expect(built.ok).toBe(true);
    expect(built.addressInput).toEqual({
      contact_name: 'U Min',
      phone: '09-770-000-111',
      city: 'Mandalay',
      township: 'Pyigyitagon',
      ward: 'Ward 9',
      street: '86th St',
      building_no: 'No. 12',
      landmark: 'Buddha Park',
      full_address: 'No. 12, 86th St, Ward 9, Pyigyitagon, Mandalay — Near Buddha Park',
    });
  });

  it('blocks the submission while the address input is incomplete', () => {
    const built = buildQuotationRequestPayload({
      ...baseArgs(),
      mode: 'manual',
      selectedAddressId: null,
      manual: emptyManualAddress(),
      saveToAddressBook: true,
    });

    expect(built.ok).toBe(false);
    expect(built.addressInput).toBeNull();
    expect(Object.keys(built.addressErrors)).toEqual(
      expect.arrayContaining(['contact_name', 'phone', 'township', 'full_address']),
    );
  });

  it('requires a township for the address book even when the delivery address composes', () => {
    const built = buildQuotationRequestPayload({
      ...baseArgs(),
      mode: 'manual',
      selectedAddressId: null,
      manual: {
        ...emptyManualAddress(),
        contact_name: 'U Min',
        phone: '09-770-000-111',
        city: 'Mandalay',
        street: '86th St',
      },
      saveToAddressBook: true,
    });

    expect(built.ok).toBe(false);
    expect(built.addressInput).toBeNull();
    expect(built.addressErrors.township).toHaveLength(1);
  });

  it('never prepares an address input when the buyer did not opt in', () => {
    const built = buildQuotationRequestPayload({
      ...baseArgs(),
      mode: 'manual',
    });

    expect(built.addressInput).toBeNull();
    expect(built.addressErrors).toEqual({});
  });
});

describe('splitServerErrors', () => {
  it('routes item keys to the banner and the rest to form fields', () => {
    const split = splitServerErrors({
      'items.0.product_id': ['The selected product is invalid.'],
      'items.1.quantity': ['The quantity must be at least 2.'],
      city: ['The city field is required.'],
    });

    expect(split.fieldErrors).toEqual({ city: ['The city field is required.'] });
    expect(split.itemErrors).toEqual([
      { key: 'items.0.product_id', message: 'The selected product is invalid.' },
      { key: 'items.1.quantity', message: 'The quantity must be at least 2.' },
    ]);
  });
});
