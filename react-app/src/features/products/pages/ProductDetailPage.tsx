/**
 * Product Detail Page (Task 05).
 *
 * Shows one published product with its display price, availability, public
 * supplier summary, and the guest cart controls. The "30-second pitch" keeps
 * name, price, stock, quantity, and the add action in one readable run; on
 * mobile a sticky bar carries price + add action once that zone scrolls away.
 * A guest who presses "Request Quotation" is sent to the customer
 * login/register screen instead of any quotation form (RolesPermissions §1
 * and LogicFlow §4).
 */
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FiChevronRight, FiMinus, FiPlus } from 'react-icons/fi';
import { getProduct, type PublicProduct } from '../../../api/catalog';
import {
  cartBlockReason,
  displayUnitPrice,
  minimumQuantity,
  quantityError,
} from '../../../lib/cart-storage';
import {
  Alert,
  addedButtonClass,
  FALLBACK_BANNER,
  LoadingPanel,
  PageHeader,
  primaryButtonClass,
  ReceiptCheckMark,
  secondaryButtonClass,
  useReceipt,
} from '../../../components/catalog-ui/CatalogUi';
import { useAuth } from '../../../lib/auth-context';
import { useCart } from '../../../lib/cart-context';
import { formatMMK } from '../../../lib/money';
import {
  ConfirmationNote,
  PriceBlock,
  StockBadge,
  describeCatalogError,
} from '../components/ProductUi';
import { useI18n } from '../../../lib/i18n-context';

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, userType } = useAuth();
  const { add, lastAdded } = useCart();
  const { t, displayName: catalogName } = useI18n();

  const [product, setProduct] = useState<PublicProduct | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState<string | null>(null);
  const [pitchScrolledPast, setPitchScrolledPast] = useState(false);

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    setLoadError(null);

    getProduct(id ?? '')
      .then((response) => {
        if (cancelled) return;

        if (response.success && response.data) {
          setProduct(response.data.product);
          setQuantity(minimumQuantity(response.data.product.price));
        } else {
          setProduct(null);
          setLoadError(describeCatalogError(response, 'product'));
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  const blocked = product ? cartBlockReason(product) : null;
  const moq = product ? minimumQuantity(product.price) : 1;

  /** The receipt moment, shared with the catalog cards. */
  const receipt = useReceipt(product?.id ?? 0, lastAdded);

  /**
   * Sticky purchase bar: watches the pitch zone and appears once it has left
   * the viewport, so the add action is never more than a thumb's reach away
   * on a long spec read. One-way reveal, no scroll listeners.
   */
  useEffect(() => {
    if (!product) return;

    const pitch = document.getElementById('product-pitch');
    if (!pitch) return;
    if (typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      ([entry]) => setPitchScrolledPast(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { threshold: 0 },
    );
    observer.observe(pitch);
    return () => observer.disconnect();
  }, [product]);

  const step = (delta: number) => {
    const next = quantity + delta;
    const error = quantityError(next, moq);

    setMessage(error);
    if (!error) setQuantity(next);
  };

  const handleQuantityInput = (raw: string) => {
    const next = Number(raw);
    if (!Number.isFinite(next)) {
      setMessage('Quantity must be a whole number.');
      return;
    }

    const error = quantityError(Math.trunc(next), moq);
    setMessage(error);
    setQuantity(Math.trunc(next));
  };

  const handleQuantitySubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!product) return;

    const error = quantityError(quantity, moq);
    if (error) {
      setMessage(error);
      return;
    }

    setMessage(add(product, quantity));
  };

  const handleRequestQuotation = () => {
    if (!product || blocked) return;

    const error = quantityError(quantity, moq);
    if (error) {
      setMessage(error);
      return;
    }

    const failure = add(product, quantity);
    if (failure) {
      setMessage(failure);
      return;
    }

    navigate(isAuthenticated && userType === 'customer' ? '/quotations' : '/login');
  };

  if (isLoading) return <LoadingPanel label="Loading product" />;

  if (loadError || !product) {
    return (
      <div className="space-y-6">
        <PageHeader title="Product unavailable" />
        <Alert tone="error">
          {loadError ?? 'This product is unavailable.'}
          <div className="mt-3">
            <Link to="/products" className={`${secondaryButtonClass} inline-block`}>
              Back to products
            </Link>
          </div>
        </Alert>
      </div>
    );
  }

  const displayName = catalogName(product);

  const addControl = (extraClass = '') => (
    <button
      type="submit"
      disabled={Boolean(blocked)}
      className={`${extraClass}${
        blocked
          ? 'cursor-not-allowed bg-line text-subtle'
          : receipt
            ? addedButtonClass
            : primaryButtonClass
      }`}
    >
      <span className="inline-flex items-center justify-center gap-2">
        {receipt && !blocked ? <ReceiptCheckMark /> : null}
        <span
          key={receipt ? receipt.at : 'idle'}
          className="motion-safe:animate-rise-in"
        >
          {blocked ? 'Unavailable' : receipt ? `Added — ${receipt.quantity}` : 'Add to order list'}
        </span>
      </span>
      {receipt && !blocked ? (
        <span
          key={`badge-${receipt.at}`}
          aria-hidden="true"
          className="ml-1 flex items-center overflow-hidden rounded-full bg-white/15 px-1.5"
        >
          <span className="motion-safe:animate-count-roll text-xs font-semibold leading-5">
            {lastAdded?.quantity ?? ''}
          </span>
        </span>
      ) : null}
    </button>
  );

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1 text-sm text-subtle" aria-label="Breadcrumb">
        <Link to="/" className="rounded hover:text-ink">
          Home
        </Link>
        <FiChevronRight aria-hidden="true" className="h-3.5 w-3.5 text-subtle" />
        <Link to="/products" className="rounded hover:text-ink">
          Products
        </Link>
        {product.category ? (
          <>
            <FiChevronRight aria-hidden="true" className="h-3.5 w-3.5 text-subtle" />
            <Link
              to={`/products?category_id=${product.category.id}`}
              className="rounded hover:text-ink"
            >
              {catalogName(product.category)}
            </Link>
          </>
        ) : null}
      </nav>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <section className="lg:col-span-2">
          <div className="glass-panel overflow-hidden">
            <img
              src={product.photo_url ?? FALLBACK_BANNER}
              alt={displayName}
              loading="lazy"
              decoding="async"
              className="h-64 w-full object-cover sm:h-80"
            />
          </div>
        </section>

        <section className="space-y-5 lg:col-span-3">
          {/* The 30-second pitch: everything needed to decide, in one run. */}
          <div id="product-pitch" className="glass-panel p-6">
            <p className="text-xs text-subtle">
              {product.category ? catalogName(product.category) : t('uncategorised')}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">{displayName}</h1>
            <p className="mt-1 text-sm text-subtle">
              {product.brand ?? 'No brand'}
              {product.model ? ` · ${product.model}` : ''}
              {product.sku ? ` · SKU ${product.sku}` : ''}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <StockBadge stock={product.stock} />
              {product.stock?.stock_quantity !== null &&
              product.stock?.stock_quantity !== undefined ? (
                <span className="text-sm text-muted">
                  {product.stock.stock_quantity} {product.unit} available
                </span>
              ) : null}
            </div>

            <div className="mt-4 border-t border-dashed border-rule pt-4">
              <PriceBlock price={product.price} showValidity />
            </div>

            <ConfirmationNote stock={product.stock} />

            <form
              id="product-form"
              onSubmit={handleQuantitySubmit}
              className="mt-6 space-y-3"
            >
              <label
                htmlFor="product-quantity"
                className="block text-sm font-medium text-ink"
              >
                Quantity ({product.unit}) — minimum {moq}
              </label>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center rounded-lg border border-white/70 bg-white/70">
                  <button
                    type="button"
                    onClick={() => step(-1)}
                    disabled={quantity <= moq || Boolean(blocked)}
                    className="flex h-11 w-11 items-center justify-center text-ink disabled:cursor-not-allowed disabled:text-line"
                    aria-label="Decrease quantity"
                  >
                    <FiMinus aria-hidden="true" className="h-4 w-4" />
                  </button>
                  <input
                    id="product-quantity"
                    type="number"
                    inputMode="numeric"
                    min={moq}
                    step={1}
                    value={Number.isFinite(quantity) ? quantity : ''}
                    onChange={(event) => handleQuantityInput(event.target.value)}
                    disabled={Boolean(blocked)}
                    className="w-20 border-x border-line px-2 py-2 text-center text-sm text-ink outline-none focus:ring-2 focus:ring-inset focus:ring-accent"
                    aria-describedby={message ? 'quantity-error' : undefined}
                    aria-invalid={Boolean(message) || undefined}
                  />
                  <button
                    type="button"
                    onClick={() => step(1)}
                    disabled={Boolean(blocked)}
                    className="flex h-11 w-11 items-center justify-center text-ink disabled:cursor-not-allowed disabled:text-line"
                    aria-label="Increase quantity"
                  >
                    <FiPlus aria-hidden="true" className="h-4 w-4" />
                  </button>
                </div>

                {addControl()}
              </div>

              {message ? (
                <p
                  id="quantity-error"
                  role="alert"
                  className="motion-safe:animate-rise-in text-sm text-red-600"
                >
                  {message}
                </p>
              ) : null}
              {blocked ? <p className="text-sm text-red-600">{blocked}</p> : null}

              <p aria-live="polite" className="sr-only">
                {receipt
                  ? `Added ${receipt.quantity} ${product.unit} of ${product.name_en ?? product.name_mm} to your order list.`
                  : ''}
              </p>
            </form>

            <div className="mt-6 border-t border-rule pt-5">
              <button
                type="button"
                onClick={handleRequestQuotation}
                disabled={Boolean(blocked)}
                className={`${blocked ? 'cursor-not-allowed border border-line bg-line text-subtle' : secondaryButtonClass} h-11 w-full`}
              >
                Request quotation from this item
              </button>
              <p className="mt-2 text-xs text-subtle">
                Guests are asked to sign in or register first. Nothing is submitted to the API at
                this step.
              </p>
            </div>
          </div>

          {product.supplier ? (
            <div className="glass-panel p-6">
              <h2 className="text-base font-semibold text-ink">Supplier</h2>
              <div className="mt-3 flex items-start gap-3">
                {product.supplier.logo_url ? (
                  <img
                    src={product.supplier.logo_url}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="h-12 w-12 rounded-md object-cover"
                  />
                ) : null}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{product.supplier.shop_name}</p>
                  {product.supplier.company_name ? (
                    <p className="text-sm text-muted">{product.supplier.company_name}</p>
                  ) : null}
                  {product.supplier.business_description ? (
                    <p className="mt-1 text-sm text-muted">{product.supplier.business_description}</p>
                  ) : null}
                  <dl className="mt-2 grid grid-cols-1 gap-1 text-sm text-muted sm:grid-cols-2">
                    {product.supplier.delivery_area ? (
                      <div>
                        <dt className="inline font-medium text-ink">Delivery area: </dt>
                        <dd className="inline">{product.supplier.delivery_area}</dd>
                      </div>
                    ) : null}
                    {product.supplier.delivery_time ? (
                      <div>
                        <dt className="inline font-medium text-ink">Delivery time: </dt>
                        <dd className="inline">{product.supplier.delivery_time}</dd>
                      </div>
                    ) : null}
                  </dl>
                  {product.supplier.verified ? (
                    <p className="mt-2 inline-flex items-center rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">
                      Verified supplier
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </section>
      </div>

      <section className="glass-panel p-6">
        <h2 className="text-base font-semibold text-ink">Product details</h2>

        {product.description ? (
          <p className="mt-3 whitespace-pre-line text-sm leading-6 text-ink">
            {product.description}
          </p>
        ) : (
          <p className="mt-3 text-sm text-subtle">No description has been provided.</p>
        )}

        <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['Specification', product.specification],
            ['Size', product.size],
            ['Colour', product.color],
            ['Unit', product.unit],
            ['Package size', product.package_size],
            ['Brand', product.brand],
            ['Model', product.model],
            ['SKU', product.sku],
          ]
            .filter((entry): entry is [string, string] => Boolean(entry[1]))
            .map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3 border-b border-rule pb-2">
                <dt className="font-medium text-muted">{label}</dt>
                <dd className="text-right text-ink">{value}</dd>
              </div>
            ))}
        </dl>

        {product.price?.retail_price ? (
          <p className="mt-5 text-xs text-subtle">
            Reference display price: <span className="tabular-nums">{formatMMK(product.price.retail_price)}</span> MMK per {product.unit}.
            Final pricing is issued with the supplier quotation.
          </p>
        ) : null}
      </section>

      {/*
       * Sticky mobile purchase bar: price left, add action right. Hidden on
       * desktop where the inline form owns the action. Submits the same
       * product form, so the receipt moment plays identically.
       */}
      <div
        className={`fixed inset-x-0 bottom-0 z-40 border-t border-white/60 bg-white/85 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl sm:hidden ${
          pitchScrolledPast ? 'motion-safe:animate-bar-in' : 'hidden'
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-ink tabular-nums">
            {product.price && displayUnitPrice(product.price) !== null
              ? `${formatMMK((displayUnitPrice(product.price) ?? 0) * quantity)} MMK`
              : 'Price confirmed in quotation'}
          </span>
          {addControl()}
        </div>
      </div>
    </div>
  );
}
