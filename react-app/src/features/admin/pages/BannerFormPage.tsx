import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiSave } from 'react-icons/fi';
import {
  BANNER_FIELDS,
  buildBannerFormData,
  createBanner,
  getBanner,
  updateBanner,
  type Banner,
  type BannerStatus,
} from '../api/bannersApi';
import { mapValidationErrors } from '../api/catalogApiUtils';
import {
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
  type LoadErrorState,
} from '../../../components/catalog-ui/CatalogUi';
import { useToast } from '../../../components/ui/Toast';
import {
  BANNER_THEMES,
  DEFAULT_BANNER_THEME,
  type BannerTheme,
} from '../../../lib/banner-themes';

interface BannerFormState {
  title_mm: string;
  title_en: string;
  subtitle_mm: string;
  subtitle_en: string;
  cta_label_mm: string;
  cta_label_en: string;
  link_url: string;
  sort_order: string;
  status: BannerStatus;
  background_style: BannerTheme;
  image: File | null;
}

const EMPTY_FORM: BannerFormState = {
  title_mm: '',
  title_en: '',
  subtitle_mm: '',
  subtitle_en: '',
  cta_label_mm: '',
  cta_label_en: '',
  link_url: '/products',
  sort_order: '0',
  status: 'ACTIVE',
  background_style: DEFAULT_BANNER_THEME,
  image: null,
};

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function fieldId(key: string): string {
  return `banner-${key}`;
}

function fieldErrorId(key: string): string {
  return `${fieldId(key)}-error`;
}

function toFormState(banner: Banner): BannerFormState {
  return {
    title_mm: banner.title_mm,
    title_en: banner.title_en,
    subtitle_mm: banner.subtitle_mm ?? '',
    subtitle_en: banner.subtitle_en ?? '',
    cta_label_mm: banner.cta_label_mm ?? '',
    cta_label_en: banner.cta_label_en ?? '',
    link_url: banner.link_url ?? '',
    sort_order: String(banner.sort_order),
    status: banner.status,
    background_style: banner.background_style ?? DEFAULT_BANNER_THEME,
    image: null,
  };
}

/**
 * Create and edit share this component: `/admin/banners/new` has no route
 * param, `/admin/banners/:id/edit` loads the banner first.
 */
