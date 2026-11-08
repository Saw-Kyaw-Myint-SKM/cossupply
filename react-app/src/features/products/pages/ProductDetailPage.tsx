/**
 * Product Detail Page (Task 05).
 *
 * Layout A: a sticky gallery on the left and a focused buy box on the right.
 * Variant chips live with the price and add action, while description,
 * specifications and supplier details sit in tabs below.
 */
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FiChevronRight, FiMinus, FiPlus } from 'react-icons/fi';
import {
  getProduct,
  type PublicProduct,
  type PublicProductVariant,
} from '../../../api/catalog';
import {
  cartBlockReason,
  displayUnitPrice,
  minimumQuantity,
  quantityError,
  variantBlockReason,
  variantDisplayName,
  variantMinimumQuantity,
} from '../../../lib/cart-storage';
import {
  Alert,
  addedButtonClass,
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
import ProductGallery from '../components/ProductGallery';
import ProductInfo from '../components/ProductInfo';
import VariantSelector from '../components/VariantSelector';
import { useI18n } from '../../../lib/i18n-context';

/** Variant price shaped like the public product price for PriceBlock. */
function variantPriceRecord(
  variant: PublicProductVariant,
): NonNullable<PublicProduct['price']> {
  return {
    retail_price: variant.retail_price ?? 0,
    discount_price: variant.discount_price,
    minimum_order_quantity: variant.minimum_order_quantity,
    price_valid_until: variant.price_valid_until,
    last_updated_at: variant.last_updated_at,
  };
}

function variantStock(variant: PublicProductVariant): NonNullable<PublicProduct['stock']> {
  return {
    stock_quantity: variant.stock_quantity,
    stock_status: variant.stock_status,
    last_confirmed_at: variant.last_confirmed_at,
  };
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, userType } = useAuth();
  const { add, lastAdded } = useCart();
  const { displayName: catalogName } = useI18n();

  const [product, setProduct] = useState<PublicProduct | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<PublicProductVariant | null>(null);
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
          const loadedProduct = response.data.product;
          const variants = loadedProduct.variants ?? [];
          const initialVariant =
            variants.find((variant) => variant.stock_status !== 'OUT_OF_STOCK') ??
            variants[0] ??
            null;

          setProduct(loadedProduct);
          setSelectedVariant(initialVariant);
          setQuantity(
            initialVariant
              ? variantMinimumQuantity(initialVariant)
              : minimumQuantity(loadedProduct.price),
          );
        } else {
          setProduct(null);
          setSelectedVariant(null);
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

  const selectedVariantLabel = selectedVariant ? variantDisplayName(selectedVariant) : null;

  const activePrice = selectedVariant
    ? selectedVariant.retail_price !== null
      ? variantPriceRecord(selectedVariant)
      : null
    : (product?.price ?? null);

  const activeStock = selectedVariant ? variantStock(selectedVariant) : (product?.stock ?? null);

  const blocked = product
    ? selectedVariant
      ? variantBlockReason(selectedVariant)
      : cartBlockReason(product)
    : null;

  const moq = selectedVariant
    ? variantMinimumQuantity(selectedVariant)
    : product
      ? minimumQuantity(product.price)
      : 1;

  // Keep the quantity valid when the buyer switches variants.
  useEffect(() => {
    if (!product) return;

    setQuantity(
      selectedVariant
        ? variantMinimumQuantity(selectedVariant)
        : minimumQuantity(product.price),
    );
    setMessage(null);
  }, [product, selectedVariant]);

  /** The receipt moment, shared with the catalog cards. */
  const receipt = useReceipt(product?.id ?? 0, lastAdded, selectedVariant?.id ?? null);

  /**
   * Sticky purchase bar: watches the buy box and appears once it has left the
   * viewport, so the add action is never more than a thumb's reach away on a
   * long spec read. One-way reveal, no scroll listeners.
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

    setMessage(add(product, quantity, selectedVariant));
  };

  const handleRequestQuotation = () => {
    if (!product || blocked) return;

    const error = quantityError(quantity, moq);
    if (error) {
      setMessage(error);
      return;
    }

    const failure = add(product, quantity, selectedVariant);
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
  const activeSku = selectedVariant?.sku ?? product.sku;

  const addControl = (extraClass = '') => (
    <button
      type="submit"
      form="product-form"
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
    <div className="space-y-2.5">
      <nav className="flex items-center gap-1 text-xs text-subtle" aria-label="Breadcrumb">
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

      <section className="overflow-hidden rounded-2xl border border-rule/80 bg-white shadow-[0_6px_24px_-16px_rgba(0,142,204,0.35)]">
        <div className="grid grid-cols-1 lg:grid-cols-12">
          <div className="bg-gradient-to-br from-primary-light/60 via-white to-paper p-3 sm:p-4 lg:col-span-5">
            <ProductGallery
              product={product}
              selectedVariant={selectedVariant}
              displayName={displayName}
              selectedVariantLabel={selectedVariantLabel}
              onSelect={setSelectedVariant}
            />
          </div>

          <div className="p-3 sm:p-4 lg:col-span-7">
            <div id="product-pitch" className="flex h-full flex-col">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <StockBadge stock={activeStock} />
                  {activeStock?.stock_quantity !== null &&
                  activeStock?.stock_quantity !== undefined ? (
                    <span className="text-[13px] text-muted">
                      {activeStock.stock_quantity} available
                    </span>
                  ) : null}
                </div>

                {product.supplier ? (
                  <Link
                    to={`/products?supplier_id=${product.supplier.id}`}
                    className="group flex max-w-full items-center gap-2.5 rounded-xl border border-primary/15 bg-gradient-to-r from-primary-light/70 via-white to-white py-1.5 pl-1.5 pr-2 shadow-sm transition hover:border-primary/40 hover:shadow"
                  >
                    {product.supplier.logo_url ? (
                      <img
                        src={product.supplier.logo_url}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-10 w-10 flex-none rounded-lg object-cover ring-1 ring-black/5"
                      />
                    ) : (
                      <span className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-white text-sm font-semibold text-primary ring-1 ring-primary/10">
                        {product.supplier.shop_name.charAt(0)}
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className="max-w-[150px] truncate text-[13px] font-semibold text-ink group-hover:text-primary">
                          {product.supplier.shop_name}
                        </span>
                        {product.supplier.verified ? (
                          <span className="rounded-full bg-success-soft px-1.5 py-0.5 text-[10px] font-semibold text-success">
                            Verified
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block max-w-[190px] truncate text-[11px] text-muted">
                        {[product.supplier.delivery_area, product.supplier.delivery_time]
                          .filter(Boolean)
                          .join(' · ') || 'Delivery confirmed in quotation'}
                      </span>
                    </span>
                    <span className="ml-1 flex-none rounded-lg bg-white px-2 py-1 text-[11px] font-semibold text-primary ring-1 ring-primary/15 transition group-hover:bg-primary group-hover:text-white">
                      View store
                    </span>
                  </Link>
                ) : null}
              </div>

              <h1 className="mt-1 text-xl font-semibold tracking-tight text-ink sm:text-[22px]">
                {displayName}
              </h1>

              <div className="mt-2.5 rounded-lg bg-primary-light/40 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">
                  Reference price
                </p>
                <div className="mt-0.5">
                  <PriceBlock price={activePrice} showValidity />
                </div>
              </div>

              <ConfirmationNote stock={activeStock} />

              {product.variants && product.variants.length > 0 ? (
                <VariantSelector
                  variants={product.variants}
                  selectedVariant={selectedVariant}
                  onSelect={setSelectedVariant}
                />
              ) : null}

              <form id="product-form" onSubmit={handleQuantitySubmit} className="mt-2.5 space-y-2">
                <div>
                  <label
                    htmlFor="product-quantity"
                    className="block text-[13px] font-medium text-ink"
                  >
                    Quantity
                  </label>
                  <p className="mt-0.5 text-xs text-muted">Minimum order {moq}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center rounded-lg border border-line bg-white">
                    <button
                      type="button"
                      onClick={() => step(-1)}
                      disabled={quantity <= moq || Boolean(blocked)}
                      className="flex h-9 w-9 items-center justify-center text-ink disabled:cursor-not-allowed disabled:text-line"
                      aria-label="Decrease quantity"
                    >
                      <FiMinus aria-hidden="true" className="h-3.5 w-3.5" />
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
                      className="w-14 border-x border-line px-2 py-1.5 text-center text-sm font-medium text-ink outline-none focus:ring-2 focus:ring-inset focus:ring-accent"
                      aria-describedby={message ? 'quantity-error' : undefined}
                      aria-invalid={Boolean(message) || undefined}
                    />
                    <button
                      type="button"
                      onClick={() => step(1)}
                      disabled={Boolean(blocked)}
                      className="flex h-9 w-9 items-center justify-center text-ink disabled:cursor-not-allowed disabled:text-line"
                      aria-label="Increase quantity"
                    >
                      <FiPlus aria-hidden="true" className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {addControl('h-9 px-3 text-[13px]!')}
                  <button
                    type="button"
                    onClick={handleRequestQuotation}
                    disabled={Boolean(blocked)}
                    className={`${blocked ? 'cursor-not-allowed border border-line bg-line text-subtle' : secondaryButtonClass} h-9 px-3 text-[13px]!`}
                  >
                    Request quotation
                  </button>
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
                    ? `Added ${receipt.quantity} ${product.unit} of ${
                        product.name_en ?? product.name_mm
                      }${selectedVariantLabel ? ` (${selectedVariantLabel})` : ''} to your order list.`
                    : ''}
                </p>
              </form>
            </div>
          </div>
        </div>
      </section>

      <ProductInfo product={product} selectedSku={activeSku} />

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
            {activePrice && displayUnitPrice(activePrice) !== null
              ? `${formatMMK((displayUnitPrice(activePrice) ?? 0) * quantity)} MMK`
              : 'Price confirmed in quotation'}
          </span>
          {addControl()}
        </div>
      </div>
    </div>
  );
}
