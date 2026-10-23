/**
 * Quotation Request Form (Task 06).
 *
 * The customer-side half of LogicFlow §5. Contact fields prefill from the
 * customer profile but are editable — whatever is in them at submit time is
 * what gets snapshotted. Delivery chooses between a saved address book entry
 * and manual entry (which can opt into the address book), the item summary is
 * derived from the browser cart, and the POST happens through
 * `submitQuotationRequest` so the cart is cleared strictly on success.
 *
 * Every required state from the Definition of Done is handled: profile /
 * address loading (with retry), empty cart, local + server field errors,
 * and 401/403 permission problems that send the buyer to `/login`.
 */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Alert,
  EmptyState,
  Field,
  LoadingPanel,
  PageHeader,
  StatusBadge,
  describeCustomerLoadError,
  inputClass,
  joinIds,
  primaryButtonClass,
  secondaryButtonClass,
  type LoadErrorState,
} from '../../../components/catalog-ui/CatalogUi';
import { getCustomerProfile } from '../../customer/api/profileApi';
import {
  listCustomerAddresses,
  type CustomerAddress,
} from '../../customer/api/addressesApi';
import { useAuth, type User } from '../../../lib/auth-context';
import { useCart } from '../../../lib/cart-context';
import { formatMMK } from '../../../lib/money';
import { needsSupplierConfirmation } from '../../../lib/cart-storage';
import type { QuotationRequest } from '../api/quotationsApi';
import {
  buildQuotationRequestPayload,
  prefillManualFromAddress,
  splitServerErrors,
  todayISODate,
  type AddressMode,
  type ManualAddressState,
  type QuotationContactState,
} from '../lib/quotationForm';
import { submitQuotationRequest } from '../lib/submitQuotationRequest';

const ADDRESS_PAGE_SIZE = 50; // the picker never pages; 50 covers MVP books

/** Request-time contact state prefilled from the signed-in user while loading. */
function contactFromUser(user: User | null): QuotationContactState {
  return {
    name: user?.name ?? '',
    phone: user?.phone ?? '',
    company_name: user?.company_name ?? '',
    email: user?.email ?? '',
  };
}

const MANUAL_FIELDS: Array<{
  key: keyof ManualAddressState;
  label: string;
  required: boolean;
  type?: string;
}> = [
  { key: 'contact_name', label: 'Contact person at delivery', required: true },
  { key: 'phone', label: 'Delivery phone', required: true, type: 'tel' },
  { key: 'city', label: 'City', required: true },
  { key: 'township', label: 'Township', required: false },
  { key: 'ward', label: 'Ward', required: false },
  { key: 'street', label: 'Street', required: false },
  { key: 'building_no', label: 'Building / No.', required: false },
  { key: 'landmark', label: 'Landmark', required: false },
];

