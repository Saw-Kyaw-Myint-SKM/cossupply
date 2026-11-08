/**
 * Shared row-action affordance for the admin tables.
 *
 * Tables stay calm: one visible action (usually Edit) plus a single overflow
 * trigger. Secondary actions such as status changes and destructive actions
 * live in the menu, so the row keeps a stable height and the table columns
 * never shift. Confirmation opens in an anchored popover instead of expanding
 * the cell.
 */
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { FiCheck, FiMoreHorizontal } from 'react-icons/fi';

export interface TableActionItem {
  key: string;
  label: string;
  icon?: ReactNode;
  tone?: 'default' | 'danger';
  checked?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

export interface TableActionGroup {
  label?: string;
  items: TableActionItem[];
}

export interface TableActionConfirm {
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  busy?: boolean;
  tone?: 'danger' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

interface TableActionsProps {
  /** Accessible name for the overflow trigger, e.g. "Actions for Acme". */
  label?: string;
  /** The one action that is always visible in the row. */
  primary?: ReactNode;
  /** Menu sections. Omit when the row has only a primary action. */
  groups?: TableActionGroup[];
  /** Anchored confirmation panel, controlled by the page. */
  confirm?: TableActionConfirm | null;
  disabled?: boolean;
}

interface Position {
  top: number;
  right: number;
}

const EDGE_GAP = 8;
const TRIGGER_GAP = 6;
const MENU_WIDTH = 240;

const triggerClass =
  'inline-flex h-8 w-8 flex-none items-center justify-center rounded-lg border border-transparent text-gray-500 hover:bg-gray-100 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-40 motion-safe:transition-colors';

const panelClass =
  'fixed z-[110] rounded-xl border border-line bg-white shadow-[0_18px_50px_-18px_rgba(15,23,42,0.35)] outline-none motion-safe:animate-rise-in';

const menuItemClass =
  'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-medium focus:outline-none disabled:cursor-not-allowed disabled:text-subtle disabled:hover:bg-transparent motion-safe:transition-colors';

const secondaryConfirmClass =
  'inline-flex items-center justify-center rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink shadow-sm hover:bg-accent-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 motion-safe:transition-colors';

const dangerConfirmClass =
  'inline-flex items-center justify-center rounded-lg border border-transparent bg-error px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-error focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 motion-safe:transition-colors';

const defaultConfirmClass =
  'inline-flex items-center justify-center rounded-lg border border-transparent bg-primary px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 motion-safe:transition-colors';

export function TableActions({
  label = 'Row actions',
  primary,
  groups = [],
  confirm = null,
  disabled = false,
}: TableActionsProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const confirmTitleId = useId();

  const hasMenu = groups.some((group) => group.items.length > 0);
  const menuItemCount = groups.reduce((total, group) => total + group.items.length, 0);
  const confirmOpen = confirm !== null;
  const menuVisible = menuOpen && !confirmOpen;
  const panelOpen = menuVisible || confirmOpen;

  // Opening a confirmation replaces the menu in the same anchored spot.
  useEffect(() => {
    if (confirmOpen) setMenuOpen(false);
  }, [confirmOpen]);

  // Measure the active panel after it mounts and keep it inside the viewport.
  useLayoutEffect(() => {
    if (!panelOpen) {
      setPosition(null);
      return;
    }

    const update = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const panel = confirmOpen ? confirmRef.current : menuRef.current;
      const estimatedHeight = confirmOpen ? 132 : 64 + menuItemCount * 38;
      const panelHeight = panel?.offsetHeight ?? estimatedHeight;
      const openUp = rect.bottom + TRIGGER_GAP + panelHeight > window.innerHeight - EDGE_GAP;
      const top = openUp
        ? Math.max(EDGE_GAP, rect.top - panelHeight - TRIGGER_GAP)
        : rect.bottom + TRIGGER_GAP;

      setPosition({
        top,
        right: Math.max(EDGE_GAP, window.innerWidth - rect.right),
      });
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);

    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [confirmOpen, menuItemCount, panelOpen]);

  // Move focus into the panel once it is visible.
  useEffect(() => {
    if (menuVisible) {
      menuRef.current?.focus();
    }
  }, [menuVisible]);

  useEffect(() => {
    if (confirmOpen) {
      confirmRef.current?.focus();
    }
  }, [confirmOpen]);

  // Escape closes the open layer and returns focus to the trigger.
  useEffect(() => {
    if (!panelOpen) return;

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;

      event.preventDefault();
      if (confirmOpen) {
        confirm.onCancel();
      } else {
        setMenuOpen(false);
      }
      triggerRef.current?.focus();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [confirm, confirmOpen, panelOpen]);

  // Clicking anywhere outside the trigger and panels closes the layer.
  useEffect(() => {
    if (!panelOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target) ||
        confirmRef.current?.contains(target)
      ) {
        return;
      }

      if (confirmOpen) {
        confirm.onCancel();
      } else {
        setMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [confirm, confirmOpen, panelOpen]);

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"]:not(:disabled), [role="menuitemradio"]:not(:disabled)',
      ) ?? [],
    );

    if (items.length === 0) return;

    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      items[(currentIndex + 1) % items.length]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      items[(currentIndex - 1 + items.length) % items.length]?.focus();
    } else if (event.key === 'Home') {
      event.preventDefault();
      items[0]?.focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      items[items.length - 1]?.focus();
    } else if (event.key === 'Tab') {
      event.preventDefault();
      setMenuOpen(false);
      triggerRef.current?.focus();
    }
  };

