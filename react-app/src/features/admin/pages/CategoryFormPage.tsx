import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  CATEGORY_FIELDS,
  buildCategoryFormData,
  createCategory,
  getCategory,
  listCategories,
  updateCategory,
  type Category,
  type CategoryStatus,
} from '../api/categoriesApi';
import { mapValidationErrors } from '../api/catalogApiUtils';
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

interface CategoryFormState {
  parent_id: string;
  name_mm: string;
  name_en: string;
  slug: string;
  description: string;
  sort_order: string;
  status: CategoryStatus;
  image: File | null;
}

interface ParentChoice {
  id: number;
  label: string;
}

const EMPTY_FORM: CategoryFormState = {
  parent_id: '',
  name_mm: '',
  name_en: '',
  slug: '',
  description: '',
  sort_order: '0',
  status: 'ACTIVE',
  image: null,
};

function fieldId(key: string): string {
  return `category-${key}`;
}

function fieldErrorId(key: string): string {
  return `${fieldId(key)}-error`;
}

function toFormState(category: Category): CategoryFormState {
  return {
    parent_id: category.parent_id === null ? '' : String(category.parent_id),
    name_mm: category.name_mm,
    name_en: category.name_en,
    slug: category.slug,
    description: category.description ?? '',
    sort_order: String(category.sort_order),
    status: category.status,
    image: null,
  };
}

/**
 * Create and edit share this component: `/admin/categories/new` has no route
 * param, `/admin/categories/:id/edit` loads the category first.
 */