export default function QuotationRequestFormPage() {
  const { items, clear } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Load state
  const [addresses, setAddresses] = useState<CustomerAddress[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<LoadErrorState | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  // Form state
  const [contact, setContact] = useState<QuotationContactState>(() => contactFromUser(user));
  const [mode, setMode] = useState<AddressMode>('saved');
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [manual, setManual] = useState<ManualAddressState>(prefillManualFromAddress(null));
  const manualDirtyRef = useRef(false);
  const [saveToAddressBook, setSaveToAddressBook] = useState(false);
  const [requiredDeliveryDate, setRequiredDeliveryDate] = useState('');
  const [customerNote, setCustomerNote] = useState('');

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<QuotationRequest | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string[]>>({});
  const [addressFieldErrors, setAddressFieldErrors] = useState<Record<string, string[]>>({});
  const [itemErrors, setItemErrors] = useState<Array<{ key: string; message: string }>>([]);

  // Profile prefill is a nicety — the picker and the submit path must still
  // work if it fails — so the profile is fetched permissively here.
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setLoadError(null);

      const [profileResponse, addressesResponse] = await Promise.all([
        getCustomerProfile(),
        listCustomerAddresses({ page: 1, per_page: ADDRESS_PAGE_SIZE }),
      ]);

      if (cancelled) return;

      if (profileResponse.success && profileResponse.data) {
        const customer = profileResponse.data.customer;
        setContact({
          name: customer.name,
          phone: customer.phone,
          company_name: customer.company_name ?? '',
          email: customer.email ?? '',
        });
      }

      if (addressesResponse.success && addressesResponse.data) {
        const loaded = addressesResponse.data.addresses;
        const fallback =
          loaded.find((address) => address.is_default) ?? loaded[0] ?? null;

        setAddresses(loaded);
        if (loaded.length > 0 && fallback) {
          setMode('saved');
          setSelectedAddressId(fallback.id);
        } else {
          setMode('manual');
        }
        setIsLoading(false);
        return;
      }

      // The address book must be readable to submit; the profile is not.
      setLoadError(describeCustomerLoadError(addressesResponse, 'your address book'));
      setIsLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const selectedAddress =
    addresses?.find((address) => address.id === selectedAddressId) ?? null;

  const switchMode = (next: AddressMode) => {
    setMode(next);

    if (next === 'manual' && !manualDirtyRef.current) {
      // "Prefills from defaults when empty": starting manual entry seeds it
      // with the address that was about to be used.
      setManual(prefillManualFromAddress(selectedAddress));
    }
  };

  const changeManualField = (key: keyof ManualAddressState, value: string) => {
    manualDirtyRef.current = true;
    setManual((current) => ({ ...current, [key]: value }));
  };

  const errorFor = (key: string): string[] | null =>
    formErrors[key] ?? addressFieldErrors[key] ?? null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setBanner(null);
    setFormErrors({});
    setAddressFieldErrors({});
    setItemErrors([]);

    const built = buildQuotationRequestPayload({
      contact,
      selectedAddressId,
      mode,
      manual,
      addresses: addresses ?? [],
      items,
      requiredDeliveryDate,
      customerNote,
      saveToAddressBook: mode === 'manual' && saveToAddressBook,
    });

    if (!built.ok || !built.payload) {
      setFormErrors(built.fieldErrors);
      setAddressFieldErrors(built.addressErrors);
      setItemErrors(built.itemErrors);
      setBanner(itemErrorsFallbackMessage(built, 'Fix the highlighted fields, then submit again.'));
      window.scrollTo(0, 0);
      return;
    }

    setSubmitting(true);

    const result = await submitQuotationRequest({
      payload: built.payload,
      addressInput: built.addressInput,
      // Cart clearing is isolated inside the helper and only fires on 201.
      clearCart: clear,
    });

    if (result.ok) {
      setSubmitted(result.quotationRequest);
      window.scrollTo(0, 0);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);

    if (result.needsLogin) {
      navigate('/login');
      return;
    }

    if (result.stage === 'request') {
      const split = splitServerErrors(result.errors ?? {});
      setFormErrors(split.fieldErrors);
      setItemErrors(split.itemErrors);
    } else {
      setAddressFieldErrors({ ...(result.errors ?? {}) });
    }

    setBanner(result.message);
    window.scrollTo(0, 0);
  };

  // ---------- Early states ----------

  if (submitted) {
    return <SubmittedView quotation={submitted} />;
  }

  if (items.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Request quotation" />
        <EmptyState
          title="Your order list is empty"
          hint="Add products to your order list first, then come back to request a quotation."
        />
        <div className="text-center">
          <Link to="/products" className={`${primaryButtonClass} inline-block`}>
            Browse products
          </Link>
        </div>
      </div>
    );
  }

  if (loadError && (loadError.needsLogin || addresses === null)) {
    return (
      <div className="space-y-6">
        <PageHeader title="Request quotation" />
        <div className="rounded-lg border border-red-200 bg-red-50 p-6" role="alert">
          <h2 className="text-lg font-semibold text-red-800">
            The quotation request form is unavailable
          </h2>
          <p className="mt-1 text-sm text-red-700">{loadError.message}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setReloadToken((token) => token + 1)}
              className={primaryButtonClass}
            >
              Try again
            </button>
            {loadError.needsLogin ? (
              <button
                type="button"
                onClick={() => navigate('/login')}
                className={secondaryButtonClass}
              >
                Go to login
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Request quotation" />
        <LoadingPanel label="Preparing your quotation request…" />
      </div>
    );
  }

  const itemCount = items.reduce((total, item) => total + item.quantity, 0);
  const subtotal = items.reduce((total, item) => total + item.unit_price * item.quantity, 0);
  const hasSupplierConfirmationLines = items.some((item) =>
    needsSupplierConfirmation(item.stock_status),
  );

  // ---------- Submitted form ----------

  return (
    <form onSubmit={handleSubmit} className="pb-28 space-y-6 sm:pb-0" aria-busy={submitting}>
      <PageHeader
        title="Request quotation"
        description="Confirm your contact and delivery details. Everything below is saved as a snapshot on your request and is not linked back to your profile."
      />

      {banner ? (
        <Alert tone="error">
          {banner}
          {itemErrors.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {itemErrors.map((error) => (
                <li key={error.key}>{error.message}</li>
              ))}
            </ul>
          ) : null}
        </Alert>
      ) : null}

      {/* Order summary derived from the cart snapshot lines. */}
      <section className="rounded-lg border border-rule bg-plate" aria-label="Order list summary">
        <ul className="divide-y divide-rule">
          {items.map((item, index) => (
            <li key={item.product_id} className="flex items-start gap-4 p-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900">
                  {item.name_en ?? item.name_mm}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {item.supplier_name ?? 'Supplier'}
                  {item.sku ? ` · SKU ${item.sku}` : ''}
                </p>
                <p className="mt-2 text-sm font-medium text-gray-900">
                  {formatMMK(item.unit_price)} MMK / {item.unit} &times; {item.quantity} ={' '}
                  <span className="tabular-nums">{formatMMK(item.unit_price * item.quantity)}</span>{' '}
                  MMK
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Display price — final price confirmed in quotation.
                </p>
                {needsSupplierConfirmation(item.stock_status) ? (
                  <p className="mt-2 inline-block rounded-md bg-purple-50 px-2 py-1 text-xs text-purple-800">
                    Price and stock for this line will be confirmed by the supplier before
                    quotation.
                  </p>
                ) : null}
                {itemErrors.some((error) => error.key === `items.${index}.quantity`) ? (
                  <p role="alert" className="mt-2 text-xs text-red-600">
                    {itemErrors.find((error) => error.key === `items.${index}.quantity`)?.message}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-t border-rule">
          <p className="text-sm text-gray-600">
            {itemCount} {itemCount === 1 ? 'unit' : 'units'} across {items.length}{' '}
            {items.length === 1 ? 'line' : 'lines'} (display price)
          </p>
          <p className="text-lg font-semibold text-ink tabular-nums">{formatMMK(subtotal)} MMK</p>
        </div>
        <p className="border-t border-rule px-4 py-3 text-xs text-gray-500">
          Indicative only. Delivery, discounts and the service fee are calculated by the server
          when the quotation is issued.
        </p>
        {hasSupplierConfirmationLines ? (
          <p className="border-t border-purple-100 bg-purple-50/60 px-4 py-2 text-xs text-purple-800">
            Some lines need supplier confirmation — their price and stock are finalized in the
            quotation.
          </p>
        ) : null}
      </section>

      {/* Contact details (request-time snapshot). */}
      <section className="rounded-lg border border-rule bg-plate p-4 sm:p-6" aria-label="Contact details">
        <h2 className="text-base font-semibold text-ink">Contact details</h2>
        <p className="mt-1 text-xs text-gray-500">
          Prefilled from your profile — edit freely; the request keeps what you enter.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Your name" htmlFor="qt-name" required error={errorFor('name')}>
            <input
              id="qt-name"
              type="text"
              autoComplete="name"
              value={contact.name}
              onChange={(event) =>
                setContact((current) => ({ ...current, name: event.target.value }))
              }
              aria-invalid={(errorFor('name')?.length ?? 0) > 0 || undefined}
              aria-describedby={joinIds(errorFor('name') ? 'qt-name-error' : null)}
              className={inputClass(Boolean(errorFor('name')))}
            />
          </Field>

          <Field label="Phone number" htmlFor="qt-phone" required error={errorFor('phone')}>
            <input
              id="qt-phone"
              type="tel"
              autoComplete="tel"
              value={contact.phone}
              onChange={(event) =>
                setContact((current) => ({ ...current, phone: event.target.value }))
              }
              aria-invalid={(errorFor('phone')?.length ?? 0) > 0 || undefined}
              aria-describedby={joinIds(errorFor('phone') ? 'qt-phone-error' : null)}
              className={inputClass(Boolean(errorFor('phone')))}
            />
          </Field>

          <Field label="Company name" htmlFor="qt-company" error={errorFor('company_name')}>
            <input
              id="qt-company"
              type="text"
              autoComplete="organization"
              value={contact.company_name}
              onChange={(event) =>
                setContact((current) => ({ ...current, company_name: event.target.value }))
              }
              aria-invalid={(errorFor('company_name')?.length ?? 0) > 0 || undefined}
              aria-describedby={joinIds(errorFor('company_name') ? 'qt-company-error' : null)}
              className={inputClass(Boolean(errorFor('company_name')))}
            />
          </Field>

          <Field
            label="Email"
            htmlFor="qt-email"
            error={errorFor('email')}
            hint="Used on the quotation document when it is sent."
            hintId="qt-email-hint"
          >
            <input
              id="qt-email"
              type="email"
              autoComplete="email"
              value={contact.email}
              onChange={(event) =>
                setContact((current) => ({ ...current, email: event.target.value }))
              }
              aria-invalid={(errorFor('email')?.length ?? 0) > 0 || undefined}
              aria-describedby={joinIds(
                'qt-email-hint',
                errorFor('email') ? 'qt-email-error' : null,
              )}
              className={inputClass(Boolean(errorFor('email')))}
            />
          </Field>
        </div>
      </section>

      {/* Delivery address: saved entries or manual entry. */}
      <section className="rounded-lg border border-rule bg-plate p-4 sm:p-6" aria-label="Delivery address">
        <h2 className="text-base font-semibold text-ink">Delivery address</h2>
        <p className="mt-1 text-sm text-gray-600">
          {addresses && addresses.length > 0
            ? 'Choose one of your saved addresses, or enter a different one.'
            : 'Enter the delivery address where the quotation should be shipped.'}
        </p>
        {errorFor('delivery_address') ? (
          <p role="alert" id="qt-delivery-address-error" className="mt-2 text-sm text-red-600">
            {errorFor('delivery_address')![0]}
          </p>
        ) : null}

        {addresses && addresses.length > 0 ? (
          <div className="mt-4 grid gap-3" role="radiogroup" aria-label="Delivery address options">
            {addresses.map((address) => (
              <label
                key={address.id}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 motion-safe:transition-colors ${
                  mode === 'saved' && selectedAddressId === address.id
                    ? 'border-ink ring-1 ring-ink'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <input
                  type="radio"
                  name="qt-address-mode"
                  value={`saved-${address.id}`}
                  checked={mode === 'saved' && selectedAddressId === address.id}
                  onChange={() => {
                    setSelectedAddressId(address.id);
                    switchMode('saved');
                  }}
                  disabled={submitting}
                  className="mt-1 h-4 w-4 flex-none border-gray-300 text-primary focus:ring-accent"
                />
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">
                      {address.contact_name}
                    </span>
                    {address.is_default ? (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/20">
                        Default
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-sm text-gray-700">
                    {address.phone} · {address.city}
                    {address.township ? `, ${address.township}` : ''}
                  </span>
                  <span className="mt-1 block text-xs text-gray-500">{address.full_address}</span>
                </span>
              </label>
            ))}

            <label
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 motion-safe:transition-colors ${
                mode === 'manual'
                  ? 'border-ink ring-1 ring-ink'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <input
                type="radio"
                name="qt-address-mode"
                value="manual"
                checked={mode === 'manual'}
                onChange={() => switchMode('manual')}
                disabled={submitting}
                className="mt-1 h-4 w-4 flex-none border-gray-300 text-primary focus:ring-accent"
              />
              <span className="text-sm font-semibold text-gray-900">
                Use a different address
              </span>
            </label>
          </div>
        ) : null}

        {mode === 'manual' ? (
          <div className="mt-4 rounded-lg border border-gray-200 p-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {MANUAL_FIELDS.map((field) => {
                const addressError =
                  addressFieldErrors[field.key] ?? formErrors[field.key] ?? null;
                const hasError = (addressError?.length ?? 0) > 0;
                // The address-book API requires a township, while a
                // one-off manual delivery address does not.
                const isRequired =
                  field.required || (saveToAddressBook && field.key === 'township');

                return (
                  <Field
                    key={field.key}
                    label={field.label}
                    htmlFor={`qt-manual-${field.key}`}
                    required={isRequired}
                    error={addressError}
                  >
                    <input
                      id={`qt-manual-${field.key}`}
                      type={field.type ?? 'text'}
                      value={manual[field.key]}
                      onChange={(event) => changeManualField(field.key, event.target.value)}
                      disabled={submitting}
                      aria-invalid={hasError || undefined}
                      aria-describedby={joinIds(
                        addressError ? `qt-manual-${field.key}-error` : null,
                      )}
                      className={inputClass(hasError)}
                    />
                  </Field>
                );
              })}

              <Field
                label="Full address (optional)"
                htmlFor="qt-manual-full_address"
                error={errorFor('full_address')}
                hint="Leave blank and we compose it from the parts above, or type the exact wording."
                hintId="qt-manual-full_address-hint"
              >
                <textarea
                  id="qt-manual-full_address"
                  rows={2}
                  value={manual.full_address}
                  onChange={(event) => changeManualField('full_address', event.target.value)}
                  disabled={submitting}
                  aria-invalid={(errorFor('full_address')?.length ?? 0) > 0 || undefined}
                  aria-describedby={joinIds(
                    'qt-manual-full_address-hint',
                    errorFor('full_address') ? 'qt-manual-full_address-error' : null,
                  )}
                  className={inputClass(Boolean(errorFor('full_address')))}
                />
              </Field>
            </div>

            <label className="mt-3 flex items-start gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={saveToAddressBook}
                onChange={(event) => setSaveToAddressBook(event.target.checked)}
                disabled={submitting}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-accent"
              />
              <span>
                Save this address to my address book
                <span className="sr-only">
                  {' '}
                  (contact person, phone, city, township, and full address are then required)
                </span>
              </span>
            </label>
            {saveToAddressBook ? (
              <p className="mt-1 text-xs text-gray-500">
                The contact person, delivery phone, city, township, and full address become
                required and are saved before the request is submitted.
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      {/* Delivery preferences. */}
      <section className="rounded-lg border border-rule bg-plate p-4 sm:p-6" aria-label="Delivery preferences">
        <h2 className="text-base font-semibold text-ink">Delivery preferences</h2>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Required delivery date"
            htmlFor="qt-date"
            error={errorFor('required_delivery_date')}
            hint="Optional. Must be today or later."
            hintId="qt-date-hint"
          >
            <input
              id="qt-date"
              type="date"
              min={todayISODate()}
              value={requiredDeliveryDate}
              onChange={(event) => setRequiredDeliveryDate(event.target.value)}
              disabled={submitting}
              aria-invalid={(errorFor('required_delivery_date')?.length ?? 0) > 0 || undefined}
              aria-describedby={joinIds(
                'qt-date-hint',
                errorFor('required_delivery_date') ? 'qt-date-error' : null,
              )}
              className={inputClass(Boolean(errorFor('required_delivery_date')))}
            />
          </Field>

          <Field
            label="Note to the sales team"
            htmlFor="qt-note"
            error={errorFor('customer_note')}
            hint="Optional. Anything the supplier should know about this request."
            hintId="qt-note-hint"
          >
            <textarea
              id="qt-note"
              rows={3}
              value={customerNote}
              onChange={(event) => setCustomerNote(event.target.value)}
              disabled={submitting}
              aria-invalid={(errorFor('customer_note')?.length ?? 0) > 0 || undefined}
              aria-describedby={joinIds(
                'qt-note-hint',
                errorFor('customer_note') ? 'qt-note-error' : null,
              )}
              className={inputClass(Boolean(errorFor('customer_note')))}
            />
          </Field>
        </div>
      </section>

      {/* Sticky mobile / static desktop submit area, mirroring the cart page. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-rule bg-plate/95 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:static sm:rounded-lg sm:border sm:border-rule sm:bg-plate sm:p-6 sm:pb-6">
        <button
          type="submit"
          disabled={submitting}
          className={`${primaryButtonClass} w-full`}
        >
          {submitting ? 'Submitting…' : 'Submit quotation request'}
        </button>
        <p className="mt-2 text-xs text-gray-500">
          {submitting
            ? 'Saving your address book entry first when requested, then submitting…'
            : 'Your order list is cleared only after the request is saved successfully.'}
        </p>
      </div>
    </form>
  );
}

function itemErrorsFallbackMessage(
  built: ReturnType<typeof buildQuotationRequestPayload>,
  fallback: string,
): string {
  return built.itemErrors.length > 0
    ? 'Some order list quantities need attention before the request can be submitted.'
    : fallback;
}

/** Post-submit success state (LogicFlow §5: show the quotation number). */
function SubmittedView({ quotation }: { quotation: QuotationRequest }) {
  return (
    <div className="space-y-6">
      <Alert tone="success">Your quotation request was submitted successfully.</Alert>

      <section
        className="rounded-lg border border-rule bg-plate p-6"
        aria-label="Quotation request confirmation"
      >
        <h1 className="text-base font-medium text-gray-600">
          Quotation Request ID: {quotation.quotation_number}
        </h1>
        <p className="mt-2 flex items-center gap-2 text-sm text-gray-700">
          Status: <StatusBadge status={quotation.status} />
        </p>

        <dl className="mt-6 grid grid-cols-1 gap-4 border-t border-rule pt-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-gray-500">Contact</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {quotation.customer_name} · {quotation.phone}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Deliver to</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {quotation.city}
              {quotation.township ? `, ${quotation.township}` : ''}
              <span className="block text-xs text-gray-500">{quotation.delivery_address}</span>
            </dd>
          </div>
        </dl>

        <ul className="mt-6 divide-y divide-rule border-t border-rule">
          {quotation.items.map((item, index) => (
            <li key={`${item.product_id}-${index}`} className="flex items-start gap-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900">
                  {item.product_name_snapshot}
                </p>
                {item.specification_snapshot ? (
                  <p className="mt-0.5 text-xs text-gray-500">{item.specification_snapshot}</p>
                ) : null}
              </div>
              <div className="flex-none text-right">
                <p className="text-sm font-medium text-ink tabular-nums">
                  {item.quantity} &times; {formatMMK(item.display_price)} MMK
                </p>
                {item.stock_status === 'SUPPLIER_CONFIRMATION_REQUIRED' ? (
                  <p className="mt-1 text-xs text-purple-700">Supplier confirmation required</p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-6 border-t border-rule pt-4 text-sm text-gray-600">
          Your order list has been cleared. The lines above were saved in this request, so nothing
          was lost from your list.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/quotations" className={primaryButtonClass}>
            View my quotations
          </Link>
          <Link to="/products" className={secondaryButtonClass}>
            Browse products
          </Link>
        </div>
      </section>
    </div>
  );
}
