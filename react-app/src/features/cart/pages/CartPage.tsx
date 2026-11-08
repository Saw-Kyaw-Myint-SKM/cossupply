/**
 * Cart Page (Task 05).
 *
 * Browser-local guest order list. Quantities are validated against each line's
 * MOQ, out-of-stock lines can never be re-added, and every price is presented
 * as a display price. "Request Quotation" only ever routes the buyer: a guest
 * is sent to the customer login/register screen, and nothing is posted to the
 * API from here (RolesPermissions §1).
 *
 * Layout: lines are grouped by supplier (the B2B grouping axis), each line is a
 * clean image | identity+price | quantity+total card, and a single summary
 * plate holds the subtotal and the quotation action. On mobile the summary
 * becomes a sticky bottom bar; on desktop it sits as a sticky side card.
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
import { StockLine } from '../../products/components/ProductUi';
import { useAuth } from '../../../lib/auth-context';
import { useCart } from '../../../lib/cart-context';
import { formatMMK } from '../../../lib/money';
import {
  cartSubtotal,
  lineKey,
  needsSupplierConfirmation,
  quantityError,
  type CartItem,
} from '../../../lib/cart-storage';
import { useI18n } from '../../../lib/i18n-context';

interface SupplierGroup {
  key: string;
  supplierId: number;
  supplierName: string | null;
  lines: CartItem[];
  subtotal: number;
}

/** Group cart lines by supplier, preserving the order they were added in. */
function groupBySupplier(items: CartItem[]): SupplierGroup[] {
  const groups: SupplierGroup[] = [];
  const indexByKey = new Map<string, number>();

  for (const item of items) {
    const key = String(item.supplier_id);
    const existing = indexByKey.get(key);

    if (existing === undefined) {
      indexByKey.set(key, groups.length);
      groups.push({
        key,
        supplierId: item.supplier_id,
        supplierName: item.supplier_name,
        lines: [item],
        subtotal: item.unit_price * item.quantity,
      });
    } else {
      const group = groups[existing];
      group.lines.push(item);
      group.subtotal += item.unit_price * item.quantity;
    }
  }

  return groups;
}

