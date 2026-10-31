import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  SUPPLIER_FIELDS,
  buildSupplierFormData,
  createSupplier,
  getSupplier,
  updateSupplier,
  type Supplier,
  type SupplierStatus,
} from '../api/suppliersApi';
import { mapValidationErrors } from '../api/catalogApiUtils';
import { useI18n } from '../../../lib/i18n-context';
import {
  Alert,
  Field,
  IMAGE_ACCEPT,
  LoadingPanel,
  PageHeader,
  describeLoadError,
  describeRequestError,
  inputClass,
  joinIds,
  linkClass,
  primaryButtonClass,
  secondaryButtonClass,
  validateImageFile,
  type LoadErrorState,
} from '../../../components/catalog-ui/CatalogUi';

interface SupplierFormState {
  shop_name: string;
  company_name: string;
  contact_person: string;
  phone: string;
  viber_phone: string;
  email: string;
  logo: File | null;
  address: string;
  city: string;
  township: string;
  business_description: string;
  delivery_area: string;
  delivery_time: string;
  warranty_policy: string;
  return_policy: string;
  status: SupplierStatus;
  verified: boolean;
}

const EMPTY_FORM: SupplierFormState = {
  shop_name: '',
  company_name: '',
  contact_person: '',
  phone: '',
  viber_phone: '',
  email: '',
  logo: null,
  address: '',
  city: '',
  township: '',
  business_description: '',
  delivery_area: '',
  delivery_time: '',
  warranty_policy: '',
  return_policy: '',
  status: 'ACTIVE',
  verified: false,
};

function fieldId(key: string): string {
  return `supplier-${key}`;
}

function fieldErrorId(key: string): string {
  return `${fieldId(key)}-error`;
}

function toFormState(supplier: Supplier): SupplierFormState {
  return {
    shop_name: supplier.shop_name,
    company_name: supplier.company_name ?? '',
    contact_person: supplier.contact_person,
    phone: supplier.phone,
    viber_phone: supplier.viber_phone ?? '',
    email: supplier.email ?? '',
    logo: null,
    address: supplier.address,
    city: supplier.city,
    township: supplier.township ?? '',
    business_description: supplier.business_description ?? '',
    delivery_area: supplier.delivery_area ?? '',
    delivery_time: supplier.delivery_time ?? '',
    warranty_policy: supplier.warranty_policy ?? '',
    return_policy: supplier.return_policy ?? '',
    status: supplier.status,
    verified: supplier.verified,
  };
}

/**
 * Create and edit share this component: `/admin/suppliers/new` has no route
 * param, `/admin/suppliers/:id/edit` loads the supplier first.
 *
 * Suppliers are never deleted; deactivation is done with the status field.
 */
