/**
 * Presentation pieces for the public catalog (Task 05).
 *
 * Shared by the home, category, product list, product detail, and cart pages
 * so the display-price disclaimer, the stock vocabulary, and the media
 * treatment are identical everywhere a buyer can see a product.
 */
import type { ReactNode } from "react";
import { useState } from "react";
import { Link } from "react-router-dom";
import type { ApiResponse } from "../../../api/client";
import type {
  PublicProduct,
  PublicProductPrice,
  StockStatus,
} from "../../../api/catalog";
import { Alert, FALLBACK_THUMB, ReceiptCheckMark, useReceipt } from "../../../components/catalog-ui/CatalogUi";
import { FiLock, FiPlus } from "react-icons/fi";
import { formatMMK } from "../../../lib/money";
import {
  cartBlockReason,
  displayUnitPrice,
  minimumQuantity,
  needsSupplierConfirmation,
} from "../../../lib/cart-storage";
import { useCart } from "../../../lib/cart-context";
import { useI18n } from '../../../lib/i18n-context';

const STOCK_LABEL_KEYS: Record<StockStatus, 'inStock' | 'lowStock' | 'outOfStock' | 'preOrder' | 'supplierConfirmationRequired'> = {
  IN_STOCK: 'inStock',
  LOW_STOCK: 'lowStock',
  OUT_OF_STOCK: 'outOfStock',
  PRE_ORDER: 'preOrder',
  SUPPLIER_CONFIRMATION_REQUIRED: 'supplierConfirmationRequired',
};

const STOCK_BADGE_CLASSES: Record<StockStatus, string> = {
  IN_STOCK: "bg-success-soft text-success",
  LOW_STOCK: "bg-warning-soft text-warning",
  OUT_OF_STOCK: "bg-error-soft text-error",
  PRE_ORDER: "bg-primary-light text-primary",
  SUPPLIER_CONFIRMATION_REQUIRED: "bg-purple-50 text-purple-700",
};

export function StockBadge({
  stock,
}: {
  stock: PublicProduct["stock"];
}): ReactNode {
  const { t } = useI18n();
  if (!stock) {
    return (
      <span className="inline-flex items-center rounded-full bg-paper px-2 py-0.5 text-xs font-medium text-ink">
        {t('availabilityOnRequest')}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STOCK_BADGE_CLASSES[stock.stock_status]}`}
    >
      {t(STOCK_LABEL_KEYS[stock.stock_status])}
    </span>
  );
}

/**
 * Card-scale stock reading: a soft tinted pill per state — dot for the
 * color-blind-safe signal, word on top. `LOW_STOCK` gets the warning amber,
 * the rest stay in their own semantic tints. The dot is aria-hidden — color
 * is never the only carrier of the stock meaning.
 */
const STOCK_LINE_TONES: Record<StockStatus, { pill: string; dot: string }> = {
  IN_STOCK: { pill: "bg-success-soft text-success", dot: "bg-success" },
  LOW_STOCK: { pill: "bg-warning-soft text-warning", dot: "bg-warning" },
  OUT_OF_STOCK: { pill: "bg-error-soft text-error", dot: "bg-error" },
  PRE_ORDER: { pill: "bg-primary-light text-primary", dot: "bg-primary" },
  SUPPLIER_CONFIRMATION_REQUIRED: {
    pill: "bg-purple-50 text-purple-700",
    dot: "bg-purple-500",
  },
};

export function StockLine({
  stock,
}: {
  stock: PublicProduct["stock"];
}): ReactNode {
  const { t } = useI18n();
  const tone = stock
    ? STOCK_LINE_TONES[stock.stock_status]
    : { pill: "bg-paper text-muted", dot: "bg-subtle" };
  const word = stock
    ? t(STOCK_LABEL_KEYS[stock.stock_status])
    : t('availabilityOnRequest');

  return (
    <span
      className={`inline-flex items-center whitespace-nowrap gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${tone.pill}`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 flex-none rounded-full ${tone.dot}`}
      />
      {word}
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
  const { t } = useI18n();
  const unit = displayUnitPrice(price);

  if (unit === null || !price) {
    return (
      <p className="text-sm font-medium text-muted">
        {t('priceConfirmed')}
      </p>
    );
  }

  const discounted = unit !== price.retail_price;

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-baseline gap-2">
        {discounted ? (
          <span
            className="text-sm text-subtle line-through"
            aria-label={t('originalDisplayPrice')}
          >
            {formatMMK(price.retail_price)} MMK
          </span>
        ) : null}
        <span
          className="text-lg font-semibold text-ink"
          aria-label={t('displayPrice')}
        >
          {formatMMK(unit)} MMK
        </span>
      </div>
      <p className="text-xs text-subtle">
        {t('displayPriceFinal')}
      </p>
      {showValidity && price.price_valid_until ? (
        <p className="text-xs text-subtle">
          {t('displayPriceValidUntil', { date: price.price_valid_until })}
        </p>
      ) : null}
    </div>
  );
}