export default function CategoryFormPage() {
  const params = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const rawId = params.id;
  const categoryId = rawId === undefined ? null : Number(rawId);
  const isEdit = categoryId !== null;

  const flashMessage = (location.state as { flash?: string } | null)?.flash ?? null;

  const [form, setForm] = useState<CategoryFormState>(EMPTY_FORM);
  const [current, setCurrent] = useState<Category | null>(null);
  const [parentOptions, setParentOptions] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState<LoadErrorState | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [isOptionsLoading, setIsOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [optionsToken, setOptionsToken] = useState(0);

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

      if (categoryId === null || !Number.isInteger(categoryId) || categoryId <= 0) {
        setLoadError({
          message: 'That category link is not valid. Open a category from the list.',
          needsLogin: false,
        });
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError(null);

      const response = await getCategory(categoryId);

      if (cancelled) return;

      if (response.success && response.data) {
        setCurrent(response.data.category);
        setForm(toFormState(response.data.category));
      } else if (response.status === 404) {
        setLoadError({
          message: 'That category could not be found. It may have been deleted.',
          needsLogin: false,
        });
      } else {
        setLoadError(describeLoadError(response, 'this category'));
      }

      setIsLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [categoryId, rawId, reloadToken]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsOptionsLoading(true);
      setOptionsError(null);

      const response = await listCategories({ per_page: 100 });

      if (cancelled) return;

      if (response.success && response.data) {
        setParentOptions(response.data.categories);
      } else if (response.status === 401) {
        setOptionsError('Your admin session has expired. Sign in again to load parent categories.');
      } else {
        setOptionsError(response.message ?? 'Parent categories could not be loaded.');
      }

      setIsOptionsLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [optionsToken]);

  const imagePreviewUrl = useMemo(
    () => (form.image ? URL.createObjectURL(form.image) : null),
    [form.image],
  );

  useEffect(() => {
    if (!imagePreviewUrl) return;
    return () => {
      URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  const parentChoices = useMemo<ParentChoice[]>(() => {
    const choices = parentOptions
      .filter((option) => option.id !== categoryId)
      .map((option) => ({ id: option.id, label: `${option.name_mm} (${option.name_en})` }));

    if (
      form.parent_id !== '' &&
      !choices.some((choice) => String(choice.id) === form.parent_id)
    ) {
      choices.push({
        id: Number(form.parent_id),
        label: `Category #${form.parent_id} (not in the first 100)`,
      });
    }

    return choices;
  }, [parentOptions, categoryId, form.parent_id]);

  const clearFieldError = (key: string) => {
    setFieldErrors((previous) => {
      if (!previous[key]) return previous;
      const next = { ...previous };
      delete next[key];
      return next;
    });
  };

  const updateField = <K extends keyof CategoryFormState>(key: K, value: CategoryFormState[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    setSuccessMessage(null);
    setFormError(null);
    clearFieldError(key);
  };

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0] ?? null;

    setSuccessMessage(null);
    setFormError(null);

    if (!file) {
      setForm((previous) => ({ ...previous, image: null }));
      clearFieldError('image');
      return;
    }

    const message = validateImageFile(file);
    if (message) {
      setForm((previous) => ({ ...previous, image: null }));
      setFieldErrors((previous) => ({ ...previous, image: [message] }));
      input.value = '';
      return;
    }

    setForm((previous) => ({ ...previous, image: file }));
    clearFieldError('image');
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

    const formData = buildCategoryFormData({
      parent_id: form.parent_id,
      name_mm: form.name_mm,
      name_en: form.name_en,
      slug: form.slug,
      description: form.description,
      sort_order: form.sort_order,
      status: form.status,
      image: form.image,
    });

    const response =
      categoryId === null
        ? await createCategory(formData)
        : await updateCategory(categoryId, formData);

    setIsSaving(false);

    if (response.success && response.data) {
      const category = response.data.category;

      if (categoryId === null) {
        navigate(`/admin/categories/${category.id}/edit`, {
          replace: true,
          state: { flash: 'Category created.' },
        });
        return;
      }

      setCurrent(category);
      setForm(toFormState(category));
      setSuccessMessage(response.message ?? 'Category updated.');
      return;
    }

    const mapped = mapValidationErrors(response.errors, CATEGORY_FIELDS);
    setFieldErrors(mapped.fieldErrors);
    setFormError(
      mapped.formErrors[0] ?? describeRequestError(response, 'The category could not be saved.'),
    );
    focusFirstError(mapped.fieldErrors);
  };

  const header = (
    <PageHeader
      title={isEdit ? 'Edit category' : 'New category'}
      description={
        isEdit
          ? current
            ? `Updating “${current.name_en || current.name_mm}”.`
            : 'Update this category.'
          : 'Create a category or subcategory for the catalog.'
      }
      action={
        <Link to="/admin/categories" className={secondaryButtonClass}>
          Back to categories
        </Link>
      }
    />
  );

  if (loadError) {
    return (
      <div className="space-y-6">
        {header}
        <div className="rounded-lg border border-red-200 bg-red-50 p-6" role="alert">
          <h2 className="text-lg font-semibold text-red-800">Category is unavailable</h2>
          <p className="mt-1 text-sm text-red-700">{loadError.message}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {loadError.needsLogin ? (
              <Link to="/admin/login" className={linkClass}>
                Go to admin login
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => setReloadToken((token) => token + 1)}
                className={primaryButtonClass}
              >
                Try again
              </button>
            )}
            <Link to="/admin/categories" className={linkClass}>
              Back to categories
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
        <LoadingPanel label="Loading category…" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

      {successMessage ? (
        <Alert tone="success">
          <p className="text-sm font-medium">{successMessage}</p>
        </Alert>
      ) : null}

      {optionsError ? (
        <Alert tone="warning">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium">{optionsError}</p>
            <button
              type="button"
              onClick={() => setOptionsToken((token) => token + 1)}
              className={secondaryButtonClass}
            >
              Reload options
            </button>
          </div>
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
            <h2 className="text-lg font-semibold text-gray-900">Category details</h2>
            <p className="mt-1 text-sm text-gray-500">
              Names appear in the catalog; the slug is the URL-friendly identifier.
            </p>
          </div>
          <div className="space-y-5 px-6 py-5">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field
                label="Name (Burmese)"
                htmlFor={fieldId('name_mm')}
                required
                error={fieldErrors.name_mm}
              >
                <input
                  id={fieldId('name_mm')}
                  type="text"
                  required
                  maxLength={255}
                  value={form.name_mm}
                  disabled={isSaving}
                  aria-invalid={Boolean(fieldErrors.name_mm) || undefined}
                  aria-describedby={joinIds(
                    Boolean(fieldErrors.name_mm) && fieldErrorId('name_mm'),
                  )}
                  onChange={(event) => updateField('name_mm', event.target.value)}
                  className={inputClass(Boolean(fieldErrors.name_mm))}
                />
              </Field>

              <Field
                label="Name (English)"
                htmlFor={fieldId('name_en')}
                required
                error={fieldErrors.name_en}
              >
                <input
                  id={fieldId('name_en')}
                  type="text"
                  required
                  maxLength={255}
                  value={form.name_en}
                  disabled={isSaving}
                  aria-invalid={Boolean(fieldErrors.name_en) || undefined}
                  aria-describedby={joinIds(
                    Boolean(fieldErrors.name_en) && fieldErrorId('name_en'),
                  )}
                  onChange={(event) => updateField('name_en', event.target.value)}
                  className={inputClass(Boolean(fieldErrors.name_en))}
                />
              </Field>
            </div>

            <Field
              label="Parent category"
              htmlFor={fieldId('parent_id')}
              error={fieldErrors.parent_id}
              hint="Leave empty for a top-level category."
              hintId={`${fieldId('parent_id')}-hint`}
            >
              <select
                id={fieldId('parent_id')}
                value={form.parent_id}
                disabled={isSaving || isOptionsLoading}
                aria-invalid={Boolean(fieldErrors.parent_id) || undefined}
                aria-describedby={joinIds(
                  `${fieldId('parent_id')}-hint`,
                  Boolean(fieldErrors.parent_id) && fieldErrorId('parent_id'),
                )}
                onChange={(event) => updateField('parent_id', event.target.value)}
                className={inputClass(Boolean(fieldErrors.parent_id))}
              >
                <option value="">
                  {isOptionsLoading ? 'Loading categories…' : 'No parent (top level)'}
                </option>
                {parentChoices.map((choice) => (
                  <option key={choice.id} value={choice.id}>
                    {choice.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label="Slug"
              htmlFor={fieldId('slug')}
              error={fieldErrors.slug}
              hint="Optional. Lowercase letters, numbers, and hyphens. Generated from the English name when left empty."
              hintId={`${fieldId('slug')}-hint`}
            >
              <input
                id={fieldId('slug')}
                type="text"
                maxLength={255}
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                title="Use lowercase letters, numbers, and single hyphens, for example home-electronics."
                value={form.slug}
                disabled={isSaving}
                aria-invalid={Boolean(fieldErrors.slug) || undefined}
                aria-describedby={joinIds(
                  `${fieldId('slug')}-hint`,
                  Boolean(fieldErrors.slug) && fieldErrorId('slug'),
                )}
                onChange={(event) => updateField('slug', event.target.value)}
                className={inputClass(Boolean(fieldErrors.slug))}
              />
            </Field>

            <Field label="Description" htmlFor={fieldId('description')} error={fieldErrors.description}>
              <textarea
                id={fieldId('description')}
                rows={4}
                maxLength={5000}
                value={form.description}
                disabled={isSaving}
                aria-invalid={Boolean(fieldErrors.description) || undefined}
                aria-describedby={joinIds(
                  Boolean(fieldErrors.description) && fieldErrorId('description'),
                )}
                onChange={(event) => updateField('description', event.target.value)}
                className={inputClass(Boolean(fieldErrors.description))}
              />
            </Field>
          </div>
        </section>

        <section className="rounded-lg bg-white shadow">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">Image and status</h2>
          </div>
          <div className="space-y-5 px-6 py-5">
            <Field
              label="Image"
              htmlFor={fieldId('image')}
              error={fieldErrors.image}
              hint="JPEG, PNG, or WebP, up to 2 MB. A new upload replaces the current image."
              hintId={`${fieldId('image')}-hint`}
            >
              <div className="flex flex-wrap items-start gap-4">
                <div className="h-24 w-24 flex-none overflow-hidden rounded-md border border-gray-200 bg-gray-50">
                  {imagePreviewUrl ? (
                    <img
                      src={imagePreviewUrl}
                      alt="Selected image preview"
                      className="h-full w-full object-cover"
                    />
                  ) : current?.image_url ? (
                    <img
                      src={current.image_url}
                      alt={current.name_en ? `Current image for ${current.name_en}` : 'Current image'}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-xs text-gray-400">
                      No image
                    </span>
                  )}
                </div>
                <input
                  id={fieldId('image')}
                  type="file"
                  accept={IMAGE_ACCEPT}
                  disabled={isSaving}
                  aria-invalid={Boolean(fieldErrors.image) || undefined}
                  aria-describedby={joinIds(
                    `${fieldId('image')}-hint`,
                    Boolean(fieldErrors.image) && fieldErrorId('image'),
                  )}
                  onChange={handleImageChange}
                  className="block w-full max-w-md text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>
            </Field>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field
                label="Sort order"
                htmlFor={fieldId('sort_order')}
                required
                error={fieldErrors.sort_order}
                hint="Lower numbers appear first in the catalog."
                hintId={`${fieldId('sort_order')}-hint`}
              >
                <input
                  id={fieldId('sort_order')}
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  required
                  value={form.sort_order}
                  disabled={isSaving}
                  aria-invalid={Boolean(fieldErrors.sort_order) || undefined}
                  aria-describedby={joinIds(
                    `${fieldId('sort_order')}-hint`,
                    Boolean(fieldErrors.sort_order) && fieldErrorId('sort_order'),
                  )}
                  onChange={(event) => updateField('sort_order', event.target.value)}
                  className={`${inputClass(Boolean(fieldErrors.sort_order))} max-w-xs`}
                />
              </Field>

              <Field label="Status" htmlFor={fieldId('status')} required error={fieldErrors.status}>
                <select
                  id={fieldId('status')}
                  required
                  value={form.status}
                  disabled={isSaving}
                  aria-invalid={Boolean(fieldErrors.status) || undefined}
                  aria-describedby={joinIds(
                    Boolean(fieldErrors.status) && fieldErrorId('status'),
                  )}
                  onChange={(event) => updateField('status', event.target.value as CategoryStatus)}
                  className={`${inputClass(Boolean(fieldErrors.status))} max-w-xs`}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </Field>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow">
          <p className="text-sm text-gray-600" aria-live="polite">
            {isSaving
              ? 'Saving changes…'
              : isEdit
                ? 'Save to apply your changes.'
                : 'The category is created once you save.'}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link to="/admin/categories" className={secondaryButtonClass}>
              Cancel
            </Link>
            <button type="submit" disabled={isSaving} className={primaryButtonClass}>
              {isSaving ? 'Saving…' : isEdit ? 'Save changes' : 'Create category'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