export default function CartPage() {
  const { items, setQuantity, remove, clear } = useCart();
  const { isAuthenticated, userType } = useAuth();
  const navigate = useNavigate();
  const { t, displayName } = useI18n();

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);

  const subtotal = cartSubtotal(items);
  const unitCount = items.reduce((total, item) => total + item.quantity, 0);
  const hasSupplierConfirmationLines = items.some((item) =>
    needsSupplierConfirmation(item.stock_status),
  );

  const draftFor = (item: CartItem): string =>
    drafts[lineKey(item)] ?? String(item.quantity);

  const handleDraftChange = (item: CartItem, raw: string) => {
    setDrafts((current) => ({ ...current, [lineKey(item)]: raw }));
    setRowErrors((current) => ({ ...current, [lineKey(item)]: '' }));
  };

  const commit = (item: CartItem, quantity: number) => {
    const failure = setQuantity(lineKey(item), quantity);

    if (failure) {
      setRowErrors((current) => ({ ...current, [lineKey(item)]: failure }));
      return false;
    }

    setRowErrors((current) => ({ ...current, [lineKey(item)]: '' }));
    setDrafts((current) => {
      const next = { ...current };
      delete next[lineKey(item)];
      return next;
    });
    return true;
  };

  const handleDraftCommit = (item: CartItem) => {
    const raw = draftFor(item).trim();

    if (raw === '') {
      setRowErrors((current) => ({
        ...current,
        [lineKey(item)]: t('cartQuantityMinimum', { minimum: item.minimum_order_quantity }),
      }));
      return;
    }

    const quantity = Number(raw);
    const invalid = quantityError(quantity, item.minimum_order_quantity);

    if (invalid) {
      setRowErrors((current) => ({ ...current, [lineKey(item)]: invalid }));
      return;
    }

    commit(item, quantity);
  };

  const handleStep = (item: CartItem, delta: number) => {
    const next = item.quantity + delta;
    const invalid = quantityError(next, item.minimum_order_quantity);

    if (invalid) {
      setRowErrors((current) => ({ ...current, [lineKey(item)]: invalid }));
      return;
    }

    commit(item, next);
  };

  const handleRemove = (item: CartItem) => {
    remove(lineKey(item));
    setBanner(null);
    setDrafts((current) => {
      const next = { ...current };
      delete next[lineKey(item)];
      return next;
    });
    setRowErrors((current) => {
      const next = { ...current };
      delete next[lineKey(item)];
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
        [lineKey(invalidLine)]:
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
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader title={t('orderList')} />
        <EmptyState
          title={t('emptyOrderList')}
          hint={t('browseCatalogStart')}
        />
        <div className="text-center">
          <Link to="/products" className={`${primaryButtonClass} inline-block`}>
            {t('browseProducts')}
          </Link>
        </div>
      </div>
    );
  }

  const groups = groupBySupplier(items);

  return (
    <div className="mx-auto max-w-6xl pb-32 space-y-6 sm:pb-0">
      <PageHeader
        title={t('orderList')}
        description={t('orderListDescription')}
      />

      {banner ? <Alert tone="warning">{banner}</Alert> : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* Supplier-grouped lines */}
        <div className="space-y-6">
          {groups.map((group) => (
            <section
              className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_18px_40px_-24px_rgba(15,23,42,0.22)]"
              key={group.key}
              aria-label={group.supplierName ?? t('supplierDefault')}
            >
              <div
                aria-hidden="true"
                className="h-[3px] w-full bg-gradient-to-r from-primary via-sky-400 to-violet-400"
              />
              <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-slate-100 px-4 py-3 sm:px-5">
                <h2 className="text-sm font-semibold text-ink">
                  {group.supplierName ?? t('supplierDefault')}
                </h2>
                <span className="text-xs text-subtle tabular-nums">
                  {group.lines.length} {t(group.lines.length === 1 ? 'line' : 'lines')} · {formatMMK(group.subtotal)} MMK
                </span>
              </header>

              <ul className="divide-y divide-slate-100">
                {group.lines.map((item) => {
                  const rowError = rowErrors[lineKey(item)];
                  const minimum = item.minimum_order_quantity;
                  const atMinimum = item.quantity <= minimum;

                  const metaParts = [
                    item.category_name ?? t('uncategorised'),
                    minimum > 1 ? t('minimumOrderShort', { count: minimum }) : null,
                    item.sku ? t('sku', { sku: item.sku }) : null,
                  ]
                    .map((part) => (part ?? '').trim())
                    .filter((part) => part.length > 0);

                  return (
                    <li
                      key={lineKey(item)}
                      className="flex gap-4 p-4 transition-colors hover:bg-slate-50/70 sm:p-5"
                    >
                      <Link to={`/products/${item.product_id}`} className="flex-none">
                        <img
                          src={item.photo_url ?? FALLBACK_THUMB}
                          alt={displayName(item)}
                          loading="lazy"
                          decoding="async"
                          className="h-16 w-16 rounded-lg object-cover sm:h-20 sm:w-20"
                        />
                      </Link>

                      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                        {/* Left: product identity */}
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-ink">
                            <Link to={`/products/${item.product_id}`} className="hover:text-primary">
                              {displayName(item)}
                            </Link>
                          </h3>
                          {item.variant_label ? (
                            <p className="mt-0.5 text-xs font-medium text-primary">{item.variant_label}</p>
                          ) : null}
                          <p className="mt-0.5 text-xs text-subtle">{metaParts.join(' · ')}</p>
                          <div className="mt-1.5">
                            <StockLine
                              stock={
                                item.stock_status
                                  ? {
                                      stock_status: item.stock_status,
                                      stock_quantity: item.stock_quantity,
                                      last_confirmed_at: null,
                                    }
                                  : null
                              }
                            />
                          </div>
                          {needsSupplierConfirmation(item.stock_status) ? (
                            <p className="mt-1 inline-block rounded-md bg-purple-50 px-2 py-1 text-xs text-purple-800">
                              {t('supplierWillConfirm')}
                            </p>
                          ) : null}
                        </div>

                        {/* Right: price and quantity side by side on desktop */}
                        <div className="flex flex-col gap-3 sm:flex-none sm:items-end">
                          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/60 pt-3 sm:justify-end sm:gap-5 sm:border-0 sm:pt-0">
                            {/* Unit price */}
                            <div className="text-right">
                              <p className="text-sm font-medium text-ink">
                                {formatMMK(item.unit_price)} MMK
                                {item.unit ? (
                                  <span className="text-xs font-normal text-subtle"> / {item.unit}</span>
                                ) : null}
                              </p>
                              <p className="text-xs text-subtle">{t('displayPrice')}</p>
                            </div>

                            {/* Quantity — pill stepper with circular buttons */}
                            <div className="inline-flex items-center gap-1 rounded-full border border-line/70 bg-white p-1 shadow-sm focus-within:ring-2 focus-within:ring-primary/30">
                              <button
                                type="button"
                                onClick={() => handleStep(item, -1)}
                                disabled={atMinimum}
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-paper text-ink transition-colors hover:bg-primary hover:text-white active:scale-95 disabled:cursor-not-allowed disabled:bg-transparent disabled:text-subtle/40 disabled:hover:bg-transparent disabled:hover:text-subtle/40 motion-safe:transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                                aria-label={t('decreaseItemQuantity', { name: displayName(item) })}
                              >
                                <FiMinus aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.5} />
                              </button>
                              <input
                                type="number"
                                inputMode="numeric"
                                min={minimum}
                                step={1}
                                value={draftFor(item)}
                                onChange={(event) => handleDraftChange(item, event.target.value)}
                                onBlur={() => handleDraftCommit(item)}
                                aria-label={t('itemQuantity', { name: displayName(item) })}
                                aria-invalid={Boolean(rowError) || undefined}
                                className="w-10 border-0 bg-transparent px-0 py-1 text-center text-sm font-semibold text-ink tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleStep(item, 1)}
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-paper text-ink transition-colors hover:bg-primary hover:text-white active:scale-95 motion-safe:transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                                aria-label={t('increaseItemQuantity', { name: displayName(item) })}
                              >
                                <FiPlus aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.5} />
                              </button>
                            </div>
                          </div>

                          {/* Line total + remove */}
                          <div className="flex items-center justify-between gap-4 sm:justify-end">
                            <div className="text-right">
                              <p className="text-xs text-subtle">{t('lineTotal')}</p>
                              <p className="text-sm font-semibold text-ink tabular-nums">
                                {formatMMK(item.unit_price * item.quantity)} MMK
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemove(item)}
                              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-red-600 hover:bg-red-50 hover:text-red-800"
                            >
                              <FiTrash2 aria-hidden="true" className="h-3.5 w-3.5" />
                              {t('remove')}
                            </button>
                          </div>

                          {rowError ? (
                            <p role="alert" className="text-right text-xs text-red-600 sm:max-w-[14rem]">
                              {rowError}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>

        {/* Summary — sticky bottom bar on mobile, sticky side card on desktop */}
        <div className="lg:relative">
          <form
            onSubmit={handleRequestQuotation}
            className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/70 bg-white/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl lg:inset-x-auto lg:bottom-auto lg:sticky lg:top-24 lg:rounded-2xl lg:border lg:border-slate-200/70 lg:bg-white lg:p-6 lg:shadow-[0_1px_2px_rgba(15,23,42,0.04),0_20px_44px_-24px_rgba(15,23,42,0.25)]"
          >
            <h2 className="hidden text-sm font-semibold text-ink lg:block">
              {t('orderListSummary')}
            </h2>

            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <span className="text-sm font-medium text-ink">{t('subtotalDisplayPrice')}</span>
              <span className="text-xl font-semibold text-ink tabular-nums">
                {formatMMK(subtotal)} MMK
              </span>
            </div>

            <p className="mt-1 hidden text-xs text-subtle lg:block">
              {t('orderListSummaryCount', {
                units: unitCount,
                unitLabel: t(unitCount === 1 ? 'unit' : 'units'),
                lines: items.length,
                lineLabel: t(items.length === 1 ? 'line' : 'lines'),
              })}
            </p>
            <p className="mt-2 hidden text-xs text-subtle lg:block">
              {t('indicativeOnly')}
            </p>

            {hasSupplierConfirmationLines ? (
              <p className="mt-2 hidden rounded-md bg-purple-50 px-2 py-1 text-xs text-purple-800 lg:block">
                {t('someLinesNeedSupplierConfirmation')}
              </p>
            ) : null}

            <button type="submit" className={`${primaryButtonClass} mt-4 w-full`}>
              {t('requestQuotationButton')}
            </button>

            <p className="mt-2 hidden text-xs text-subtle lg:block">
              {isAuthenticated && userType === 'customer'
                ? t('continueRequest')
                : t('signInRequest')}
            </p>

            <button type="button" onClick={handleClear} className={`${secondaryButtonClass} mt-3 w-full`}>
              <FiTrash2 aria-hidden="true" className="h-4 w-4" />
              {t('clearCart')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
