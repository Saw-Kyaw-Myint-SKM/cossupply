/**
 * Presentation pieces for the public catalog (Task 05).
 *
 * Shared by the home, category, product list, product detail, and cart pages
 * so the display-price disclaimer, the stock vocabulary, and the media
 * treatment are identical everywhere a buyer can see a product.
 */
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { ApiResponse } from '../../../api/client';
import type { PublicProduct, PublicProductPrice, StockStatus } from '../../../api/catalog';
import { Alert, primaryButtonClass, secondaryButtonClass } from '../../../components/catalog-ui/CatalogUi';
import { formatMMK } from '../../../lib/money';
import {
  cartBlockReason,
  displayUnitPrice,
  minimumQuantity,
  needsSupplierConfirmation,
} from '../../../lib/cart-storage';
import { useCart } from '../../../lib/cart-context';

const STOCK_LABELS: Record<StockStatus, string> = {
  IN_STOCK: 'In stock',
  LOW_STOCK: 'Low stock',
  OUT_OF_STOCK: 'Out of stock',
  PRE_ORDER: 'Pre-order',
  SUPPLIER_CONFIRMATION_REQUIRED: 'Supplier confirmation required',
};

const STOCK_BADGE_CLASSES: Record<StockStatus, string> = {
  IN_STOCK: 'bg-green-100 text-green-800',
  LOW_STOCK: 'bg-amber-100 text-amber-800',
  OUT_OF_STOCK: 'bg-red-100 text-red-800',
  PRE_ORDER: 'bg-blue-100 text-blue-800',
  SUPPLIER_CONFIRMATION_REQUIRED: 'bg-purple-100 text-purple-800',
};

export function StockBadge({ stock }: { stock: PublicProduct['stock'] }): ReactNode {
  if (!stock) {
    return (
      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
        Availability on request
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STOCK_BADGE_CLASSES[stock.stock_status]}`}
    >
      {STOCK_LABELS[stock.stock_status]}
    </span>
  );
}

/**
 * The display price with the mandatory non-final label
 * (LogicFlow §4: display price is never the final price).
 */
export function PriceBlock({
  price,
  showValidity = false,
}: {
  price: PublicProductPrice | null | undefined;
  showValidity?: boolean;
}): ReactNode {
  const unit = displayUnitPrice(price);

  if (unit === null || !price) {
    return (
      <p className="text-sm font-medium text-gray-600">Price will be confirmed in quotation</p>
    );
  }

  const discounted = unit !== price.retail_price;

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-baseline gap-2">
        {discounted ? (
          <span className="text-sm text-gray-400 line-through" aria-label="Original display price">
            {formatMMK(price.retail_price)} MMK
          </span>
        ) : null}
        <span className="text-lg font-semibold text-gray-900" aria-label="Display price">
          {formatMMK(unit)} MMK
        </span>
      </div>
      <p className="text-xs text-gray-500">
        Display price — final price is confirmed in the quotation.
      </p>
      {showValidity && price.price_valid_until ? (
        <p className="text-xs text-gray-500">Display price valid until {price.price_valid_until}.</p>
      ) : null}
    </div>
  );
}

/** Extra line required when a product awaits supplier confirmation. */
export function ConfirmationNote({ stock }: { stock: PublicProduct['stock'] }): ReactNode {
  if (!needsSupplierConfirmation(stock?.stock_status ?? null)) return null;

  return (
    <Alert tone="warning" className="mt-4">
      Price and stock will be confirmed by the supplier before the quotation is issued.
    </Alert>
  );
}

/**
 * Describes a failed public catalog request. Guests never see auth wording:
 * a 401/403 here can only mean the API is misconfigured or unreachable.
 */
export function describeCatalogError(
  response: ApiResponse<unknown>,
  subject: string,
): string {
  if (response.status === undefined) {
    return 'Could not reach the server. Check that the API is running and try again.';
  }

  if (response.status === 404) {
    return `The ${subject} you are looking for is unavailable.`;
  }

  return response.message ?? `Unable to load ${subject}.`;
}

/**
 * Catalog card: lazy media, the display-price label, the stock badge, and the
 * guest add-to-cart action. Out-of-stock products render a disabled button so
 * the rule is visible before any click happens.
 */
export function ProductCard({ product }: { product: PublicProduct }): ReactNode {
  const { items, add } = useCart();
  const [message, setMessage] = useState<string | null>(null);

  const inCart = items.some((item) => item.product_id === product.id);
  const blocked = cartBlockReason(product);
  const moq = minimumQuantity(product.price);
  const displayName = product.name_en ?? product.name_mm;

  const handleAdd = () => {
    setMessage(add(product, moq));
  };

  return (
    <article className="flex flex-col overflow-hidden rounded-lg bg-white shadow">
      <Link to={`/products/${product.id}`} className="block bg-gray-100">
        {product.photo_url ? (
          <img
            src={product.photo_url}
            alt={displayName}
            loading="lazy"
            decoding="async"
            className="h-40 w-full object-cover"
          />
        ) : (
          <div className="flex h-40 w-full items-center justify-center text-sm text-gray-400">
            No photo
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-gray-400">
            {product.category?.name_en ?? 'Uncategorised'}
          </p>
          <h3 className="text-sm font-semibold text-gray-900">
            <Link to={`/products/${product.id}`} className="hover:text-blue-700">
              {displayName}
            </Link>
          </h3>
          {product.sku ? <p className="text-xs text-gray-400">{product.sku}</p> : null}
        </div>

        <StockBadge stock={product.stock} />
        <PriceBlock price={product.price} />

        <div className="mt-auto space-y-2">
          <button
            type="button"
            onClick={handleAdd}
            disabled={Boolean(blocked)}
            className={`${blocked ? 'cursor-not-allowed bg-gray-200 text-gray-500' : primaryButtonClass} w-full`}
            aria-label={`Add ${displayName} to cart`}
          >
            {blocked ? 'Unavailable' : inCart ? 'Add another' : 'Add to cart'}
          </button>

          {blocked ? <p className="text-xs text-red-600">{blocked}</p> : null}
          {!blocked ? <p className="text-xs text-gray-500">Minimum order: {moq}</p> : null}
          {message ? <p className="text-xs font-medium text-red-600">{message}</p> : null}

          <Link to={`/products/${product.id}`} className={`${secondaryButtonClass} block w-full text-center`}>
            View details
          </Link>
        </div>
      </div>
    </article>
  );
}
