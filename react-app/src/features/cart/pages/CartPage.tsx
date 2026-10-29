/**
 * Cart Page (Task 05).
 *
 * Browser-local guest order list. Quantities are validated against each line's
 * MOQ, out-of-stock lines can never be re-added, and every price is presented
 * as a display price. "Request Quotation" only ever routes the buyer: a guest
 * is sent to the customer login/register screen, and nothing is posted to the
 * API from here (RolesPermissions §1).
 */
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiMinus, FiPlus, FiTrash2 } from 'react-icons/fi';
import {
  Alert,
  EmptyState,
  FALLBACK_THUMB,
  PageHeader,
  primaryButtonClass,
  secondaryButtonClass,
} from '../../../components/catalog-ui/CatalogUi';
import { useAuth } from '../../../lib/auth-context';
import { useCart } from '../../../lib/cart-context';
import { formatMMK } from '../../../lib/money';
import {
  cartSubtotal,
  needsSupplierConfirmation,
  quantityError,
  type CartItem,
} from '../../../lib/cart-storage';

export default function CartPage() {
  const { items, setQuantity, remove, clear } = useCart();
  const { isAuthenticated, userType } = useAuth();
  const navigate = useNavigate();

  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  const [banner, setBanner] = useState<string | null>(null);

  const subtotal = cartSubtotal(items);

  const draftFor = (item: CartItem): string =>
    drafts[item.product_id] ?? String(item.quantity);

  const handleDraftChange = (item: CartItem, raw: string) => {
    setDrafts((current) => ({ ...current, [item.product_id]: raw }));
    setRowErrors((current) => ({ ...current, [item.product_id]: '' }));
  };

  const commit = (item: CartItem, quantity: number) => {
    const failure = setQuantity(item.product_id, quantity);

    if (failure) {
      setRowErrors((current) => ({ ...current, [item.product_id]: failure }));
      return false;
    }

    setRowErrors((current) => ({ ...current, [item.product_id]: '' }));
    setDrafts((current) => {
      const next = { ...current };
      delete next[item.product_id];
      return next;
    });
    return true;
  };

  const handleDraftCommit = (item: CartItem) => {
    const raw = draftFor(item).trim();

    if (raw === '') {
      setRowErrors((current) => ({
        ...current,
        [item.product_id]: `Quantity must be at least ${item.minimum_order_quantity}.`,
      }));
      return;
    }

    const quantity = Number(raw);
    const invalid = quantityError(quantity, item.minimum_order_quantity);

    if (invalid) {
      setRowErrors((current) => ({ ...current, [item.product_id]: invalid }));
      return;
    }

    commit(item, quantity);
  };

  const handleStep = (item: CartItem, delta: number) => {
    const next = item.quantity + delta;
    const invalid = quantityError(next, item.minimum_order_quantity);

    if (invalid) {
      setRowErrors((current) => ({ ...current, [item.product_id]: invalid }));
      return;
    }

    commit(item, next);
  };

  const handleRemove = (item: CartItem) => {
    remove(item.product_id);
    setBanner(null);
    setDrafts((current) => {
      const next = { ...current };
      delete next[item.product_id];
      return next;
    });
  };

  const handleClear = () => {
    clear();
    setBanner(null);
    setDrafts({});
    setRowErrors({});
  };

  const handleRequestQuotation = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const invalidLine = items.find(
      (item) => quantityError(item.quantity, item.minimum_order_quantity) !== null,
    );

    if (invalidLine) {
      setRowErrors((current) => ({
        ...current,
        [invalidLine.product_id]:
          quantityError(invalidLine.quantity, invalidLine.minimum_order_quantity) ?? '',
      }));
      return;
    }

    setBanner(null);
    navigate(
      isAuthenticated && userType === 'customer'
        ? '/quotations/new' // the request form handles the POST (Task 06)
        : '/login',
    );
  };

  if (items.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Order list" />
        <EmptyState
          title="Your order list is empty"
          hint="Browse the catalog and add products to start a quotation request."
        />
        <div className="text-center">
          <Link to="/products" className={`${primaryButtonClass} inline-block`}>
            Browse products
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-28 space-y-6 sm:pb-0">
      <PageHeader
        title="Order list"
        description="Quantities are saved in this browser. Prices are display prices and are confirmed in your quotation."
      />

      {banner ? <Alert tone="warning">{banner}</Alert> : null}

      <section className="glass-panel" aria-busy="false">
        <ul className="divide-y divide-white/60">
          {items.map((item) => {
            const rowError = rowErrors[item.product_id];
            const minimum = item.minimum_order_quantity;
            const atMinimum = item.quantity <= minimum;

            return (
              <li key={item.product_id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start">
                <Link to={`/products/${item.product_id}`} className="flex-none">
                  <img
                    src={item.photo_url ?? FALLBACK_THUMB}
                    alt={item.name_en ?? item.name_mm}
                    loading="lazy"
                    decoding="async"
                    className="h-20 w-20 rounded-md object-cover"
                  />
                </Link>

                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-semibold text-ink">
                    <Link to={`/products/${item.product_id}`} className="hover:text-accent">
                      {item.name_en ?? item.name_mm}
                    </Link>
                  </h2>
                  <p className="mt-0.5 text-xs text-subtle">
                    {item.supplier_name ?? 'Supplier'}
                    {item.sku ? ` · SKU ${item.sku}` : ''}
                  </p>

                  <div className="mt-2 space-y-1">
                    <p className="text-sm font-medium text-ink">
                      {formatMMK(item.unit_price)} MMK / {item.unit}
                    </p>
                    <p className="text-xs text-subtle">
                      Display price — final price confirmed in quotation.
                    </p>
                    <p className="text-xs text-subtle">Minimum order: {minimum}</p>
                  </div>

                  {needsSupplierConfirmation(item.stock_status) ? (
                    <p className="mt-2 rounded-md bg-purple-50 px-2 py-1 text-xs text-purple-800">
                      Price and stock will be confirmed by the supplier.
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-none flex-col items-start gap-2 sm:items-end">
                  <div className="flex items-center rounded-lg border border-white/70 bg-white/70">
                  <button
                    type="button"
                    onClick={() => handleStep(item, -1)}
                    disabled={atMinimum}
                    className="flex h-11 w-11 items-center justify-center text-ink disabled:cursor-not-allowed disabled:text-line"
                    aria-label={`Decrease quantity of ${item.name_en ?? item.name_mm}`}
                  >
                    <FiMinus aria-hidden="true" className="h-4 w-4" />
                  </button>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={minimum}
                      step={1}
                      value={draftFor(item)}
                      onChange={(event) => handleDraftChange(item, event.target.value)}
                      onBlur={() => handleDraftCommit(item)}
                      aria-label={`Quantity of ${item.name_en ?? item.name_mm}`}
                      aria-invalid={Boolean(rowError) || undefined}
                      className="w-20 border-x border-line px-2 py-2 text-center text-sm text-ink outline-none focus:ring-2 focus:ring-inset focus:ring-accent"
                    />
                    <button
                      type="button"
                      onClick={() => handleStep(item, 1)}
                      className="flex h-11 w-11 items-center justify-center text-ink"
                      aria-label={`Increase quantity of ${item.name_en ?? item.name_mm}`}
                    >
                      <FiPlus aria-hidden="true" className="h-4 w-4" />
                    </button>
                  </div>

                  {rowError ? (
                    <p role="alert" className="max-w-[14rem] text-xs text-red-600">
                      {rowError}
                    </p>
                  ) : null}

                  <p className="text-sm font-semibold text-ink tabular-nums">
                    {formatMMK(item.unit_price * item.quantity)} MMK
                  </p>

                  <button
                    type="button"
                    onClick={() => handleRemove(item)}
                    className="inline-flex items-center gap-1 text-sm text-red-600 hover:text-red-800"
                  >
                    <FiTrash2 aria-hidden="true" className="h-3.5 w-3.5" />
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rule px-4 py-4">
          <p className="text-sm text-muted">
            {items.length} {items.length === 1 ? 'line' : 'lines'} in your order list
          </p>
          <button type="button" onClick={handleClear} className={secondaryButtonClass}>
            Clear cart
          </button>
        </div>
      </section>

      {/*
       * Subtotal + the single quotation action. On mobile it becomes a
       * sticky bottom bar so the submit is never off-screen; on desktop it
       * stays a closing plate beneath the lines.
       */}
      <form
        onSubmit={handleRequestQuotation}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/60 bg-white/90 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl sm:static sm:rounded-2xl sm:border sm:border-white/70 sm:bg-white/85 sm:p-6 sm:pb-6 sm:shadow-glass sm:backdrop-blur-xl"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <span className="text-sm font-medium text-ink">Subtotal (display price)</span>
          <span className="text-xl font-semibold text-ink tabular-nums">
            {formatMMK(subtotal)} MMK
          </span>
        </div>
        <p className="mt-1 text-xs text-subtle sm:block hidden">
          Indicative only. Delivery, discounts and the service fee are calculated by the server
          when the quotation is issued.
        </p>

        <button type="submit" className={`${primaryButtonClass} mt-5 w-full sm:mt-4`}>
          Request Quotation
        </button>
        <p className="mt-2 text-xs text-subtle hidden sm:block">
          {isAuthenticated && userType === 'customer'
            ? 'Continue to the request form to submit your quotation request.'
            : 'You will be asked to sign in or register first. Your order list is kept in this browser.'}
        </p>
      </form>
    </div>
  );
}
