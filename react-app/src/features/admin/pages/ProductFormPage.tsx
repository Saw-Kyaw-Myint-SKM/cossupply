import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { listCategories, type Category } from '../api/categoriesApi';
import { listSuppliers, type Supplier } from '../api/suppliersApi';
import {
  PRODUCT_FIELDS,
  buildProductFormData,
  createProduct,
  getProduct,
  updateProduct,
  type Product,
  type ProductInput,
  type ProductStatus,
  type StockStatus,
} from '../api/productsApi';
import { mapValidationErrors } from '../api/catalogApiUtils';
import {
  Alert,
  Field,
  IMAGE_ACCEPT,
  LoadingPanel,
  PageHeader,
  StatusBadge,
  describeLoadError,
  describeRequestError,
  formatStatusLabel,
  inputClass,
  joinIds,
  linkClass,
  primaryButtonClass,
  secondaryButtonClass,
  validateImageFile,
  type LoadErrorState,
} from '../../../components/catalog-ui/CatalogUi';

interface ProductFormState {
  supplier_id: string;
  category_id: string;
  name_mm: string;
  name_en: string;
  slug: string;
  sku: string;
  brand: string;
  model: string;
  unit: string;
  package_size: string;
  size: string;
  color: string;
  description: string;
  specification: string;
  photo: File | null;
  status: ProductStatus;
  retail_price: string;
  wholesale_price: string;
  discount_price: string;
  minimum_order_quantity: string;
  price_valid_until: string;
  stock_quantity: string;
  stock_status: '' | StockStatus;
  supplier_note: string;
}

const EMPTY_FORM: ProductFormState = {
  supplier_id: '',
  category_id: '',
  name_mm: '',
  name_en: '',
  slug: '',
  sku: '',
  brand: '',
  model: '',
  unit: '',
  package_size: '',
  size: '',
  color: '',
  description: '',
  specification: '',
  photo: null,
  status: 'DRAFT',
  retail_price: '',
  wholesale_price: '',
  discount_price: '',
  minimum_order_quantity: '',
  price_valid_until: '',
  stock_quantity: '',
  stock_status: '',
  supplier_note: '',
};

const CREATE_STATUS_OPTIONS: ProductStatus[] = ['DRAFT', 'PUBLISHED'];

const STOCK_STATUS_OPTIONS: StockStatus[] = [
  'IN_STOCK',
  'LOW_STOCK',
  'OUT_OF_STOCK',
  'PRE_ORDER',
  'SUPPLIER_CONFIRMATION_REQUIRED',
];

const SLUG_PATTERN = '^[a-z0-9]+(?:-[a-z0-9]+)*$';

function fieldId(key: string): string {
  return `product-${key}`;
}

function fieldErrorId(key: string): string {
  return `${fieldId(key)}-error`;
}