export default function BannerFormPage() {
  const { showToast } = useToast();
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();

  const rawId = params.id;
  const parsedId = rawId === undefined ? null : Number(rawId);
  const bannerId =
    parsedId !== null && Number.isInteger(parsedId) && parsedId > 0 ? parsedId : null;
  const isEdit = rawId !== undefined;

  const [form, setForm] = useState<BannerFormState>(EMPTY_FORM);
  const [current, setCurrent] = useState<Banner | null>(null);
  const [isLoading, setIsLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState<LoadErrorState | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const formAlertRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isEdit) {
      setForm(EMPTY_FORM);
      setCurrent(null);
      setLoadError(null);
      setIsLoading(false);
      return;
    }

    if (bannerId === null) {
      setLoadError({
        message: 'That banner link is not valid. Open a banner from the list.',
        needsLogin: false,
      });
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setLoadError(null);

      const response = await getBanner(bannerId);

      if (cancelled) return;

      if (response.success && response.data) {
        setCurrent(response.data.banner);
        setForm(toFormState(response.data.banner));
      } else {
        setLoadError(describeLoadError(response, 'banner'));
      }

      setIsLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [bannerId, isEdit, reloadToken]);

  const imagePreviewUrl = useMemo(
    () => (form.image ? URL.createObjectURL(form.image) : null),
    [form.image],
  );

  useEffect(() => {
    if (!imagePreviewUrl) return;
    return () => URL.revokeObjectURL(imagePreviewUrl);
  }, [imagePreviewUrl]);

  useEffect(() => {
    if (!formError) return;
    formAlertRef.current?.scrollIntoView({ block: 'center' });
  }, [formError]);

  const updateField = <K extends keyof BannerFormState>(
    key: K,
    value: BannerFormState[K],
  ) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    setFieldErrors((previous) => {
      if (!previous[key]) return previous;
      const next = { ...previous };
      delete next[key];
      return next;
    });
  };

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0] ?? null;

    if (!file) {
      updateField('image', null);
      return;
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setForm((previous) => ({ ...previous, image: null }));
      setFieldErrors((previous) => ({
        ...previous,
        image: ['Choose a JPEG, PNG, or WebP image.'],
      }));
      input.value = '';
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      setForm((previous) => ({ ...previous, image: null }));
      setFieldErrors((previous) => ({
        ...previous,
        image: ['The image must be 4 MB or smaller.'],
      }));
      input.value = '';
      return;
    }

    updateField('image', file);
  };

  const validate = (): Record<string, string[]> => {
    const errors: Record<string, string[]> = {};

    if (!form.title_mm.trim()) errors.title_mm = ['Enter the Myanmar title.'];
    if (!form.title_en.trim()) errors.title_en = ['Enter the English title.'];

    const link = form.link_url.trim();
    if (link && !/^(https?:\/\/|\/)/.test(link)) {
      errors.link_url = ['Use a link that starts with / or https://.'];
    }

    return errors;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsSaving(true);
    setFieldErrors({});

    const formData = buildBannerFormData(form);
    const response =
      bannerId !== null ? await updateBanner(bannerId, formData) : await createBanner(formData);

    setIsSaving(false);

    if (response.success) {
      showToast({
        title: bannerId !== null ? 'Banner updated.' : 'Banner created.',
        description: form.title_en.trim(),
      });
      navigate('/admin/banners');
      return;
    }

    const mapped = mapValidationErrors(response.errors, BANNER_FIELDS);
    setFieldErrors(mapped.fieldErrors);

    if (mapped.formErrors.length > 0) {
      setFormError(mapped.formErrors.join(' '));
    } else if (Object.keys(mapped.fieldErrors).length === 0) {
      setFormError(describeRequestError(response, 'The banner could not be saved.'));
    }
  };

  const header = (
    <PageHeader
      title={isEdit ? 'Edit banner' : 'New banner'}
      description={
        isEdit
          ? 'Update this home-page slide.'
          : 'Add a slide to the home-page hero. It appears as soon as it is active.'
      }
      action={
        <Link to="/admin/banners" className={linkClass}>
          <FiArrowLeft aria-hidden="true" className="h-4 w-4" />
          Back to banners
        </Link>
      }
    />
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        {header}
        <LoadingPanel label="Loading banner…" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-6">
        {header}
        <div className="rounded-lg border border-red-200 bg-red-50 p-6" role="alert">
          <h2 className="text-lg font-semibold text-red-800">Banner is unavailable</h2>
          <p className="mt-1 text-sm text-red-700">{loadError.message}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {bannerId !== null ? (
              <button
                type="button"
                onClick={() => setReloadToken((token) => token + 1)}
                className={primaryButtonClass}
              >
                Try again
              </button>
            ) : null}
            {loadError.needsLogin ? (
              <Link to="/admin/login" className={linkClass}>
                Go to admin login
              </Link>
            ) : (
              <Link to="/admin/banners" className={linkClass}>
                Back to banners
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

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
            <h2 className="text-lg font-semibold text-gray-900">Text content</h2>
            <p className="mt-1 text-sm text-gray-500">
              The headline and supporting line shown beside the image.
            </p>
          </div>
          <div className="space-y-5 px-6 py-5">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field
                label="Title (English)"
                htmlFor={fieldId('title_en')}
                required
                error={fieldErrors.title_en}
              >
                <input
                  id={fieldId('title_en')}
                  type="text"
                  required
                  maxLength={120}
                  value={form.title_en}
                  disabled={isSaving}
                  aria-invalid={Boolean(fieldErrors.title_en) || undefined}
                  aria-describedby={joinIds(
                    Boolean(fieldErrors.title_en) && fieldErrorId('title_en'),
                  )}
                  onChange={(event) => updateField('title_en', event.target.value)}
                  className={inputClass(Boolean(fieldErrors.title_en))}
                />
              </Field>

              <Field
                label="Title (Burmese)"
                htmlFor={fieldId('title_mm')}
                required
                error={fieldErrors.title_mm}
              >
                <input
                  id={fieldId('title_mm')}
                  type="text"
                  required
                  maxLength={120}
                  value={form.title_mm}
                  disabled={isSaving}
                  aria-invalid={Boolean(fieldErrors.title_mm) || undefined}
                  aria-describedby={joinIds(
                    Boolean(fieldErrors.title_mm) && fieldErrorId('title_mm'),
                  )}
                  onChange={(event) => updateField('title_mm', event.target.value)}
                  className={inputClass(Boolean(fieldErrors.title_mm))}
                />
              </Field>

              <Field
                label="Subtitle (English)"
                htmlFor={fieldId('subtitle_en')}
                error={fieldErrors.subtitle_en}
                hint="Optional."
              >
                <input
                  id={fieldId('subtitle_en')}
                  type="text"
                  maxLength={255}
                  value={form.subtitle_en}
                  disabled={isSaving}
                  aria-invalid={Boolean(fieldErrors.subtitle_en) || undefined}
                  aria-describedby={joinIds(
                    Boolean(fieldErrors.subtitle_en) && fieldErrorId('subtitle_en'),
                  )}
                  onChange={(event) => updateField('subtitle_en', event.target.value)}
                  className={inputClass(Boolean(fieldErrors.subtitle_en))}
                />
              </Field>

              <Field
                label="Subtitle (Burmese)"
                htmlFor={fieldId('subtitle_mm')}
                error={fieldErrors.subtitle_mm}
                hint="Optional."
              >
                <input
                  id={fieldId('subtitle_mm')}
                  type="text"
                  maxLength={255}
                  value={form.subtitle_mm}
                  disabled={isSaving}
                  aria-invalid={Boolean(fieldErrors.subtitle_mm) || undefined}
                  aria-describedby={joinIds(
                    Boolean(fieldErrors.subtitle_mm) && fieldErrorId('subtitle_mm'),
                  )}
                  onChange={(event) => updateField('subtitle_mm', event.target.value)}
                  className={inputClass(Boolean(fieldErrors.subtitle_mm))}
                />
              </Field>
            </div>
          </div>
        </section>

        <section className="rounded-lg bg-white shadow">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">Button</h2>
            <p className="mt-1 text-sm text-gray-500">
              The call-to-action shown under the text. Leave the link empty to hide the button.
            </p>
          </div>
          <div className="space-y-5 px-6 py-5">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field
                label="Button label (English)"
                htmlFor={fieldId('cta_label_en')}
                error={fieldErrors.cta_label_en}
                hint="For example: Shop now."
              >
                <input
                  id={fieldId('cta_label_en')}
                  type="text"
                  maxLength={60}
                  value={form.cta_label_en}
                  disabled={isSaving}
                  aria-invalid={Boolean(fieldErrors.cta_label_en) || undefined}
                  aria-describedby={joinIds(
                    Boolean(fieldErrors.cta_label_en) && fieldErrorId('cta_label_en'),
                  )}
                  onChange={(event) => updateField('cta_label_en', event.target.value)}
                  className={inputClass(Boolean(fieldErrors.cta_label_en))}
                />
              </Field>

              <Field
                label="Button label (Burmese)"
                htmlFor={fieldId('cta_label_mm')}
                error={fieldErrors.cta_label_mm}
                hint="For example: ယခုဝယ်ရန်."
              >
                <input
                  id={fieldId('cta_label_mm')}
                  type="text"
                  maxLength={60}
                  value={form.cta_label_mm}
                  disabled={isSaving}
                  aria-invalid={Boolean(fieldErrors.cta_label_mm) || undefined}
                  aria-describedby={joinIds(
                    Boolean(fieldErrors.cta_label_mm) && fieldErrorId('cta_label_mm'),
                  )}
                  onChange={(event) => updateField('cta_label_mm', event.target.value)}
                  className={inputClass(Boolean(fieldErrors.cta_label_mm))}
                />
              </Field>
            </div>

            <Field
              label="Button link"
              htmlFor={fieldId('link_url')}
              error={fieldErrors.link_url}
              hint="Starts with / (for example /products) or https://. Leave empty to hide the button."
            >
              <input
                id={fieldId('link_url')}
                type="text"
                maxLength={2048}
                value={form.link_url}
                disabled={isSaving}
                placeholder="/products"
                aria-invalid={Boolean(fieldErrors.link_url) || undefined}
                aria-describedby={joinIds(
                  Boolean(fieldErrors.link_url) && fieldErrorId('link_url'),
                )}
                onChange={(event) => updateField('link_url', event.target.value)}
                className={inputClass(Boolean(fieldErrors.link_url))}
              />
            </Field>
          </div>
        </section>

        <section className="rounded-lg bg-white shadow">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">Background theme</h2>
            <p className="mt-1 text-sm text-gray-500">
              The palette behind the text-only home hero. Each banner can use its own.
            </p>
          </div>
          <div className="px-6 py-5">
            <div
              role="radiogroup"
              aria-label="Background theme"
              className="grid grid-cols-2 gap-3 sm:grid-cols-5"
            >
              {BANNER_THEMES.map((theme) => {
                const selected = form.background_style === theme.value;

                return (
                  <button
                    key={theme.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={`${theme.label}: ${theme.description}`}
                    disabled={isSaving}
                    onClick={() => updateField('background_style', theme.value)}
                    className={`overflow-hidden rounded-xl border text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
                      selected
                        ? 'border-primary ring-2 ring-primary/30'
                        : 'border-line hover:border-primary/40'
                    }`}
                  >
                    <span
                      className="flex h-16 items-end p-3"
                      style={{ backgroundImage: theme.background }}
                    >
                      <span
                        className="text-lg font-black leading-none"
                        style={{ color: theme.heading }}
                      >
                        Aa
                      </span>
                    </span>
                    <span className="block px-3 py-2">
                      <span className="block text-sm font-semibold text-ink">
                        {theme.label}
                      </span>
                      {selected ? (
                        <span className="block text-[11px] font-medium text-primary">
                          Selected
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
            {fieldErrors.background_style ? (
              <p className="mt-2 text-sm text-error">{fieldErrors.background_style[0]}</p>
            ) : null}
          </div>
        </section>

        <section className="rounded-lg bg-white shadow">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">Image and visibility</h2>
            <p className="mt-1 text-sm text-gray-500">
              An optional image shown beside the text, plus where the banner sits on the home page.
            </p>
          </div>
          <div className="space-y-5 px-6 py-5">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              <div className="h-40 w-40 flex-none overflow-hidden rounded-xl border border-line bg-paper">
                {imagePreviewUrl ? (
                  <img
                    src={imagePreviewUrl}
                    alt="Selected banner preview"
                    className="h-full w-full object-cover"
                  />
                ) : current?.image_url ? (
                  <img
                    src={current.image_url}
                    alt="Current banner image"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-subtle">
                    No image
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <Field
                  label="Banner image (optional)"
                  htmlFor={fieldId('image')}
                  error={fieldErrors.image}
                  hint="JPEG, PNG, or WebP, up to 4 MB. Shown beside the text; square (1200 × 1200) images work best. A new upload replaces the current image."
                >
                  <input
                    id={fieldId('image')}
                    type="file"
                    accept={IMAGE_ACCEPT}
                    disabled={isSaving}
                    aria-invalid={Boolean(fieldErrors.image) || undefined}
                    aria-describedby={joinIds(
                      Boolean(fieldErrors.image) && fieldErrorId('image'),
                    )}
                    onChange={handleImageChange}
                    className="block w-full max-w-md text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </Field>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field
                label="Order"
                htmlFor={fieldId('sort_order')}
                error={fieldErrors.sort_order}
                hint="Lower numbers appear first."
              >
                <input
                  id={fieldId('sort_order')}
                  type="number"
                  min={0}
                  step={1}
                  value={form.sort_order}
                  disabled={isSaving}
                  aria-invalid={Boolean(fieldErrors.sort_order) || undefined}
                  aria-describedby={joinIds(
                    Boolean(fieldErrors.sort_order) && fieldErrorId('sort_order'),
                  )}
                  onChange={(event) => updateField('sort_order', event.target.value)}
                  className={`${inputClass(Boolean(fieldErrors.sort_order))} max-w-xs`}
                />
              </Field>

              <Field
                label="Status"
                htmlFor={fieldId('status')}
                error={fieldErrors.status}
                hint="Inactive banners stay hidden from the storefront."
              >
                <select
                  id={fieldId('status')}
                  value={form.status}
                  disabled={isSaving}
                  aria-invalid={Boolean(fieldErrors.status) || undefined}
                  aria-describedby={joinIds(
                    Boolean(fieldErrors.status) && fieldErrorId('status'),
                  )}
                  onChange={(event) =>
                    updateField('status', event.target.value as BannerStatus)
                  }
                  className={`${inputClass(Boolean(fieldErrors.status))} max-w-xs`}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </Field>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={isSaving} className={primaryButtonClass}>
            <FiSave aria-hidden="true" className="mr-1.5 h-4 w-4" />
            {isSaving ? 'Saving…' : isEdit ? 'Save changes' : 'Create banner'}
          </button>
          <Link to="/admin/banners" className={secondaryButtonClass}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