/** Extra line required when a product awaits supplier confirmation. */
export function ConfirmationNote({
  stock,
}: {
  stock: PublicProduct["stock"];
}): ReactNode {
  const { t } = useI18n();
  if (!needsSupplierConfirmation(stock?.stock_status ?? null)) return null;

  return (
    <Alert tone="warning" className="mt-4">
      {t('priceStockConfirmation')}
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
    return "Could not reach the server. Check that the API is running and try again.";
  }

  if (response.status === 404) {
    return `The ${subject} you are looking for is unavailable.`;
  }

  return response.message ?? `Unable to load ${subject}.`;
}

/**
 * Catalog card, B2B marketplace layout:
 *
 *   [ category · MOQ           status badge ]
 *   [      product image (plate)            ]
 *   ───────────────────────────────────────
 *   Title
 *   ───────────────────────────────────────
 *   Unit price / piece          In order
 *   55,547 MMK                     9 pcs
 *   [ + Add to order list · (9) ]
 *
 * Colors come from the app's ink + paper palette rather than flat
 * neutrals: warm rule borders, an ink-tinted hover shadow, ink text with
 * warm-gray secondaries, the ink CTA, and the accent reserved for two
 * purposeful touches (title hover, the in-order tally) so the card reads
 * as part of the catalog, not a bolt-on widget.
 *
 * Guest add-to-order-list flow keeps: 1.5 s receipt ("Added — N", drawn
 * check, header badge pop) and the running count in the button badge.
 * Out-of-stock renders a disabled button. Detail navigation is the image
 * and the title. The full PriceBlock stays on the detail page.
 */