function numberText(value: number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

function toFormState(product: Product): ProductFormState {
  return {
    supplier_id: String(product.supplier_id),
    category_id: String(product.category_id),
    name_mm: product.name_mm,
    name_en: product.name_en ?? '',
    slug: product.slug,
    sku: product.sku ?? '',
    brand: product.brand ?? '',
    model: product.model ?? '',
    unit: product.unit,
    package_size: product.package_size ?? '',
    size: product.size ?? '',
    color: product.color ?? '',
    description: product.description ?? '',
    specification: product.specification ?? '',
    photo: null,
    status: product.status,
    retail_price: numberText(product.price?.retail_price),
    wholesale_price: numberText(product.price?.wholesale_price),
    discount_price: numberText(product.price?.discount_price),
    minimum_order_quantity: numberText(product.price?.minimum_order_quantity),
    price_valid_until: product.price?.price_valid_until
      ? product.price.price_valid_until.slice(0, 10)
      : '',
    stock_quantity: numberText(product.stock?.stock_quantity),
    stock_status: product.stock?.stock_status ?? '',
    supplier_note: product.stock?.supplier_note ?? '',
  };
}

function supplierOptionLabel(supplier: Supplier): string {
  return supplier.status === 'ACTIVE'
    ? supplier.shop_name
    : `${supplier.shop_name} (${formatStatusLabel(supplier.status)})`;
}

function categoryOptionLabel(category: Category): string {
  return `${category.name_mm} (${category.name_en})`;
}

function stockStatusLabel(status: StockStatus): string {
  if (status === 'PRE_ORDER') return 'Pre-order';
  if (status === 'SUPPLIER_CONFIRMATION_REQUIRED') return 'Supplier confirmation required';
  return formatStatusLabel(status);
}

interface OptionChoice {
  id: number;
  label: string;
}

/**
 * Create and edit share this component: `/admin/products/new` has no route
 * param, `/admin/products/:id/edit` loads the product first.
 *
 * Status is editable on create only; afterwards it changes through the
 * `PATCH /admin/products/{id}/status` quick actions on the list page.
 */
export default function ProductFormPage() {
  const params = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const rawId = params.id;
  const productId = rawId === undefined ? null : Number(rawId);
  const isEdit = productId !== null;

  const flashMessage = (location.state as { flash?: string } | null)?.flash ?? null;

  const [form, setForm] = useState<ProductFormState>(EMPTY_FORM);
  const [current, setCurrent] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState<LoadErrorState | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [categoryOptions, setCategoryOptions] = useState<Category[]>([]);
  const [supplierOptions, setSupplierOptions] = useState<Supplier[]>([]);
  const [isOptionsLoading, setIsOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState<LoadErrorState | null>(null);
  const [optionsReloadToken, setOptionsReloadToken] = useState(0);

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

  // Supplier and category choices for the selects.
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsOptionsLoading(true);
      setOptionsError(null);

      const [categoriesResponse, suppliersResponse] = await Promise.all([
        listCategories({ per_page: 100 }),
        listSuppliers({ per_page: 100 }),
      ]);

      if (cancelled) return;

      if (categoriesResponse.success && categoriesResponse.data) {
        setCategoryOptions(categoriesResponse.data.categories);
      }
      if (suppliersResponse.success && suppliersResponse.data) {
        setSupplierOptions(suppliersResponse.data.suppliers);
      }

      if (!categoriesResponse.success || !suppliersResponse.success) {
        const failure = !categoriesResponse.success ? categoriesResponse : suppliersResponse;
        setOptionsError(describeLoadError(failure, 'the supplier and category lists'));
      }

      setIsOptionsLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [optionsReloadToken]);

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

      if (productId === null || !Number.isInteger(productId) || productId <= 0) {
        setLoadError({
          message: 'That product link is not valid. Open a product from the list.',
          needsLogin: false,
        });
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError(null);

      const response = await getProduct(productId);

      if (cancelled) return;

      if (response.success && response.data) {
        setCurrent(response.data.product);
        setForm(toFormState(response.data.product));
      } else if (response.status === 404) {
        setLoadError({
          message: 'That product could not be found. It may have been removed.',
          needsLogin: false,
        });
      } else {
        setLoadError(describeLoadError(response, 'this product'));
      }

      setIsLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [productId, rawId, reloadToken]);

  const photoPreviewUrl = useMemo(
    () => (form.photo ? URL.createObjectURL(form.photo) : null),
    [form.photo],
  );

  useEffect(() => {
    if (!photoPreviewUrl) return;
    return () => {
      URL.revokeObjectURL(photoPreviewUrl);
    };
  }, [photoPreviewUrl]);

  // Keep the edited product selectable even when it falls outside the first
  // options page by merging the entities embedded in the product payload.
  const supplierChoices = useMemo<OptionChoice[]>(() => {
    const choices = supplierOptions.map((supplier) => ({
      id: supplier.id,
      label: supplierOptionLabel(supplier),
    }));

    const embedded = current?.supplier;
    if (embedded && !choices.some((choice) => choice.id === embedded.id)) {
      choices.unshift({ id: embedded.id, label: embedded.shop_name });
    }

    return choices;
  }, [supplierOptions, current]);

  const categoryChoices = useMemo<OptionChoice[]>(() => {
    const choices = categoryOptions.map((category) => ({
      id: category.id,
      label: categoryOptionLabel(category),
    }));

    const embedded = current?.category;
    if (embedded && !choices.some((choice) => choice.id === embedded.id)) {
      choices.unshift({ id: embedded.id, label: `${embedded.name_mm} (${embedded.name_en})` });
    }

    return choices;
  }, [categoryOptions, current]);

  const retailValue = Number.parseInt(form.retail_price, 10);
  const discountValue = Number.parseInt(form.discount_price, 10);
  const discountExceedsRetail =
    Number.isFinite(retailValue) && Number.isFinite(discountValue) && discountValue > retailValue;

  const clearFieldError = (key: string) => {
    setFieldErrors((previous) => {
      if (!previous[key]) return previous;
      const next = { ...previous };
      delete next[key];
      return next;
    });
  };

  const updateField = <K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    setSuccessMessage(null);
    setFormError(null);
    clearFieldError(key);
  };

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0] ?? null;

    setSuccessMessage(null);
    setFormError(null);

    if (!file) {
      setForm((previous) => ({ ...previous, photo: null }));
      clearFieldError('photo');
      return;
    }

    const message = validateImageFile(file);
    if (message) {
      setForm((previous) => ({ ...previous, photo: null }));
      setFieldErrors((previous) => ({ ...previous, photo: [message] }));
      input.value = '';
      return;
    }

    setForm((previous) => ({ ...previous, photo: file }));
    clearFieldError('photo');
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

    const input: ProductInput = {
      supplier_id: form.supplier_id,
      category_id: form.category_id,
      name_mm: form.name_mm,
      name_en: form.name_en,
      slug: form.slug,
      sku: form.sku,
      brand: form.brand,
      model: form.model,
      description: form.description,
      specification: form.specification,
      size: form.size,
      color: form.color,
      unit: form.unit,
      package_size: form.package_size,
      photo: form.photo,
      status: form.status,
      retail_price: form.retail_price,
      wholesale_price: form.wholesale_price,
      discount_price: form.discount_price,
      minimum_order_quantity: form.minimum_order_quantity,
      price_valid_until: form.price_valid_until,
      stock_quantity: form.stock_quantity,
      stock_status: form.stock_status,
      supplier_note: form.supplier_note,
    };

    // Status is a create-only field; updates must go through the status endpoint.
    const formData = buildProductFormData(input, { includeStatus: !isEdit });

    const response =
      productId === null
        ? await createProduct(formData)
        : await updateProduct(productId, formData);

    setIsSaving(false);

    if (response.success && response.data) {
      const product = response.data.product;

      if (productId === null) {
        navigate(`/admin/products/${product.id}/edit`, {
          replace: true,
          state: { flash: 'Product created.' },
        });
        return;
      }

      setCurrent(product);
      setForm(toFormState(product));
      setSuccessMessage(response.message ?? 'Product updated.');
      return;
    }

    const mapped = mapValidationErrors(response.errors, PRODUCT_FIELDS);
    setFieldErrors(mapped.fieldErrors);
    setFormError(
      mapped.formErrors[0] ?? describeRequestError(response, 'The product could not be saved.'),
    );
    focusFirstError(mapped.fieldErrors);
  };

  const header = (
    <PageHeader
      title={isEdit ? 'Edit product' : 'New product'}
      description={
        isEdit
          ? current
            ? `Updating “${current.name_mm}”.`
            : 'Update this product.'
          : 'Add a product to the catalog. You can save it as a draft and publish it later.'
      }
      action={
        <Link to="/admin/products" className={secondaryButtonClass}>
          Back to products
        </Link>
      }
    />
  );

  if (loadError) {
    return (
      <div className="space-y-6">
        {header}
        <div className="rounded-lg border border-red-200 bg-red-50 p-6" role="alert">
          <h2 className="text-lg font-semibold text-red-800">Product is unavailable</h2>
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
            <Link to="/admin/products" className={linkClass}>
              Back to products
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
        <LoadingPanel label="Loading product…" />
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

      {optionsError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4" role="alert">
          <p className="text-sm font-medium text-amber-800">{optionsError.message}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {optionsError.needsLogin ? (
              <Link to="/admin/login" className={linkClass}>
                Go to admin login
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => setOptionsReloadToken((token) => token + 1)}
                className={secondaryButtonClass}
              >
                Retry lists
              </button>
            )}
          </div>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-6" aria-busy={isSaving || undefined}>
        <section className="rounded-lg bg-white shadow">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">Product details</h2>
            <p className="mt-1 text-sm text-gray-500">
              Identity and basic information customers will see.
            </p>
          </div>
          <div className="space-y-5 px-6 py-5">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field
                label="Supplier"
                htmlFor={fieldId('supplier_id')}
                required
                error={fieldErrors.supplier_id}
                hint="The supplier must be active before this product can be published."
                hintId={`${fieldId('supplier_id')}-hint`}
              >
                <select
                  id={fieldId('supplier_id')}
                  required
                  value={form.supplier_id}
                  disabled={isSaving || isOptionsLoading}
                  aria-invalid={Boolean(fieldErrors.supplier_id) || undefined}
                  aria-describedby={joinIds(
                    `${fieldId('supplier_id')}-hint`,
                    Boolean(fieldErrors.supplier_id) && fieldErrorId('supplier_id'),
                  )}
                  onChange={(event) => updateField('supplier_id', event.target.value)}
                  className={inputClass(Boolean(fieldErrors.supplier_id))}
                >
                  <option value="">
                    {isOptionsLoading ? 'Loading suppliers…' : 'Select a supplier'}
                  </option>
                  {supplierChoices.map((choice) => (
                    <option key={choice.id} value={String(choice.id)}>
                      {choice.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field
                label="Category"
                htmlFor={fieldId('category_id')}
                required
                error={fieldErrors.category_id}
                hint="The category must be active before this product can be published."
                hintId={`${fieldId('category_id')}-hint`}
              >
                <select
                  id={fieldId('category_id')}
                  required
                  value={form.category_id}
                  disabled={isSaving || isOptionsLoading}
                  aria-invalid={Boolean(fieldErrors.category_id) || undefined}
                  aria-describedby={joinIds(
                    `${fieldId('category_id')}-hint`,
                    Boolean(fieldErrors.category_id) && fieldErrorId('category_id'),
                  )}
                  onChange={(event) => updateField('category_id', event.target.value)}
                  className={inputClass(Boolean(fieldErrors.category_id))}
                >
                  <option value="">
                    {isOptionsLoading ? 'Loading categories…' : 'Select a category'}
                  </option>
                  {categoryChoices.map((choice) => (
                    <option key={choice.id} value={String(choice.id)}>
                      {choice.label}
                    </option>
                  ))}
                </select>
              </Field>

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
                  aria-describedby={joinIds(Boolean(fieldErrors.name_mm) && fieldErrorId('name_mm'))}
                  onChange={(event) => updateField('name_mm', event.target.value)}
                  className={inputClass(Boolean(fieldErrors.name_mm))}
                />
              </Field>

              <Field
                label="Name (English)"
                htmlFor={fieldId('name_en')}
                error={fieldErrors.name_en}
              >
                <input
                  id={fieldId('name_en')}
                  type="text"
                  maxLength={255}
                  value={form.name_en}
                  disabled={isSaving}
                  aria-invalid={Boolean(fieldErrors.name_en) || undefined}
                  aria-describedby={joinIds(Boolean(fieldErrors.name_en) && fieldErrorId('name_en'))}
                  onChange={(event) => updateField('name_en', event.target.value)}
                  className={inputClass(Boolean(fieldErrors.name_en))}
                />
              </Field>

              <Field
                label="Slug"
                htmlFor={fieldId('slug')}
                error={fieldErrors.slug}
                hint={
                  isEdit
                    ? 'Lowercase letters, numbers, and dashes. Leave empty to keep the current slug.'
                    : 'Lowercase letters, numbers, and dashes. Leave empty to generate it from the English name.'
                }
                hintId={`${fieldId('slug')}-hint`}
              >
                <input
                  id={fieldId('slug')}
                  type="text"
                  maxLength={255}
                  pattern={SLUG_PATTERN}
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

              <Field label="SKU" htmlFor={fieldId('sku')} error={fieldErrors.sku}>
                <input
                  id={fieldId('sku')}
                  type="text"
                  maxLength={100}
                  value={form.sku}
                  disabled={isSaving}
                  aria-invalid={Boolean(fieldErrors.sku) || undefined}
                  aria-describedby={joinIds(Boolean(fieldErrors.sku) && fieldErrorId('sku'))}
                  onChange={(event) => updateField('sku', event.target.value)}
                  className={inputClass(Boolean(fieldErrors.sku))}
                />
              </Field>

              <Field label="Brand" htmlFor={fieldId('brand')} error={fieldErrors.brand}>
                <input
                  id={fieldId('brand')}
                  type="text"
                  maxLength={255}
                  value={form.brand}
                  disabled={isSaving}
                  aria-invalid={Boolean(fieldErrors.brand) || undefined}
                  aria-describedby={joinIds(Boolean(fieldErrors.brand) && fieldErrorId('brand'))}
                  onChange={(event) => updateField('brand', event.target.value)}
                  className={inputClass(Boolean(fieldErrors.brand))}
                />
              </Field>

              <Field label="Model" htmlFor={fieldId('model')} error={fieldErrors.model}>
                <input
                  id={fieldId('model')}
                  type="text"
                  maxLength={255}
                  value={form.model}
                  disabled={isSaving}
                  aria-invalid={Boolean(fieldErrors.model) || undefined}
                  aria-describedby={joinIds(Boolean(fieldErrors.model) && fieldErrorId('model'))}
                  onChange={(event) => updateField('model', event.target.value)}
                  className={inputClass(Boolean(fieldErrors.model))}
                />
              </Field>

              <Field
                label="Unit"
                htmlFor={fieldId('unit')}
                required
                error={fieldErrors.unit}
                hint="How the product is sold, e.g. piece, set, box."
                hintId={`${fieldId('unit')}-hint`}
              >
                <input
                  id={fieldId('unit')}
                  type="text"
                  required
                  maxLength={50}
                  value={form.unit}
                  disabled={isSaving}
                  aria-invalid={Boolean(fieldErrors.unit) || undefined}
                  aria-describedby={joinIds(
                    `${fieldId('unit')}-hint`,
                    Boolean(fieldErrors.unit) && fieldErrorId('unit'),
                  )}
                  onChange={(event) => updateField('unit', event.target.value)}
                  className={inputClass(Boolean(fieldErrors.unit))}
                />
              </Field>

              <Field
                label="Package size"
                htmlFor={fieldId('package_size')}
                error={fieldErrors.package_size}
              >
                <input
                  id={fieldId('package_size')}
                  type="text"
                  maxLength={100}
                  value={form.package_size}
                  disabled={isSaving}
                  aria-invalid={Boolean(fieldErrors.package_size) || undefined}
                  aria-describedby={joinIds(
                    Boolean(fieldErrors.package_size) && fieldErrorId('package_size'),
                  )}
                  onChange={(event) => updateField('package_size', event.target.value)}
                  className={inputClass(Boolean(fieldErrors.package_size))}
                />
              </Field>

              <Field label="Size" htmlFor={fieldId('size')} error={fieldErrors.size}>
                <input
                  id={fieldId('size')}
                  type="text"
                  maxLength={100}
                  value={form.size}
                  disabled={isSaving}
                  aria-invalid={Boolean(fieldErrors.size) || undefined}
                  aria-describedby={joinIds(Boolean(fieldErrors.size) && fieldErrorId('size'))}
                  onChange={(event) => updateField('size', event.target.value)}
                  className={inputClass(Boolean(fieldErrors.size))}
                />
              </Field>

              <Field label="Color" htmlFor={fieldId('color')} error={fieldErrors.color}>
                <input
                  id={fieldId('color')}
                  type="text"
                  maxLength={100}
                  value={form.color}
                  disabled={isSaving}
                  aria-invalid={Boolean(fieldErrors.color) || undefined}
                  aria-describedby={joinIds(Boolean(fieldErrors.color) && fieldErrorId('color'))}
                  onChange={(event) => updateField('color', event.target.value)}
                  className={inputClass(Boolean(fieldErrors.color))}
                />
              </Field>
            </div>
          </div>
        </section>

        <section className="rounded-lg bg-white shadow">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">Description</h2>
          </div>
          <div className="space-y-5 px-6 py-5">
            <Field
              label="Description"
              htmlFor={fieldId('description')}
              error={fieldErrors.description}
            >
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

            <Field
              label="Specification"
              htmlFor={fieldId('specification')}
              error={fieldErrors.specification}
              hint="Technical details, materials, or measurements."
              hintId={`${fieldId('specification')}-hint`}
            >
              <textarea
                id={fieldId('specification')}
                rows={4}
                maxLength={5000}
                value={form.specification}
                disabled={isSaving}
                aria-invalid={Boolean(fieldErrors.specification) || undefined}
                aria-describedby={joinIds(
                  `${fieldId('specification')}-hint`,
                  Boolean(fieldErrors.specification) && fieldErrorId('specification'),
                )}
                onChange={(event) => updateField('specification', event.target.value)}
                className={inputClass(Boolean(fieldErrors.specification))}
              />
            </Field>
          </div>
        </section>

        <section className="rounded-lg bg-white shadow">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">Photo</h2>
          </div>
          <div className="space-y-5 px-6 py-5">
            <Field
              label="Product photo"
              htmlFor={fieldId('photo')}
              required={!isEdit}
              error={fieldErrors.photo}
              hint={
                isEdit
                  ? 'JPEG, PNG, or WebP, up to 2 MB. A new upload replaces the current photo.'
                  : 'JPEG, PNG, or WebP, up to 2 MB. Required to create a product.'
              }
              hintId={`${fieldId('photo')}-hint`}
            >
              <div className="flex flex-wrap items-start gap-4">
                <div className="h-32 w-32 flex-none overflow-hidden rounded-md border border-gray-200 bg-gray-50">
                  {photoPreviewUrl ? (
                    <img
                      src={photoPreviewUrl}
                      alt="Selected product photo preview"
                      className="h-full w-full object-cover"
                    />
                  ) : current?.photo_url ? (
                    <img
                      src={current.photo_url}
                      alt={current.name_mm ? `Current photo for ${current.name_mm}` : 'Current photo'}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-xs text-gray-400">
                      No photo
                    </span>
                  )}
                </div>
                <input
                  id={fieldId('photo')}
                  type="file"
                  accept={IMAGE_ACCEPT}
                  required={!isEdit}
                  disabled={isSaving}
                  aria-invalid={Boolean(fieldErrors.photo) || undefined}
                  aria-describedby={joinIds(
                    `${fieldId('photo')}-hint`,
                    Boolean(fieldErrors.photo) && fieldErrorId('photo'),
                  )}
                  onChange={handlePhotoChange}
                  className="block w-full max-w-md text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>
            </Field>
          </div>
        </section>

        <section className="rounded-lg bg-white shadow">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">Pricing</h2>
            <p className="mt-1 text-sm text-gray-500">
              Prices are in MMK. The retail price is required; the rest are optional.
            </p>
          </div>
          <div className="space-y-5 px-6 py-5">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field
                label="Retail price (MMK)"
                htmlFor={fieldId('retail_price')}
                required
                error={fieldErrors.retail_price}
              >
                <input
                  id={fieldId('retail_price')}
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  required
                  value={form.retail_price}
                  disabled={isSaving}
                  aria-invalid={Boolean(fieldErrors.retail_price) || undefined}
                  aria-describedby={joinIds(
                    Boolean(fieldErrors.retail_price) && fieldErrorId('retail_price'),
                  )}
                  onChange={(event) => updateField('retail_price', event.target.value)}
                  className={inputClass(Boolean(fieldErrors.retail_price))}
                />
              </Field>

              <Field
                label="Wholesale price (MMK)"
                htmlFor={fieldId('wholesale_price')}
                error={fieldErrors.wholesale_price}
              >
                <input
                  id={fieldId('wholesale_price')}
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  value={form.wholesale_price}
                  disabled={isSaving}
                  aria-invalid={Boolean(fieldErrors.wholesale_price) || undefined}
                  aria-describedby={joinIds(
                    Boolean(fieldErrors.wholesale_price) && fieldErrorId('wholesale_price'),
                  )}
                  onChange={(event) => updateField('wholesale_price', event.target.value)}
                  className={inputClass(Boolean(fieldErrors.wholesale_price))}
                />
              </Field>

              <Field
                label="Discount price (MMK)"
                htmlFor={fieldId('discount_price')}
                error={fieldErrors.discount_price}
                hint={
                  discountExceedsRetail ? (
                    <span className="font-medium text-amber-700">
                      Higher than the retail price — this will be rejected on save.
                    </span>
                  ) : (
                    'Optional. Must not be greater than the retail price.'
                  )
                }
                hintId={`${fieldId('discount_price')}-hint`}
              >
                <input
                  id={fieldId('discount_price')}
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  value={form.discount_price}
                  disabled={isSaving}
                  aria-invalid={Boolean(fieldErrors.discount_price) || undefined}
                  aria-describedby={joinIds(
                    `${fieldId('discount_price')}-hint`,
                    Boolean(fieldErrors.discount_price) && fieldErrorId('discount_price'),
                  )}
                  onChange={(event) => updateField('discount_price', event.target.value)}
                  className={inputClass(Boolean(fieldErrors.discount_price))}
                />
              </Field>

              <Field
                label="Minimum order quantity"
                htmlFor={fieldId('minimum_order_quantity')}
                error={fieldErrors.minimum_order_quantity}
                hint="Smallest quantity customers may order."
                hintId={`${fieldId('minimum_order_quantity')}-hint`}
              >
                <input
                  id={fieldId('minimum_order_quantity')}
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  value={form.minimum_order_quantity}
                  disabled={isSaving}
                  aria-invalid={Boolean(fieldErrors.minimum_order_quantity) || undefined}
                  aria-describedby={joinIds(
                    `${fieldId('minimum_order_quantity')}-hint`,
                    Boolean(fieldErrors.minimum_order_quantity) &&
                      fieldErrorId('minimum_order_quantity'),
                  )}
                  onChange={(event) => updateField('minimum_order_quantity', event.target.value)}
                  className={inputClass(Boolean(fieldErrors.minimum_order_quantity))}
                />
              </Field>

              <Field
                label="Price valid until"
                htmlFor={fieldId('price_valid_until')}
                error={fieldErrors.price_valid_until}
                hint="When the supplier price should be re-checked. Leave empty when there is no expiry."
                hintId={`${fieldId('price_valid_until')}-hint`}
              >
                <input
                  id={fieldId('price_valid_until')}
                  type="date"
                  value={form.price_valid_until}
                  disabled={isSaving}
                  aria-invalid={Boolean(fieldErrors.price_valid_until) || undefined}
                  aria-describedby={joinIds(
                    `${fieldId('price_valid_until')}-hint`,
                    Boolean(fieldErrors.price_valid_until) && fieldErrorId('price_valid_until'),
                  )}
                  onChange={(event) => updateField('price_valid_until', event.target.value)}
                  className={inputClass(Boolean(fieldErrors.price_valid_until))}
                />
              </Field>
            </div>
          </div>
        </section>

        <section className="rounded-lg bg-white shadow">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">Stock</h2>
            <p className="mt-1 text-sm text-gray-500">
              Optional. A stock record is only written when at least one of these fields is filled.
            </p>
          </div>
          <div className="space-y-5 px-6 py-5">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field
                label="Stock status"
                htmlFor={fieldId('stock_status')}
                error={fieldErrors.stock_status}
                hint={
                  isEdit
                    ? 'Leave as “Not set” to keep the current status.'
                    : 'Leave as “Not set” to skip stock details for now.'
                }
                hintId={`${fieldId('stock_status')}-hint`}
              >
                <select
                  id={fieldId('stock_status')}
                  value={form.stock_status}
                  disabled={isSaving}
                  aria-invalid={Boolean(fieldErrors.stock_status) || undefined}
                  aria-describedby={joinIds(
                    `${fieldId('stock_status')}-hint`,
                    Boolean(fieldErrors.stock_status) && fieldErrorId('stock_status'),
                  )}
                  onChange={(event) =>
                    updateField('stock_status', event.target.value as '' | StockStatus)
                  }
                  className={inputClass(Boolean(fieldErrors.stock_status))}
                >
                  <option value="">Not set</option>
                  {STOCK_STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {stockStatusLabel(status)}
                    </option>
                  ))}
                </select>
              </Field>

              <Field
                label="Stock quantity"
                htmlFor={fieldId('stock_quantity')}
                error={fieldErrors.stock_quantity}
                hint="Leave empty when the quantity is unknown."
                hintId={`${fieldId('stock_quantity')}-hint`}
              >
                <input
                  id={fieldId('stock_quantity')}
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  value={form.stock_quantity}
                  disabled={isSaving}
                  aria-invalid={Boolean(fieldErrors.stock_quantity) || undefined}
                  aria-describedby={joinIds(
                    `${fieldId('stock_quantity')}-hint`,
                    Boolean(fieldErrors.stock_quantity) && fieldErrorId('stock_quantity'),
                  )}
                  onChange={(event) => updateField('stock_quantity', event.target.value)}
                  className={inputClass(Boolean(fieldErrors.stock_quantity))}
                />
              </Field>
            </div>

            <Field
              label="Supplier note"
              htmlFor={fieldId('supplier_note')}
              error={fieldErrors.supplier_note}
              hint="What the supplier confirmed, e.g. availability or lead time."
              hintId={`${fieldId('supplier_note')}-hint`}
            >
              <textarea
                id={fieldId('supplier_note')}
                rows={2}
                maxLength={1000}
                value={form.supplier_note}
                disabled={isSaving}
                aria-invalid={Boolean(fieldErrors.supplier_note) || undefined}
                aria-describedby={joinIds(
                  `${fieldId('supplier_note')}-hint`,
                  Boolean(fieldErrors.supplier_note) && fieldErrorId('supplier_note'),
                )}
                onChange={(event) => updateField('supplier_note', event.target.value)}
                className={inputClass(Boolean(fieldErrors.supplier_note))}
              />
            </Field>
          </div>
        </section>

        <section className="rounded-lg bg-white shadow">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">Status</h2>
          </div>
          <div className="space-y-5 px-6 py-5">
            {isEdit ? (
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status={current?.status ?? form.status} />
                <p className="text-sm text-gray-600">
                  Status is changed from the products list with the quick actions.
                  <Link to="/admin/products" className={`${linkClass} ml-1`}>
                    Open products list
                  </Link>
                </p>
              </div>
            ) : (
              <Field
                label="Status"
                htmlFor={fieldId('status')}
                required
                error={fieldErrors.status}
                hint="Publishing requires an active supplier, an active category, a photo, and a retail price. Drafts stay hidden from customers."
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
                  onChange={(event) => updateField('status', event.target.value as ProductStatus)}
                  className={`${inputClass(Boolean(fieldErrors.status))} max-w-xs`}
                >
                  {CREATE_STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {formatStatusLabel(status)}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow">
          <p className="text-sm text-gray-600" aria-live="polite">
            {isSaving
              ? 'Saving changes…'
              : isEdit
                ? 'Save to apply your changes.'
                : 'The product is created once you save.'}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link to="/admin/products" className={secondaryButtonClass}>
              Cancel
            </Link>
            <button type="submit" disabled={isSaving} className={primaryButtonClass}>
              {isSaving ? 'Saving…' : isEdit ? 'Save changes' : 'Create product'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