export default function SupplierFormPage() {
  const { t } = useI18n();
  const params = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const rawId = params.id;
  const supplierId = rawId === undefined ? null : Number(rawId);
  const isEdit = supplierId !== null;

  const flashMessage = (location.state as { flash?: string } | null)?.flash ?? null;

  const [form, setForm] = useState<SupplierFormState>(EMPTY_FORM);
  const [current, setCurrent] = useState<Supplier | null>(null);
  const [isLoading, setIsLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState<LoadErrorState | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(flashMessage);

  const formAlertRef = useRef<HTMLDivElement>(null);

  // Consume the "created" flash so it does not reappear on refresh.
  useEffect(() => {
    if (flashMessage) {
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [flashMessage, location.pathname, navigate]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (rawId === undefined) {
        setForm(EMPTY_FORM);
        setCurrent(null);
        setLoadError(null);
        setIsLoading(false);
        return;
      }

      if (supplierId === null || !Number.isInteger(supplierId) || supplierId <= 0) {
        setLoadError({
          message: t('supplierInvalidLink'),
          needsLogin: false,
        });
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError(null);

      const response = await getSupplier(supplierId);

      if (cancelled) return;

      if (response.success && response.data) {
        setCurrent(response.data.supplier);
        setForm(toFormState(response.data.supplier));
      } else if (response.status === 404) {
        setLoadError({
          message: t('supplierNotFound'),
          needsLogin: false,
        });
      } else {
        setLoadError(describeLoadError(response, t('supplier'), t));
      }

      setIsLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [supplierId, rawId, reloadToken]);

  const logoPreviewUrl = useMemo(
    () => (form.logo ? URL.createObjectURL(form.logo) : null),
    [form.logo],
  );

  useEffect(() => {
    if (!logoPreviewUrl) return;
    return () => {
      URL.revokeObjectURL(logoPreviewUrl);
    };
  }, [logoPreviewUrl]);

  const clearFieldError = (key: string) => {
    setFieldErrors((previous) => {
      if (!previous[key]) return previous;
      const next = { ...previous };
      delete next[key];
      return next;
    });
  };

  const updateField = <K extends keyof SupplierFormState>(key: K, value: SupplierFormState[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    setSuccessMessage(null);
    setFormError(null);
    clearFieldError(key);
  };

  const handleLogoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0] ?? null;

    setSuccessMessage(null);
    setFormError(null);

    if (!file) {
      setForm((previous) => ({ ...previous, logo: null }));
      clearFieldError('logo');
      return;
    }

    const message = validateImageFile(file, t);
    if (message) {
      setForm((previous) => ({ ...previous, logo: null }));
      setFieldErrors((previous) => ({ ...previous, logo: [message] }));
      input.value = '';
      return;
    }

    setForm((previous) => ({ ...previous, logo: file }));
    clearFieldError('logo');
  };

  const focusFirstError = (errors: Record<string, string[]>) => {
    const firstKey = Object.keys(errors)[0];

    requestAnimationFrame(() => {
      if (firstKey) {
        document.getElementById(fieldId(firstKey))?.focus();
        return;
      }
      formAlertRef.current?.focus();
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSaving || isLoading) return;

    setIsSaving(true);
    setFormError(null);
    setFieldErrors({});
    setSuccessMessage(null);

    const formData = buildSupplierFormData({
      shop_name: form.shop_name,
      company_name: form.company_name,
      contact_person: form.contact_person,
      phone: form.phone,
      viber_phone: form.viber_phone,
      email: form.email,
      logo: form.logo,
      address: form.address,
      city: form.city,
      township: form.township,
      business_description: form.business_description,
      delivery_area: form.delivery_area,
      delivery_time: form.delivery_time,
      warranty_policy: form.warranty_policy,
      return_policy: form.return_policy,
      status: form.status,
      verified: form.verified,
    });

    const response =
      supplierId === null
        ? await createSupplier(formData)
        : await updateSupplier(supplierId, formData);

    setIsSaving(false);

    if (response.success && response.data) {
      const supplier = response.data.supplier;

      if (supplierId === null) {
        navigate(`/admin/suppliers/${supplier.id}/edit`, {
          replace: true,
          state: { flash: t('supplierCreated') },
        });
        return;
      }

      setCurrent(supplier);
      setForm(toFormState(supplier));
      setSuccessMessage(response.message ?? t('supplierUpdated'));
      return;
    }

    const mapped = mapValidationErrors(response.errors, SUPPLIER_FIELDS);
    setFieldErrors(mapped.fieldErrors);
    setFormError(
      mapped.formErrors[0] ?? describeRequestError(response, t('supplierSaveFailed'), t),
    );
    focusFirstError(mapped.fieldErrors);
  };

  const header = (
    <PageHeader
      title={isEdit ? t('editSupplier') : t('newSupplier')}
      description={
        isEdit
          ? current
            ? t('updatingSupplier', { supplier: current.shop_name })
            : t('updateSupplierDescription')
          : t('supplierCreateDescription')
      }
      action={
        <Link to="/admin/suppliers" className={secondaryButtonClass}>
          Back to suppliers
        </Link>
      }
    />
  );

  if (loadError) {
    return (
      <div className="space-y-6">
        {header}
        <div className="rounded-lg border border-red-200 bg-red-50 p-6" role="alert">
          <h2 className="text-lg font-semibold text-red-800">{t('supplierUnavailable')}</h2>
          <p className="mt-1 text-sm text-red-700">{loadError.message}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {loadError.needsLogin ? (
              <Link to="/admin/login" className={linkClass}>
                {t('goToAdminLogin')}
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => setReloadToken((token) => token + 1)}
                className={primaryButtonClass}
              >
                {t('tryAgain')}
              </button>
            )}
            <Link to="/admin/suppliers" className={linkClass}>
              {t('backToSuppliers')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        {header}
        <LoadingPanel label={t('loadingSupplier')} />
      </div>
    );
  }

  const viberMissing = form.viber_phone.trim() === '';

  return (
    <div className="space-y-6">
      {header}

      {successMessage ? (
        <Alert tone="success">
          <p className="text-sm font-medium">{successMessage}</p>
        </Alert>
      ) : null}

      {formError ? (
        <div
          ref={formAlertRef}
          tabIndex={-1}
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          <p className="text-sm font-medium text-red-700">{formError}</p>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-6" aria-busy={isSaving || undefined}>
        <section className="rounded-lg bg-white shadow">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">{t('shopDetails')}</h2>
            <p className="mt-1 text-sm text-gray-500">
              {t('supplierContactHint')}
            </p>
          </div>
          <div className="space-y-5 px-6 py-5">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field
                label={t('shopName')}
                htmlFor={fieldId('shop_name')}
                required
                error={fieldErrors.shop_name}
              >
                <input
                  id={fieldId('shop_name')}
                  type="text"
                  required
                  maxLength={255}
                  value={form.shop_name}
                  disabled={isSaving}
                  aria-invalid={Boolean(fieldErrors.shop_name) || undefined}
                  aria-describedby={joinIds(
                    Boolean(fieldErrors.shop_name) && fieldErrorId('shop_name'),
                  )}
                  onChange={(event) => updateField('shop_name', event.target.value)}
                  className={inputClass(Boolean(fieldErrors.shop_name))}
                />
              </Field>

              <Field
                label={t('companyName')}
                htmlFor={fieldId('company_name')}
                error={fieldErrors.company_name}
              >
                <input
                  id={fieldId('company_name')}
                  type="text"
                  maxLength={255}
                  value={form.company_name}
                  disabled={isSaving}
                  aria-invalid={Boolean(fieldErrors.company_name) || undefined}
                  aria-describedby={joinIds(
                    Boolean(fieldErrors.company_name) && fieldErrorId('company_name'),
                  )}
                  onChange={(event) => updateField('company_name', event.target.value)}
                  className={inputClass(Boolean(fieldErrors.company_name))}
                />
              </Field>

              <Field
                label={t('contactPerson')}
                htmlFor={fieldId('contact_person')}
                required
                error={fieldErrors.contact_person}
              >
                <input
                  id={fieldId('contact_person')}
                  type="text"
                  required
                  maxLength={255}
                  value={form.contact_person}
                  disabled={isSaving}
                  aria-invalid={Boolean(fieldErrors.contact_person) || undefined}
                  aria-describedby={joinIds(
                    Boolean(fieldErrors.contact_person) && fieldErrorId('contact_person'),
                  )}
                  onChange={(event) => updateField('contact_person', event.target.value)}
                  className={inputClass(Boolean(fieldErrors.contact_person))}
                />
              </Field>

              <Field label={t('phone')} htmlFor={fieldId('phone')} required error={fieldErrors.phone}>
                <input
                  id={fieldId('phone')}
                  type="tel"
                  required
                  maxLength={50}
                  value={form.phone}
                  disabled={isSaving}
                  aria-invalid={Boolean(fieldErrors.phone) || undefined}
                  aria-describedby={joinIds(Boolean(fieldErrors.phone) && fieldErrorId('phone'))}
                  onChange={(event) => updateField('phone', event.target.value)}
                  className={inputClass(Boolean(fieldErrors.phone))}
                />
              </Field>

              <Field
                label={t('viberPhone')}
                htmlFor={fieldId('viber_phone')}
                error={fieldErrors.viber_phone}
                hint={
                  viberMissing ? (
                    <span className="font-medium text-amber-700">
                      {t('viberUnavailableHint')}
                    </span>
                  ) : (
                                        t('viberAlternateHint')
                  )
                }
                hintId={`${fieldId('viber_phone')}-hint`}
              >
                <input
                  id={fieldId('viber_phone')}
                  type="tel"
                  maxLength={50}
                  value={form.viber_phone}
                  disabled={isSaving}
                  aria-invalid={Boolean(fieldErrors.viber_phone) || undefined}
                  aria-describedby={joinIds(
                    `${fieldId('viber_phone')}-hint`,
                    Boolean(fieldErrors.viber_phone) && fieldErrorId('viber_phone'),
                  )}
                  onChange={(event) => updateField('viber_phone', event.target.value)}
                  className={inputClass(Boolean(fieldErrors.viber_phone))}
                />
              </Field>

              <Field label={t('email')} htmlFor={fieldId('email')} error={fieldErrors.email}>
                <input
                  id={fieldId('email')}
                  type="email"
                  maxLength={255}
                  value={form.email}
                  disabled={isSaving}
                  aria-invalid={Boolean(fieldErrors.email) || undefined}
                  aria-describedby={joinIds(Boolean(fieldErrors.email) && fieldErrorId('email'))}
                  onChange={(event) => updateField('email', event.target.value)}
                  className={inputClass(Boolean(fieldErrors.email))}
                />
              </Field>
            </div>

            <Field
              label={t('logo')}
              htmlFor={fieldId('logo')}
              error={fieldErrors.logo}
              hint={t('logoHint')}
              hintId={`${fieldId('logo')}-hint`}
            >
              <div className="flex flex-wrap items-start gap-4">
                <div className="h-24 w-24 flex-none overflow-hidden rounded-md border border-gray-200 bg-gray-50">
                  {logoPreviewUrl ? (
                    <img
                      src={logoPreviewUrl}
                      alt={t('selectedLogoPreview')}
                      className="h-full w-full object-cover"
                    />
                  ) : current?.logo_url ? (
                    <img
                      src={current.logo_url}
                      alt={current.shop_name ? t('currentLogoForSupplier', { supplier: current.shop_name }) : t('currentLogo')}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-xs text-gray-400">
                      {t('noLogo')}
                    </span>
                  )}
                </div>
                <input
                  id={fieldId('logo')}
                  type="file"
                  accept={IMAGE_ACCEPT}
                  disabled={isSaving}
                  aria-invalid={Boolean(fieldErrors.logo) || undefined}
                  aria-describedby={joinIds(
                    `${fieldId('logo')}-hint`,
                    Boolean(fieldErrors.logo) && fieldErrorId('logo'),
                  )}
                  onChange={handleLogoChange}
                  className="block w-full max-w-md text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>
            </Field>
          </div>
        </section>

        <section className="rounded-lg bg-white shadow">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">{t('location')}</h2>
          </div>
          <div className="space-y-5 px-6 py-5">
            <Field label={t('address')} htmlFor={fieldId('address')} required error={fieldErrors.address}>
              <textarea
                id={fieldId('address')}
                rows={2}
                required
                maxLength={1000}
                value={form.address}
                disabled={isSaving}
                aria-invalid={Boolean(fieldErrors.address) || undefined}
                aria-describedby={joinIds(Boolean(fieldErrors.address) && fieldErrorId('address'))}
                onChange={(event) => updateField('address', event.target.value)}
                className={inputClass(Boolean(fieldErrors.address))}
              />
            </Field>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field label={t('city')} htmlFor={fieldId('city')} required error={fieldErrors.city}>
                <input
                  id={fieldId('city')}
                  type="text"
                  required
                  maxLength={255}
                  value={form.city}
                  disabled={isSaving}
                  aria-invalid={Boolean(fieldErrors.city) || undefined}
                  aria-describedby={joinIds(Boolean(fieldErrors.city) && fieldErrorId('city'))}
                  onChange={(event) => updateField('city', event.target.value)}
                  className={inputClass(Boolean(fieldErrors.city))}
                />
              </Field>

              <Field label={t('township')} htmlFor={fieldId('township')} error={fieldErrors.township}>
                <input
                  id={fieldId('township')}
                  type="text"
                  maxLength={255}
                  value={form.township}
                  disabled={isSaving}
                  aria-invalid={Boolean(fieldErrors.township) || undefined}
                  aria-describedby={joinIds(
                    Boolean(fieldErrors.township) && fieldErrorId('township'),
                  )}
                  onChange={(event) => updateField('township', event.target.value)}
                  className={inputClass(Boolean(fieldErrors.township))}
                />
              </Field>
            </div>
          </div>
        </section>

        <section className="rounded-lg bg-white shadow">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">{t('supplierTerms')}</h2>
            <p className="mt-1 text-sm text-gray-500">
              {t('supplierTermsHint')}
            </p>
          </div>
          <div className="space-y-5 px-6 py-5">
            <Field
              label={t('businessDescription')}
              htmlFor={fieldId('business_description')}
              error={fieldErrors.business_description}
            >
              <textarea
                id={fieldId('business_description')}
                rows={3}
                maxLength={5000}
                value={form.business_description}
                disabled={isSaving}
                aria-invalid={Boolean(fieldErrors.business_description) || undefined}
                aria-describedby={joinIds(
                  Boolean(fieldErrors.business_description) &&
                    fieldErrorId('business_description'),
                )}
                onChange={(event) => updateField('business_description', event.target.value)}
                className={inputClass(Boolean(fieldErrors.business_description))}
              />
            </Field>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field
                label={t('deliveryArea')}
                htmlFor={fieldId('delivery_area')}
                error={fieldErrors.delivery_area}
              >
                <input
                  id={fieldId('delivery_area')}
                  type="text"
                  maxLength={255}
                  value={form.delivery_area}
                  disabled={isSaving}
                  aria-invalid={Boolean(fieldErrors.delivery_area) || undefined}
                  aria-describedby={joinIds(
                    Boolean(fieldErrors.delivery_area) && fieldErrorId('delivery_area'),
                  )}
                  onChange={(event) => updateField('delivery_area', event.target.value)}
                  className={inputClass(Boolean(fieldErrors.delivery_area))}
                />
              </Field>

              <Field
                label={t('deliveryTime')}
                htmlFor={fieldId('delivery_time')}
                error={fieldErrors.delivery_time}
              >
                <input
                  id={fieldId('delivery_time')}
                  type="text"
                  maxLength={255}
                  value={form.delivery_time}
                  disabled={isSaving}
                  aria-invalid={Boolean(fieldErrors.delivery_time) || undefined}
                  aria-describedby={joinIds(
                    Boolean(fieldErrors.delivery_time) && fieldErrorId('delivery_time'),
                  )}
                  onChange={(event) => updateField('delivery_time', event.target.value)}
                  className={inputClass(Boolean(fieldErrors.delivery_time))}
                />
              </Field>
            </div>

            <Field
              label={t('warrantyPolicy')}
              htmlFor={fieldId('warranty_policy')}
              error={fieldErrors.warranty_policy}
            >
              <textarea
                id={fieldId('warranty_policy')}
                rows={3}
                maxLength={5000}
                value={form.warranty_policy}
                disabled={isSaving}
                aria-invalid={Boolean(fieldErrors.warranty_policy) || undefined}
                aria-describedby={joinIds(
                  Boolean(fieldErrors.warranty_policy) && fieldErrorId('warranty_policy'),
                )}
                onChange={(event) => updateField('warranty_policy', event.target.value)}
                className={inputClass(Boolean(fieldErrors.warranty_policy))}
              />
            </Field>

            <Field
              label={t('returnPolicy')}
              htmlFor={fieldId('return_policy')}
              error={fieldErrors.return_policy}
            >
              <textarea
                id={fieldId('return_policy')}
                rows={3}
                maxLength={5000}
                value={form.return_policy}
                disabled={isSaving}
                aria-invalid={Boolean(fieldErrors.return_policy) || undefined}
                aria-describedby={joinIds(
                  Boolean(fieldErrors.return_policy) && fieldErrorId('return_policy'),
                )}
                onChange={(event) => updateField('return_policy', event.target.value)}
                className={inputClass(Boolean(fieldErrors.return_policy))}
              />
            </Field>
          </div>
        </section>

        <section className="rounded-lg bg-white shadow">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">{t('status')}</h2>
          </div>
          <div className="space-y-5 px-6 py-5">
            <Field
              label={t('status')}
              htmlFor={fieldId('status')}
              required
              error={fieldErrors.status}
              hint={t('inactiveSupplierHint')}
              hintId={`${fieldId('status')}-hint`}
            >
              <select
                id={fieldId('status')}
                required
                value={form.status}
                disabled={isSaving}
                aria-invalid={Boolean(fieldErrors.status) || undefined}
                aria-describedby={joinIds(
                  `${fieldId('status')}-hint`,
                  Boolean(fieldErrors.status) && fieldErrorId('status'),
                )}
                onChange={(event) => updateField('status', event.target.value as SupplierStatus)}
                className={`${inputClass(Boolean(fieldErrors.status))} max-w-xs`}
              >
                <option value="ACTIVE">{t('active')}</option>
                <option value="INACTIVE">{t('inactive')}</option>
                <option value="SUSPENDED">{t('suspended')}</option>
              </select>
            </Field>

            <div>
              <div className="flex items-start gap-3">
                <input
                  id={fieldId('verified')}
                  type="checkbox"
                  checked={form.verified}
                  disabled={isSaving}
                  aria-invalid={Boolean(fieldErrors.verified) || undefined}
                  aria-describedby={joinIds(
                    `${fieldId('verified')}-hint`,
                    Boolean(fieldErrors.verified) && fieldErrorId('verified'),
                  )}
                  onChange={(event) => updateField('verified', event.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-accent focus:ring-2 focus:ring-accent disabled:cursor-not-allowed disabled:opacity-60"
                />
                <label htmlFor={fieldId('verified')} className="text-sm">
                  <span className="block font-medium text-gray-900">{t('verifiedSupplier')}</span>
                  <span id={`${fieldId('verified')}-hint`} className="block text-xs text-gray-500">
                    {t('verifySupplierHint')}
                  </span>
                </label>
              </div>
              {fieldErrors.verified ? (
                <p id={fieldErrorId('verified')} className="mt-1.5 text-sm text-red-600">
                  {fieldErrors.verified[0]}
                </p>
              ) : null}
            </div>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow">
          <p className="text-sm text-gray-600" aria-live="polite">
            {isSaving
              ? t('savingChanges')
              : isEdit
                ? t('saveSupplierChangesHint')
                : t('createSupplierHint')}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link to="/admin/suppliers" className={secondaryButtonClass}>
              {t('cancel')}
            </Link>
            <button type="submit" disabled={isSaving} className={primaryButtonClass}>
              {isSaving ? t('savingChanges') : isEdit ? t('saveChanges') : t('createSupplier')}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
