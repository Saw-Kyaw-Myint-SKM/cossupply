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
import { Alert, ReceiptCheckMark, useReceipt } from "../../../components/catalog-ui/CatalogUi";
import { FiLock, FiPlus } from "react-icons/fi";
import { formatMMK } from "../../../lib/money";
import {
  cartBlockReason,
  displayUnitPrice,
  minimumQuantity,
  needsSupplierConfirmation,
} from "../../../lib/cart-storage";
import { useCart } from "../../../lib/cart-context";

const STOCK_LABELS: Record<StockStatus, string> = {
  IN_STOCK: "In stock",
  LOW_STOCK: "Low stock",
  OUT_OF_STOCK: "Out of stock",
  PRE_ORDER: "Pre-order",
  SUPPLIER_CONFIRMATION_REQUIRED: "Supplier confirmation required",
};

const STOCK_BADGE_CLASSES: Record<StockStatus, string> = {
  IN_STOCK: "bg-green-100 text-green-800",
  LOW_STOCK: "bg-amber-100 text-amber-800",
  OUT_OF_STOCK: "bg-red-100 text-red-800",
  PRE_ORDER: "bg-blue-100 text-blue-800",
  SUPPLIER_CONFIRMATION_REQUIRED: "bg-purple-100 text-purple-800",
};

