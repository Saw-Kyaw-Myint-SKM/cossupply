/**
 * Product Detail Page (Task 05).
 *
 * Shows one published product with its display price, availability, public
 * supplier summary, and the guest cart controls. A guest who presses
 * "Request Quotation" is sent to the customer login/register screen instead of
 * any quotation form (RolesPermissions §1 and LogicFlow §4).
 */
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getProduct, type PublicProduct } from '../../../api/catalog';
import {
  Alert,
  LoadingPanel,
  PageHeader,
  primaryButtonClass,
  secondaryButtonClass,
} from '../../../components/catalog-ui/CatalogUi';
import { useAuth } from '../../../lib/auth-context';
import { useCart } from '../../../lib/cart-context';
import { formatMMK } from '../../../lib/money';
import {
  cartBlockReason,
  minimumQuantity,
  quantityError,
} from '../../../lib/cart-storage';
import {
  ConfirmationNote,
  PriceBlock,
  StockBadge,
  describeCatalogError,
} from '../components/ProductUi';

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, userType } = useAuth();
  const { add } = useCart();

  const [product, setProduct] = useState<PublicProduct | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState<string | null>(null);

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

  const displayName = product.name_en ?? product.name_mm;

  return (
    <div className="space-y-6">
      <nav className="text-sm text-gray-500" aria-label="Breadcrumb">
        <Link to="/" className="hover:text-blue-700">
          Home
        </Link>
        <span aria-hidden="true"> / </span>
        <Link to="/products" className="hover:text-blue-700">
          Products
        </Link>
        {product.category ? (
          <>
            <span aria-hidden="true"> / </span>
            <Link
              to={`/products?category_id=${product.category.id}`}
              className="hover:text-blue-700"
            >
              {product.category.name_en}
            </Link>
          </>
        ) : null}
      </nav>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <section className="lg:col-span-2">
          <div className="overflow-hidden rounded-lg bg-white shadow">
            {product.photo_url ? (
              <img
                src={product.photo_url}
                alt={displayName}
                loading="lazy"
                decoding="async"
                className="h-64 w-full object-cover sm:h-80"
              />
            ) : (
              <div className="flex h-64 w-full items-center justify-center text-sm text-gray-400 sm:h-80">
                No photo available
              </div>
            )}
          </div>
        </section>

        <section className="space-y-5 lg:col-span-3">
          <div className="rounded-lg bg-white p-6 shadow">
            <p className="text-xs uppercase tracking-wide text-gray-400">
              {product.category?.name_en ?? 'Uncategorised'}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-gray-900">{displayName}</h1>
            <p className="mt-1 text-sm text-gray-500">
              {product.brand ?? 'No brand'}
              {product.model ? ` · ${product.model}` : ''}
              {product.sku ? ` · SKU ${product.sku}` : ''}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <StockBadge stock={product.stock} />
              {product.stock?.stock_quantity !== null &&
              product.stock?.stock_quantity !== undefined ? (
                <span className="text-sm text-gray-600">
                  {product.stock.stock_quantity} {product.unit} available
                </span>
              ) : null}
            </div>

            <div className="mt-4">
              <PriceBlock price={product.price} showValidity />
            </div>

            <ConfirmationNote stock={product.stock} />

            <form onSubmit={handleQuantitySubmit} className="mt-6 space-y-3">
              <label htmlFor="product-quantity" className="block text-sm font-medium text-gray-700">
                Quantity ({product.unit}) — minimum {moq}
              </label>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center rounded-md border border-gray-300">
                  <button
                    type="button"
                    onClick={() => step(-1)}
                    disabled={quantity <= moq || Boolean(blocked)}
                    className="px-3 py-2 text-gray-700 disabled:cursor-not-allowed disabled:text-gray-300"
                    aria-label="Decrease quantity"
                  >
                    −
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
                    className="w-20 border-x border-gray-300 px-2 py-2 text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    aria-describedby={message ? 'quantity-error' : undefined}
                    aria-invalid={Boolean(message) || undefined}
                  />
                  <button
                    type="button"
                    onClick={() => step(1)}
                    disabled={Boolean(blocked)}
                    className="px-3 py-2 text-gray-700 disabled:cursor-not-allowed disabled:text-gray-300"
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={Boolean(blocked)}
                  className={`${blocked ? 'cursor-not-allowed bg-gray-200 text-gray-500' : primaryButtonClass}`}
                >
                  {blocked ? 'Unavailable' : 'Add to cart'}
                </button>
              </div>

              {message ? (
                <p id="quantity-error" role="alert" className="text-sm text-red-600">
                  {message}
                </p>
              ) : null}
              {blocked ? <p className="text-sm text-red-600">{blocked}</p> : null}
            </form>

            <div className="mt-6 border-t border-gray-100 pt-5">
              <button
                type="button"
                onClick={handleRequestQuotation}
                disabled={Boolean(blocked)}
                className={`${blocked ? 'cursor-not-allowed bg-gray-200 text-gray-500' : primaryButtonClass} w-full`}
              >
                Request Quotation
              </button>
              <p className="mt-2 text-xs text-gray-500">
                Guests are asked to sign in or register first. Nothing is submitted to the API at
                this step.
              </p>
            </div>
          </div>

          {product.supplier ? (
            <div className="rounded-lg bg-white p-6 shadow">
              <h2 className="text-base font-semibold text-gray-900">Supplier</h2>
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
                  <p className="text-sm font-medium text-gray-900">{product.supplier.shop_name}</p>
                  {product.supplier.company_name ? (
                    <p className="text-sm text-gray-600">{product.supplier.company_name}</p>
                  ) : null}
                  {product.supplier.business_description ? (
                    <p className="mt-1 text-sm text-gray-600">{product.supplier.business_description}</p>
                  ) : null}
                  <dl className="mt-2 grid grid-cols-1 gap-1 text-sm text-gray-600 sm:grid-cols-2">
                    {product.supplier.delivery_area ? (
                      <div>
                        <dt className="inline font-medium text-gray-700">Delivery area: </dt>
                        <dd className="inline">{product.supplier.delivery_area}</dd>
                      </div>
                    ) : null}
                    {product.supplier.delivery_time ? (
                      <div>
                        <dt className="inline font-medium text-gray-700">Delivery time: </dt>
                        <dd className="inline">{product.supplier.delivery_time}</dd>
                      </div>
                    ) : null}
                  </dl>
                  {product.supplier.verified ? (
                    <p className="mt-2 inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                      Verified supplier
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </section>
      </div>

      <section className="rounded-lg bg-white p-6 shadow">
        <h2 className="text-base font-semibold text-gray-900">Product details</h2>

        {product.description ? (
          <p className="mt-3 whitespace-pre-line text-sm leading-6 text-gray-700">
            {product.description}
          </p>
        ) : (
          <p className="mt-3 text-sm text-gray-500">No description has been provided.</p>
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
              <div key={label} className="flex justify-between gap-3 border-b border-gray-100 pb-2">
                <dt className="font-medium text-gray-600">{label}</dt>
                <dd className="text-right text-gray-900">{value}</dd>
              </div>
            ))}
        </dl>

        {product.price?.retail_price ? (
          <p className="mt-5 text-xs text-gray-500">
            Reference display price: {formatMMK(product.price.retail_price)} MMK per {product.unit}.
            Final pricing is issued with the supplier quotation.
          </p>
        ) : null}
      </section>
    </div>
  );
}
