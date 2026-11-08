import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FiPlus, FiTrash2 } from 'react-icons/fi';
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
  type ProductVariant,
  type ProductVariantInput,
  type StockStatus,
} from '../api/productsApi';
import { mapValidationErrors } from '../api/catalogApiUtils';
import {
  Field,
  IMAGE_ACCEPT,
  LoadingPanel,
  PageHeader,
  StatusBadge,
  dangerSmallButtonClass,
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
import { ProductFormGuide } from '../components/ProductFormGuide';
import { useToast } from '../../../components/ui/Toast';
import { useI18n } from '../../../lib/i18n-context';

interface VariantFormState {
  key: string;
  id: number | null;
  /** Directly typed variant name, e.g. "Red / M". */
  name: string;
  sku: string;
  photo: File | null;
  /** Existing photo shown on the edit page; replaced by `photo` when set. */
  photoUrl: string | null;
  retail_price: string;
  wholesale_price: string;
  discount_price: string;
  minimum_order_quantity: string;
  price_valid_until: string;
  stock_quantity: string;
  stock_status: '' | StockStatus;
  supplier_note: string;
}

interface VariantDefaults {
  retail_price: string;
  wholesale_price: string;
  discount_price: string;
  minimum_order_quantity: string;
  price_valid_until: string;
  stock_quantity: string;
  stock_status: '' | StockStatus;
  supplier_note: string;
}

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
  has_variants: boolean;
  variants: VariantFormState[];
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
  has_variants: false,
  variants: [],
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

/** Per-row photo picker with a managed object-URL preview. */
function VariantPhotoField({
  file,
  existingUrl,
  disabled,
  onChange,
  label,
}: {
  file: File | null;
  existingUrl: string | null;
  disabled: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  label: string;
}) {
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const src = previewUrl ?? existingUrl;

  return (
    <div className="flex items-center gap-2">
      <div className="h-10 w-10 flex-none overflow-hidden rounded-md border border-gray-200 bg-gray-50">
        {src ? (
          <img src={src} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-[10px] text-gray-400">
            â€”
          </span>
        )}
      </div>
      <input
        type="file"
        accept={IMAGE_ACCEPT}
        disabled={disabled}
        aria-label={label}
        onChange={onChange}
        className="block w-32 text-xs text-gray-600 file:mr-2 file:rounded file:border-0 file:bg-gray-100 file:px-2 file:py-1 file:text-xs file:font-medium file:text-gray-700 hover:file:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60"
      />
    </div>
  );
}

function numberText(value: number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

function newVariantKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `variant-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function variantDefaultsFromForm(form: ProductFormState): VariantDefaults {
  return {
    retail_price: form.retail_price,
    wholesale_price: form.wholesale_price,
    discount_price: form.discount_price,
    minimum_order_quantity: form.minimum_order_quantity,
    price_valid_until: form.price_valid_until,
    stock_quantity: form.stock_quantity,
    stock_status: form.stock_status,
    supplier_note: form.supplier_note,
  };
}

function variantFormFromDefaults(defaults: VariantDefaults): VariantFormState {
  return {
    key: newVariantKey(),
    id: null,
    name: '',
    sku: '',
    photo: null,
    photoUrl: null,
    ...defaults,
  };
}

function variantNameFromRecord(variant: ProductVariant): string {
  const name = (variant.name ?? '').trim();

  if (name !== '') return name;

  return Object.entries(variant.variant_attributes ?? {})
    .map(([attributeName, value]) => `${attributeName}: ${value}`)
    .join(', ');
}

function toFormState(product: Product): ProductFormState {
  const variants = product.variants ?? [];

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
    has_variants: variants.length > 0,
    variants: variants.map((variant) => ({
      key: `variant-${variant.id}`,
      id: variant.id,
      name: variantNameFromRecord(variant),
      sku: variant.sku ?? '',
      photo: null,
      photoUrl: variant.photo_url,
      retail_price: numberText(variant.retail_price),
      wholesale_price: numberText(variant.wholesale_price),
      discount_price: numberText(variant.discount_price),
      minimum_order_quantity: numberText(variant.minimum_order_quantity),
      price_valid_until: variant.price_valid_until ? variant.price_valid_until.slice(0, 10) : '',
      stock_quantity: numberText(variant.stock_quantity),
      stock_status: variant.stock_status ?? '',
      supplier_note: variant.supplier_note ?? '',
    })),
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
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { t } = useI18n();

  const rawId = params.id;
  const productId = rawId === undefined ? null : Number(rawId);
  const isEdit = productId !== null;

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
  const [variantErrors, setVariantErrors] = useState<Record<string, string[]>>({});

  const formAlertRef = useRef<HTMLDivElement>(null);

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
        setVariantErrors({});
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
        setVariantErrors({});
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
    setFormError(null);
    clearFieldError(key);
  };

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0] ?? null;

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

  const toggleVariants = (enabled: boolean) => {
    setForm((previous) => {
      if (!enabled) {
        return { ...previous, has_variants: false };
      }

      if (previous.variants.length > 0) {
        return { ...previous, has_variants: true };
      }

      return {
        ...previous,
        has_variants: true,
        variants: [variantFormFromDefaults(variantDefaultsFromForm(previous))],
      };
    });
    setVariantErrors({});
    setFormError(null);
  };

  const updateVariantRow = (index: number, patch: Partial<VariantFormState>) => {
    setForm((previous) => ({
      ...previous,
      variants: previous.variants.map((variant, variantIndex) =>
        variantIndex === index ? { ...variant, ...patch } : variant,
      ),
    }));
    setVariantErrors({});
    setFormError(null);
  };

  const handleVariantPhotoChange = (index: number, event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0] ?? null;

    if (!file) {
      updateVariantRow(index, { photo: null });
      return;
    }

    const message = validateImageFile(file);

    if (message) {
      setVariantErrors((previous) => ({
        ...previous,
        [`variants.${index}.photo`]: [message],
      }));
      input.value = '';
      return;
    }

    updateVariantRow(index, { photo: file, photoUrl: null });
  };

  const addVariantRow = () => {
    setForm((previous) => ({
      ...previous,
      variants: [
        ...previous.variants,
        variantFormFromDefaults(variantDefaultsFromForm(previous)),
      ],
    }));
    setVariantErrors({});
    setFormError(null);
  };

  const removeVariantRow = (index: number) => {
    setForm((previous) => ({
      ...previous,
      variants: previous.variants.filter((_, variantIndex) => variantIndex !== index),
    }));
    setVariantErrors({});
  };

  const variantFieldError = (index: number, field: string): string[] | undefined =>
    variantErrors[`variants.${index}.${field}`];

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

    const nextVariantErrors: Record<string, string[]> = {};

    if (form.has_variants) {
      if (form.variants.length === 0) {
        setFormError('Add at least one variant before saving.');
        return;
      }

      if (form.variants.length > 50) {
        setFormError('A product can have at most 50 variants.');
        return;
      }

      const seen = new Set<string>();

      form.variants.forEach((variant, index) => {
        const name = variant.name.trim();

        if (name === '') {
          nextVariantErrors[`variants.${index}.name`] = ['Enter a variant name.'];
        } else {
          const identity = name.toLowerCase();

          if (seen.has(identity)) {
            nextVariantErrors[`variants.${index}.name`] = ['This variant name is duplicated.'];
          }

          seen.add(identity);
        }

        const retail = Number.parseInt(variant.retail_price, 10);

        if (!Number.isFinite(retail) || retail < 1) {
          nextVariantErrors[`variants.${index}.retail_price`] = [
            'A retail price of at least 1 MMK is required.',
          ];
        }

        const discount = Number.parseInt(variant.discount_price, 10);

        if (Number.isFinite(retail) && Number.isFinite(discount) && discount > retail) {
          nextVariantErrors[`variants.${index}.discount_price`] = [
            'The discount price must not be greater than the retail price.',
          ];
        }
      });

      if (Object.keys(nextVariantErrors).length > 0) {
        setVariantErrors(nextVariantErrors);
        setFormError('Fix the highlighted variant rows, then save again.');
        requestAnimationFrame(() => formAlertRef.current?.focus());
        return;
      }
    }

    setIsSaving(true);
    setFormError(null);
    setFieldErrors({});
    setVariantErrors({});

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
      variants: form.has_variants
        ? form.variants.map(
            (variant): ProductVariantInput => ({
              id: variant.id,
              name: variant.name,
              sku: variant.sku,
              photo: variant.photo,
              retail_price: variant.retail_price,
              wholesale_price: variant.wholesale_price,
              discount_price: variant.discount_price,
              minimum_order_quantity: variant.minimum_order_quantity,
              price_valid_until: variant.price_valid_until,
              stock_quantity: variant.stock_quantity,
              stock_status: variant.stock_status,
              supplier_note: variant.supplier_note,
            }),
          )
        : [],
      // Always sync on the admin form so removing every row deletes the variants.
      syncVariants: true,
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
      const productLabel = product.name_mm || product.name_en || `#${product.id}`;

      if (productId === null) {
        showToast({
          tone: 'success',
          title: t('productCreated'),
          description: t('productCreatedHint', { name: productLabel }),
        });

        navigate(`/admin/products/${product.id}/edit`, { replace: true });
        return;
      }

      setCurrent(product);
      setForm(toFormState(product));
      setVariantErrors({});
      showToast({
        tone: 'success',
        title: t('productUpdated'),
        description: t('productUpdatedHint', { name: productLabel }),
      });
      return;
    }

    const productErrors: Record<string, string[]> = {};
    const branchErrors: Record<string, string[]> = {};

    for (const [key, messages] of Object.entries(response.errors ?? {})) {
      if (key.startsWith('variants.')) {
        branchErrors[key] = messages;
      } else {
        productErrors[key] = messages;
      }
    }

    const mapped = mapValidationErrors(productErrors, PRODUCT_FIELDS);
    setFieldErrors(mapped.fieldErrors);
    setVariantErrors(branchErrors);
    setFormError(
      mapped.formErrors[0] ??
        (Object.keys(branchErrors).length > 0
          ? 'Some variant fields are invalid. Check the variant rows below.'
          : describeRequestError(response, 'The product could not be saved.')),
    );

    if (Object.keys(mapped.fieldErrors).length > 0) {
      focusFirstError(mapped.fieldErrors);
    } else {
      requestAnimationFrame(() => formAlertRef.current?.focus());
    }
  };

  const header = (
    <PageHeader
      title={isEdit ? 'Edit product' : 'New product'}
      description={
        isEdit
          ? current
            ? `Updating â€œ${current.name_mm}â€.`
            : 'Update this product.'
          : 'Add a product to the catalog. You can save it as a draft and publish it later.'
      }
      action={
        <div className="flex items-center gap-2">
          <ProductFormGuide isEdit={isEdit} />
          <Link to="/admin/products" className={secondaryButtonClass}>
            Back to products
          </Link>
        </div>
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
        <LoadingPanel label="Loading productâ€¦" />
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
                    {isOptionsLoading ? 'Loading suppliersâ€¦' : 'Select a supplier'}
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
                    {isOptionsLoading ? 'Loading categoriesâ€¦' : 'Select a category'}
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
            <h2 className="text-lg font-semibold text-gray-900">Variants</h2>
            <p className="mt-1 text-sm text-gray-500">
              Optional. Add each variant directly with its own name, image, SKU, price and stock. A
              product with no variants stays a single product.
            </p>
          </div>
          <div className="space-y-5 px-6 py-5">
            <label className="flex items-start gap-3 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.has_variants}
                disabled={isSaving}
                onChange={(event) => toggleVariants(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span>
                <span className="font-medium text-gray-900">This product has variants</span>
                <span className="block text-xs text-gray-500">
                  Add each variant directly. Give it a name, then set its image, SKU, price and
                  stock.
                </span>
              </span>
            </label>

            {form.has_variants ? (
              <div className="space-y-4">
                {form.variants.map((variant, index) => (
                  <div
                    key={variant.key}
                    className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <label className="block text-xs font-medium text-gray-600">
                          Variant name <span className="text-red-600">*</span>
                        </label>
                        <input
                          type="text"
                          value={variant.name}
                          maxLength={255}
                          disabled={isSaving}
                          placeholder="Red / M"
                          aria-label={`Variant name ${index + 1}`}
                          onChange={(event) =>
                            updateVariantRow(index, { name: event.target.value })
                          }
                          className={`${inputClass(Boolean(variantFieldError(index, 'name')))} mt-1`}
                        />
                        {variantFieldError(index, 'name') ? (
                          <p className="mt-1 text-xs text-red-600">
                            {variantFieldError(index, 'name')?.[0]}
                          </p>
                        ) : null}
                      </div>

                      <button
                        type="button"
                        onClick={() => removeVariantRow(index)}
                        disabled={isSaving}
                        className={dangerSmallButtonClass}
                        aria-label={`Remove variant ${variant.name || index + 1}`}
                      >
                        <FiTrash2 aria-hidden="true" className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="sm:col-span-2 lg:col-span-1">
                        <p className="mb-1 text-xs font-medium text-gray-600">Variant image</p>
                        <div className="rounded-lg border border-dashed border-gray-300 p-3">
                          <VariantPhotoField
                            file={variant.photo}
                            existingUrl={variant.photoUrl}
                            disabled={isSaving}
                            label={`Variant image for ${variant.name || `variant ${index + 1}`}`}
                            onChange={(event) => handleVariantPhotoChange(index, event)}
                          />
                          <p className="mt-1 text-[11px] text-gray-400">
                            Optional; uses the product photo when empty.
                          </p>
                        </div>
                        {variantFieldError(index, 'photo') ? (
                          <p className="mt-1 text-xs text-red-600">
                            {variantFieldError(index, 'photo')?.[0]}
                          </p>
                        ) : null}
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600">SKU</label>
                        <input
                          type="text"
                          value={variant.sku}
                          maxLength={100}
                          disabled={isSaving}
                          aria-label={`SKU for ${variant.name || `variant ${index + 1}`}`}
                          onChange={(event) =>
                            updateVariantRow(index, { sku: event.target.value })
                          }
                          className={`${inputClass(Boolean(variantFieldError(index, 'sku')))} mt-1`}
                        />
                        {variantFieldError(index, 'sku') ? (
                          <p className="mt-1 text-xs text-red-600">
                            {variantFieldError(index, 'sku')?.[0]}
                          </p>
                        ) : null}
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600">
                          Retail (MMK) <span className="text-red-600">*</span>
                        </label>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          inputMode="numeric"
                          value={variant.retail_price}
                          disabled={isSaving}
                          aria-label={`Retail price for ${variant.name || `variant ${index + 1}`}`}
                          onChange={(event) =>
                            updateVariantRow(index, { retail_price: event.target.value })
                          }
                          className={`${inputClass(Boolean(variantFieldError(index, 'retail_price')))} mt-1`}
                        />
                        {variantFieldError(index, 'retail_price') ? (
                          <p className="mt-1 text-xs text-red-600">
                            {variantFieldError(index, 'retail_price')?.[0]}
                          </p>
                        ) : null}
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600">
                          Wholesale (MMK)
                        </label>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          inputMode="numeric"
                          value={variant.wholesale_price}
                          disabled={isSaving}
                          aria-label={`Wholesale price for ${variant.name || `variant ${index + 1}`}`}
                          onChange={(event) =>
                            updateVariantRow(index, { wholesale_price: event.target.value })
                          }
                          className={`${inputClass(Boolean(variantFieldError(index, 'wholesale_price')))} mt-1`}
                        />
                        {variantFieldError(index, 'wholesale_price') ? (
                          <p className="mt-1 text-xs text-red-600">
                            {variantFieldError(index, 'wholesale_price')?.[0]}
                          </p>
                        ) : null}
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600">
                          Discount (MMK)
                        </label>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          inputMode="numeric"
                          value={variant.discount_price}
                          disabled={isSaving}
                          aria-label={`Discount price for ${variant.name || `variant ${index + 1}`}`}
                          onChange={(event) =>
                            updateVariantRow(index, { discount_price: event.target.value })
                          }
                          className={`${inputClass(Boolean(variantFieldError(index, 'discount_price')))} mt-1`}
                        />
                        {variantFieldError(index, 'discount_price') ? (
                          <p className="mt-1 text-xs text-red-600">
                            {variantFieldError(index, 'discount_price')?.[0]}
                          </p>
                        ) : null}
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600">MOQ</label>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          inputMode="numeric"
                          value={variant.minimum_order_quantity}
                          disabled={isSaving}
                          aria-label={`Minimum order quantity for ${variant.name || `variant ${index + 1}`}`}
                          onChange={(event) =>
                            updateVariantRow(index, {
                              minimum_order_quantity: event.target.value,
                            })
                          }
                          className={`${inputClass(Boolean(variantFieldError(index, 'minimum_order_quantity')))} mt-1`}
                        />
                        {variantFieldError(index, 'minimum_order_quantity') ? (
                          <p className="mt-1 text-xs text-red-600">
                            {variantFieldError(index, 'minimum_order_quantity')?.[0]}
                          </p>
                        ) : null}
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600">
                          Stock status
                        </label>
                        <select
                          value={variant.stock_status}
                          disabled={isSaving}
                          aria-label={`Stock status for ${variant.name || `variant ${index + 1}`}`}
                          onChange={(event) =>
                            updateVariantRow(index, {
                              stock_status: event.target.value as '' | StockStatus,
                            })
                          }
                          className={`${inputClass(Boolean(variantFieldError(index, 'stock_status')))} mt-1`}
                        >
                          <option value="">Not set</option>
                          {STOCK_STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                              {stockStatusLabel(status)}
                            </option>
                          ))}
                        </select>
                        {variantFieldError(index, 'stock_status') ? (
                          <p className="mt-1 text-xs text-red-600">
                            {variantFieldError(index, 'stock_status')?.[0]}
                          </p>
                        ) : null}
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600">
                          Stock quantity
                        </label>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          inputMode="numeric"
                          value={variant.stock_quantity}
                          disabled={isSaving}
                          aria-label={`Stock quantity for ${variant.name || `variant ${index + 1}`}`}
                          onChange={(event) =>
                            updateVariantRow(index, { stock_quantity: event.target.value })
                          }
                          className={`${inputClass(Boolean(variantFieldError(index, 'stock_quantity')))} mt-1`}
                        />
                        {variantFieldError(index, 'stock_quantity') ? (
                          <p className="mt-1 text-xs text-red-600">
                            {variantFieldError(index, 'stock_quantity')?.[0]}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={addVariantRow}
                    disabled={isSaving}
                    className={secondaryButtonClass}
                  >
                    <FiPlus aria-hidden="true" className="mr-1 h-4 w-4" />
                    Add option
                  </button>
                  <p className="text-xs text-gray-500">
                    {form.variants.length} variant{form.variants.length === 1 ? '' : 's'}. Each
                    variant has its own image, price and stock.
                  </p>
                </div>

                <p className="text-xs text-gray-500">
                  Product-level pricing and stock below stay as the base values. Each variant keeps
                  its own values once saved.
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-600">
                This product has no variants. The Pricing and Stock sections below describe the
                single product.
              </p>
            )}
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
                      Higher than the retail price â€” this will be rejected on save.
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
                    ? 'Leave as â€œNot setâ€ to keep the current status.'
                    : 'Leave as â€œNot setâ€ to skip stock details for now.'
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
              ? 'Saving changesâ€¦'
              : isEdit
                ? 'Save to apply your changes.'
                : 'The product is created once you save.'}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link to="/admin/products" className={secondaryButtonClass}>
              Cancel
            </Link>
            <button type="submit" disabled={isSaving} className={primaryButtonClass}>
              {isSaving ? 'Savingâ€¦' : isEdit ? 'Save changes' : 'Create product'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}