export function StockBadge({
  stock,
}: {
  stock: PublicProduct["stock"];
}): ReactNode {
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
 * Card-scale stock reading: a soft tinted pill per state — dot for the
 * color-blind-safe signal, word on top. `LOW_STOCK` gets the warning amber,
 * the rest stay in their own semantic tints. The dot is aria-hidden — color
 * is never the only carrier of the stock meaning.
 */
const STOCK_LINE_TONES: Record<StockStatus, { pill: string; dot: string }> = {
  IN_STOCK: { pill: "bg-green-50 text-green-700", dot: "bg-green-600" },
  LOW_STOCK: { pill: "bg-amber-100 text-amber-800", dot: "bg-amber-500" },
  OUT_OF_STOCK: { pill: "bg-red-50 text-red-700", dot: "bg-red-500" },
  PRE_ORDER: { pill: "bg-blue-50 text-blue-800", dot: "bg-blue-600" },
  SUPPLIER_CONFIRMATION_REQUIRED: {
    pill: "bg-violet-50 text-violet-700",
    dot: "bg-violet-500",
  },
};

export function StockLine({
  stock,
}: {
  stock: PublicProduct["stock"];
}): ReactNode {
  const tone = stock
    ? STOCK_LINE_TONES[stock.stock_status]
    : { pill: "bg-gray-100 text-gray-600", dot: "bg-gray-400" };
  const word = stock
    ? STOCK_LABELS[stock.stock_status]
    : "Availability on request";

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
  const unit = displayUnitPrice(price);

  if (unit === null || !price) {
    return (
      <p className="text-sm font-medium text-gray-600">
        Price will be confirmed in quotation
      </p>
    );
  }

  const discounted = unit !== price.retail_price;

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-baseline gap-2">
        {discounted ? (
          <span
            className="text-sm text-gray-400 line-through"
            aria-label="Original display price"
          >
            {formatMMK(price.retail_price)} MMK
          </span>
        ) : null}
        <span
          className="text-lg font-semibold text-gray-900"
          aria-label="Display price"
        >
          {formatMMK(unit)} MMK
        </span>
      </div>
      <p className="text-xs text-gray-500">
        Display price — final price is confirmed in the quotation.
      </p>
      {showValidity && price.price_valid_until ? (
        <p className="text-xs text-gray-500">
          Display price valid until {price.price_valid_until}.
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
  if (!needsSupplierConfirmation(stock?.stock_status ?? null)) return null;

  return (
    <Alert tone="warning" className="mt-4">
      Price and stock will be confirmed by the supplier before the quotation is
      issued.
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
  const [message, setMessage] = useState<string | null>(null);

  const lineQuantity =
    items.find((item) => item.product_id === product.id)?.quantity ?? 0;
  const inCart = lineQuantity > 0;
  const blocked = cartBlockReason(product);
  const moq = minimumQuantity(product.price);
  const displayName = product.name_en ?? product.name_mm;
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
    product.stock?.stock_status === "OUT_OF_STOCK" ? "Out of stock" : "Unavailable";

  return (
    <article
      className={`group relative flex flex-col overflow-hidden rounded-xl border ${
        blocked
          ? "cursor-not-allowed border-rule bg-plate"
          : "border-rule bg-white motion-safe:transition-all hover:border-ink/20 hover:shadow-[0_6px_20px_-8px_rgba(26,37,48,0.25)]"
      }`}
    >
      {/* Upper strip: category on the left (with the minimum order, since
          the SKU strip is gone), status badge on the right. A blocked
          card whispers: its meta text drops a tone. */}
      <div className="flex items-center justify-between gap-2 px-4 pb-1.5 pt-2.5">
        <p className={`truncate text-xs ${blocked ? "text-ink/40" : "text-ink/55"}`}>
          {product.category?.name_en ?? "Uncategorised"}
          {moq > 1 ? (
            <span className={blocked ? "text-ink/30" : "text-ink/40"}>{` · MOQ ${moq}`}</span>
          ) : null}
        </p>

        {product.stock?.stock_status === "SUPPLIER_CONFIRMATION_REQUIRED" ? (
          <span
            title="Price and stock will be confirmed by the supplier before the quotation"
            className="inline-flex flex-none items-center gap-1 whitespace-nowrap rounded-full bg-[#F3E8FF] px-2 py-0.5 text-[11px] font-medium text-[#7E22CE]"
          >
            <span aria-hidden="true" className="h-1.5 w-1.5 flex-none rounded-full bg-[#8B5CF6]" />
            Confirm
          </span>
        ) : (
          <StockLine stock={product.stock} />
        )}
      </div>

      {/* Image plate on the warm paper tone; the photo centers
          (object-contain), detail navigation lives here. Height scales
          down with the card so mobile 2-up stays short.
          A blocked card's photo desaturates (grayscale + contrast drop),
          takes a soft dark wash, and earns the always-visible glass lock
          — the site-reference treatment, no hover required to read it. */}
      <Link
        to={`/products/${product.id}`}
        className="relative block overflow-hidden bg-[#F7F6F3]"
      >
        {product.photo_url ? (
          <img
            src={product.photo_url}
            alt={displayName}
            loading="lazy"
            decoding="async"
            className={`h-28 w-full object-contain sm:h-36 ${
              blocked ? "opacity-70 contrast-90 grayscale" : ""
            }`}
          />
        ) : (
          <div
            className={`flex h-28 w-full items-center justify-center text-sm text-ink/25 sm:h-36 ${
              blocked ? "" : "motion-safe:transition-colors group-hover:text-ink/40"
            }`}
          >
            No photo
          </div>
        )}

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
                <FiLock aria-hidden="true" className="h-4 w-4 text-ink/60" />
              </div>
            </div>
          </>
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col px-4 pb-3 pt-3">
        <h3
          className={`text-sm font-semibold leading-snug tracking-tight ${blocked ? "text-ink/50" : "text-ink"}`}
        >
          <Link
            to={`/products/${product.id}`}
            className={`line-clamp-2 motion-safe:transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 ${
              blocked ? "" : "hover:text-accent"
            }`}
          >
            {displayName}
          </Link>
        </h3>

        <div className="mt-2 border-t border-rule" />

        {/*
         * Price block (LogicFlow §4): one label row (the unit perches on
         * the price label, dropping the third line), one value row —
         * the display price anchors the left, the running order tally
         * anchors the right when there is one. The "final price confirmed
         * in quotation" guarantee lives in the page's PricingNotice.
         */}
        <div className="mt-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <p className={`text-xs ${blocked ? "text-ink/35" : "text-ink/45"}`}>
              {unitPrice !== null && price
                ? `Unit price / ${product.unit}`
                : "Unit price"}
            </p>
            {lineQuantity > 0 ? (
              <p className="text-xs font-medium text-ink/45">In order</p>
            ) : null}
          </div>

          <div className="mt-0.5 flex items-baseline justify-between gap-2">
            {unitPrice !== null && price ? (
              <p className="flex flex-wrap items-baseline gap-x-1.5">
                {unitPrice !== price.retail_price ? (
                  <span className="text-xs text-ink/30 line-through">
                    {formatMMK(price.retail_price)}
                  </span>
                ) : null}
                <span
                  className={`text-xl font-semibold tabular-nums ${blocked ? "text-ink/45" : "text-ink"}`}
                >
                  {formatMMK(unitPrice)}
                </span>
                <span className={`text-sm font-medium ${blocked ? "text-ink/35" : "text-ink/60"}`}>
                  MMK
                </span>
              </p>
            ) : (
              <p className="text-sm font-medium text-ink/60">
                Price will be confirmed in quotation
              </p>
            )}
            {lineQuantity > 0 ? (
              <p className="whitespace-nowrap text-sm font-semibold tabular-nums text-accent">
                {lineQuantity} {product.unit}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-auto pt-3">
          {/*
           * The marketplace CTA: neutral-dark block, "+ Add another
           * {label}" once a line exists, white pill tally on the right,
           * 1.5 s receipt flip. A blocked product keeps the exact same
           * button box, but as a printed ghost bar — same height as the
           * real button, visibly not a clickable that got refused.
           */}
          <button
            type="button"
            onClick={handleAdd}
            disabled={Boolean(blocked)}
            aria-label={
              blocked
                ? `${displayName}: ${blocked}`
                : lineQuantity > 0
                  ? `Add ${displayName} to your order list; ${lineQuantity} ${product.unit} already in your order list`
                  : `Add ${displayName} to your order list`
            }
            className={
              blocked
                ? "inline-flex w-full cursor-not-allowed items-center justify-center gap-1.5 rounded-lg border border-rule bg-plate px-4 py-1.5 text-sm font-semibold text-ink/40 focus:outline-none"
                : receipt
                  ? "inline-flex w-full items-center justify-center gap-2 rounded-lg bg-green-800 px-4 py-1.5 text-sm font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 motion-safe:transition-colors"
                  : "inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-white hover:bg-primary-hover active:scale-[.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 motion-safe:transition-colors disabled:cursor-not-allowed disabled:opacity-50"
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
                    ? `Added — ${receipt.quantity}`
                    : inCart
                      ? "Add another"
                      : "Add to order list"}
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
            ? `Added ${receipt.quantity} ${product.unit} of ${displayName} to your order list.`
            : " "}
        </p>
      </div>
    </article>
  );
}