export function ProductCard({
  product,
}: {
  product: PublicProduct;
}): ReactNode {
  const { items, add, lastAdded } = useCart();
  const { t, displayName: catalogName } = useI18n();
  const [message, setMessage] = useState<string | null>(null);

  const lineQuantity =
    items.find((item) => item.product_id === product.id)?.quantity ?? 0;
  const blocked = cartBlockReason(product);
  const moq = minimumQuantity(product.price);
  const displayName = catalogName(product);
  const price = product.price;
  const unitPrice = displayUnitPrice(price);

  /** The receipt moment: "Added — N" on the button while the header badge pops. */
  const receipt = useReceipt(product.id, lastAdded);

  const handleAdd = () => {
    setMessage(add(product, moq));
  };

  /** Short state word for the disabled card: the ghost bar and the hover
   * overlay headline. The full reason sentence stays in `blocked`. */
  const blockedLabel =
    product.stock?.stock_status === "OUT_OF_STOCK" ? t('outOfStock') : t('unavailable');

  const retail = price?.retail_price ?? null;
  const hasReduction =
    unitPrice !== null && retail !== null && unitPrice < retail;
  const discountPercent =
    hasReduction && retail !== null && unitPrice !== null
      ? Math.round(((retail - unitPrice) / retail) * 100)
      : null;

  return (
    <article
      className={`glass-card group relative flex flex-col overflow-hidden ${
        blocked ? "cursor-not-allowed" : "glass-card-hover"
      }`}
    >
      {/* Photo plate on the tint; the discount badge clips into the
          top-right corner exactly as the storefront design draws it. */}
      <div className="relative">
        <Link
          to={`/products/${product.id}`}
          className="relative flex h-52 items-center justify-center overflow-hidden rounded-t-2xl bg-gradient-to-br from-white/70 via-white/30 to-primary-light/50 p-4 sm:h-40"
        >
          <img
            src={product.photo_url ?? FALLBACK_THUMB}
            alt={displayName}
            loading="lazy"
            decoding="async"
            className={`h-full w-full object-contain ${
              blocked ? "opacity-70 contrast-90 grayscale" : ""
            }`}
          />          

          {blocked ? (
            <>
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/25 via-ink/5 to-transparent"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 flex items-center justify-center"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-lg backdrop-blur-sm">
                  <FiLock aria-hidden="true" className="h-4 w-4 text-muted" />
                </div>
              </div>
            </>
          ) : null}
        </Link>

        <div className="absolute left-2.5 top-2.5 max-w-[70%]">
          {product.stock?.stock_status === "SUPPLIER_CONFIRMATION_REQUIRED" ? (
            <span
              title={t('priceStockConfirmation')}
              className="inline-flex flex-none items-center gap-1 whitespace-nowrap rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700"
            >
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 flex-none rounded-full bg-violet-500"
              />
              {t('confirm')}
            </span>
          ) : (
            <StockLine stock={product.stock} />
          )}
        </div>

        {discountPercent !== null ? (
          <span
            aria-label={t('discountPercent', { percent: discountPercent })}
            className="absolute right-0 top-0 flex h-[53px] w-[51px] flex-col items-center justify-center rounded-bl-2xl rounded-tr-2xl bg-emerald-500 text-[13px] font-semibold leading-4 text-white"
          >
            {discountPercent}%
            <span className="text-[10px] font-medium leading-3">{t('off')}</span>
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col rounded-b-2xl px-3.5 pb-3.5 pt-3">
        <p
          className={`truncate text-[11px] font-medium ${
            blocked ? "text-subtle/60" : "text-muted"
          }`}
        >
          {product.category ? catalogName(product.category) : t('uncategorised')}
          {` · ${product.unit}`}
          {moq > 1 ? ` · ${t('minimumOrderShort', { count: moq })}` : null}
        </p>

        <h3 className="mt-1 text-[13px] font-medium leading-[18px]">
          <Link
            to={`/products/${product.id}`}
            className={`line-clamp-2 motion-safe:transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${
              blocked ? "text-ink/50" : "text-ink hover:text-primary"
            }`}
          >
            {displayName}
          </Link>
        </h3>

        <div className="mt-2 flex flex-wrap items-baseline gap-x-2">
          {unitPrice !== null ? (
            <>
              <span
                className={`text-base font-bold tabular-nums ${
                  blocked ? "text-ink/45" : "text-ink"
                }`}
              >
                {formatMMK(unitPrice)}
              </span>
              <span className="text-[11px] font-medium text-muted">MMK</span>
              {hasReduction && retail !== null ? (
                <span
                  aria-label={t('originalDisplayPrice')}
                  className="text-[13px] text-muted line-through"
                >
                  {formatMMK(retail)}
                </span>
              ) : null}
            </>
          ) : (
            <span className="text-[13px] text-muted">
              {t('priceOnQuotation')}
            </span>
          )}
        </div>

        <div className="mt-2 border-t border-rule/60" />

        <div className="mt-auto pt-3">
          {/*
           * The storefront CTA: full-width primary block, "+ Add another"
           * once a line exists, a white pill tally on the right, and the
           * 1.5 s receipt flip. A blocked product keeps the exact same
           * button box as a printed ghost bar — visibly not a refused click.
           */}
          <button
            type="button"
            onClick={handleAdd}
            disabled={Boolean(blocked)}
            aria-label={
              blocked
                ? t('unavailableItem', { name: displayName, reason: blocked })
                : lineQuantity > 0
                  ? t('addExistingItemToOrderList', { name: displayName, quantity: lineQuantity, unit: product.unit })
                  : t('addItemToOrderList', { name: displayName })
            }
            className={
              blocked
                ? "inline-flex w-full cursor-not-allowed items-center justify-center gap-1.5 rounded-lg border border-rule bg-paper px-4 py-1.5 text-[13px] font-semibold text-ink/40 focus:outline-none"
                : receipt
                  ? "inline-flex w-full items-center justify-center gap-2 rounded-lg bg-success px-4 py-2 text-[13px] font-semibold text-white shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-success focus-visible:ring-offset-2 motion-safe:transition-all"
                  : "inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-1.5 text-[13px] font-semibold text-white shadow-sm hover:bg-primary-hover hover:shadow-md active:scale-[.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-safe:transition-all disabled:cursor-not-allowed disabled:opacity-50"
            }
          >
            <span className="inline-flex items-center justify-center gap-2">
              {blocked ? (
                <FiLock aria-hidden="true" className="h-4 w-4" />
              ) : receipt ? (
                <ReceiptCheckMark />
              ) : (
                <FiPlus aria-hidden="true" className="h-4 w-4" />
              )}
              <span
                key={receipt ? receipt.at : "idle"}
                className="motion-safe:animate-rise-in"
              >
                {blocked
                  ? blockedLabel
                  : receipt
                    ? t('added', { quantity: receipt.quantity })
                    : t('addToOrderList')}
              </span>
            </span>

            {/** Running tally in a white pill: the CTA's own counterweight,
              * announced only through the button's aria-label. */}
            {lineQuantity > 0 && !blocked ? (
              <span
                key={lineQuantity}
                aria-hidden="true"
                className="flex items-center overflow-hidden rounded-full bg-white px-1.5 py-0.5"
              >
                <span className="motion-safe:animate-count-roll text-xs font-semibold leading-none text-ink">
                  {lineQuantity}
                </span>
              </span>
            ) : null}
          </button>

          <div className="mt-1.5 space-y-0.5">
            {message ? (
              <p
                key={message}
                role="alert"
                className="motion-safe:animate-rise-in text-xs font-medium text-red-600"
              >
                {message}
              </p>
            ) : null}
          </div>
        </div>

        <p aria-live="polite" className="sr-only">
          {receipt
            ? t('receiptAddedToOrderList', { quantity: receipt.quantity, unit: product.unit, name: displayName })
            : ' '}
        </p>
      </div>
    </article>
  );
}
