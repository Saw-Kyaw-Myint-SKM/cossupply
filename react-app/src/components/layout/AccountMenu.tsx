import { useEffect, useId, useRef, useState } from 'react';
import { FiChevronDown, FiLogOut, FiUser } from 'react-icons/fi';
import { useI18n } from '../../lib/i18n-context';

interface AccountMenuProps {
  name: string;
  detail?: string | null;
  onLogout: () => void;
  className?: string;
}

/**
 * Desktop account chip: clicking the customer's name opens a small glass
 * popover with their identity and a single, clear log-out action. Phones keep
 * the static avatar; logging out stays in the drawer there.
 */
export function AccountMenu({ name, detail, onLogout, className = '' }: AccountMenuProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open) menuRef.current?.focus();
  }, [open]);

  const initial = name.trim().charAt(0).toUpperCase();

  const handleLogout = () => {
    setOpen(false);
    onLogout();
  };

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        className="group inline-flex items-center gap-2 rounded-full border border-transparent px-1.5 py-1 text-left hover:border-gray-200 hover:bg-white/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-safe:transition-colors"
      >
        <span
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-900 to-slate-700 text-xs font-semibold text-white shadow-sm"
        >
          {initial || <FiUser className="h-4 w-4" />}
        </span>
        <span className="max-w-[130px] truncate text-sm font-semibold text-gray-900">
          {name}
        </span>
        <FiChevronDown
          aria-hidden="true"
          className={`h-4 w-4 flex-none text-gray-400 motion-safe:transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={t('accountMenu')}
          tabIndex={-1}
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-64 overflow-hidden rounded-2xl border border-gray-200/80 bg-white/95 p-1.5 shadow-[0_24px_60px_-20px_rgba(15,23,42,0.4)] outline-none backdrop-blur-xl motion-safe:animate-rise-in"
        >
          <div className="flex items-center gap-3 rounded-xl bg-gradient-to-br from-slate-900 via-blue-950 to-cyan-800 px-3 py-3 text-white">
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-semibold text-white ring-1 ring-inset ring-white/25"
            >
              {initial || <FiUser className="h-4 w-4" />}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{name}</p>
              {detail ? <p className="truncate text-xs text-sky-100/80">{detail}</p> : null}
            </div>
          </div>

          <div className="mt-1">
            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-red-600 hover:bg-red-50 focus:outline-none focus-visible:bg-red-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-400 motion-safe:transition-colors"
            >
              <FiLogOut aria-hidden="true" className="h-4 w-4" />
              {t('signOut')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