  const selectItem = (item: TableActionItem) => {
    if (item.disabled) return;
    setMenuOpen(false);
    item.onSelect();
  };

  const panelStyle = {
    top: position?.top ?? 0,
    right: position?.right ?? EDGE_GAP,
    width: MENU_WIDTH,
    visibility: position ? 'visible' : 'hidden',
  } as const;

  return (
    <div className="inline-flex items-center justify-end gap-1.5">
      {primary}

      {hasMenu ? (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => {
            if (confirmOpen) {
              if (!confirm?.busy) confirm?.onCancel();
              return;
            }
            setMenuOpen((value) => !value);
          }}
          disabled={disabled}
          aria-label={label}
          aria-haspopup="menu"
          aria-expanded={menuVisible}
          aria-controls={menuVisible ? menuId : undefined}
          className={triggerClass}
        >
          <FiMoreHorizontal aria-hidden="true" className="h-4 w-4" />
        </button>
      ) : null}

      {menuVisible
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              role="menu"
              aria-label={label}
              tabIndex={-1}
              style={panelStyle}
              onKeyDown={handleMenuKeyDown}
              className={`${panelClass} p-1.5`}
            >
              {groups
                .filter((group) => group.items.length > 0)
                .map((group, groupIndex) => (
                  <div
                    key={group.label ?? groupIndex}
                    className={groupIndex > 0 ? 'mt-1 border-t border-rule pt-1' : ''}
                  >
                    {group.label ? (
                      <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-subtle">
                        {group.label}
                      </p>
                    ) : null}

                    {group.items.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        role={item.checked === undefined ? 'menuitem' : 'menuitemradio'}
                        aria-checked={item.checked === undefined ? undefined : item.checked}
                        disabled={item.disabled}
                        onClick={() => selectItem(item)}
                        className={`${menuItemClass} ${
                          item.tone === 'danger'
                            ? 'text-error hover:bg-error-soft focus-visible:bg-error-soft'
                            : 'text-ink hover:bg-accent-soft focus-visible:bg-accent-soft'
                        }`}
                      >
                        {item.icon ? (
                          <span aria-hidden="true" className="flex h-4 w-4 flex-none items-center justify-center">
                            {item.icon}
                          </span>
                        ) : null}
                        <span className="flex-1">{item.label}</span>
                        {item.checked ? (
                          <FiCheck aria-hidden="true" className="h-4 w-4 flex-none text-primary" />
                        ) : null}
                      </button>
                    ))}
                  </div>
                ))}
            </div>,
            document.body,
          )
        : null}

      {confirmOpen
        ? createPortal(
            <div
              ref={confirmRef}
              role="dialog"
              aria-modal="false"
              aria-labelledby={confirmTitleId}
              tabIndex={-1}
              style={panelStyle}
              className={`${panelClass} p-3`}
            >
              <p id={confirmTitleId} className="text-sm font-semibold text-ink">
                {confirm.title}
              </p>
              {confirm.description ? (
                <p className="mt-1 text-xs leading-5 text-muted">{confirm.description}</p>
              ) : null}

              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    confirm.onCancel();
                    triggerRef.current?.focus();
                  }}
                  disabled={confirm.busy}
                  className={secondaryConfirmClass}
                >
                  {confirm.cancelLabel}
                </button>
                <button
                  type="button"
                  onClick={confirm.onConfirm}
                  disabled={confirm.busy}
                  className={confirm.tone === 'danger' ? dangerConfirmClass : defaultConfirmClass}
                >
                  {confirm.confirmLabel}
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
