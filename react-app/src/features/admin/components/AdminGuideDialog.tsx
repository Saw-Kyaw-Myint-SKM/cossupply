/**
 * Shared `?` guide dialog used by the admin workspaces.
 *
 * The trigger is a quiet icon button; the dialog renders in a portal, traps
 * focus while open, closes on Escape/backdrop click, and returns focus to the
 * trigger. Callers provide the Myanmar copy and any sections they need.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { FiHelpCircle, FiX } from 'react-icons/fi';
import { primaryButtonClass } from '../../../components/catalog-ui/CatalogUi';

interface AdminGuideDialogProps {
  /** Small label above the title, e.g. the workflow area. */
  eyebrow: string;
  title: string;
  description: string;
  /** Accessible name and tooltip for the trigger button. */
  triggerLabel: string;
  triggerTitle: string;
  footerNote: string;
  children: ReactNode;
}

export function AdminGuideDialog({
  eyebrow,
  title,
  description,
  triggerLabel,
  triggerTitle,
  footerNote,
  children,
}: AdminGuideDialogProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusFirstControl = () => {
      dialogRef.current?.querySelector<HTMLElement>('button')?.focus();
    };
    const frame = window.requestAnimationFrame(focusFirstControl);

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
        ),
      );

      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);

    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={triggerLabel}
        aria-haspopup="dialog"
        title={triggerTitle}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white text-gray-500 shadow-sm hover:border-primary/30 hover:bg-accent-soft hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-safe:transition-colors"
      >
        <FiHelpCircle aria-hidden="true" className="h-5 w-5" />
      </button>

      {open
        ? createPortal(
            <div
              className="fixed inset-0 z-[120] flex items-center justify-center bg-ink/45 p-3 sm:p-6"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) close();
              }}
            >
              <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
                tabIndex={-1}
                className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-2xl outline-none sm:max-h-[calc(100vh-3rem)]"
              >
                <header className="flex items-start justify-between gap-4 border-b border-rule px-5 py-4 sm:px-6">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                      {eyebrow}
                    </p>
                    <h2 id={titleId} className="mt-0.5 text-xl font-semibold text-ink">
                      {title}
                    </h2>
                    <p id={descriptionId} className="mt-1 text-sm text-muted">
                      {description}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={close}
                    aria-label="လမ်းညွှန် ပိတ်ရန်"
                    className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 motion-safe:transition-colors"
                  >
                    <FiX aria-hidden="true" className="h-5 w-5" />
                  </button>
                </header>

                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                  {children}
                </div>

                <footer className="flex items-center justify-between gap-3 border-t border-rule bg-white px-5 py-3 sm:px-6">
                  <p className="text-xs text-subtle">{footerNote}</p>
                  <button type="button" onClick={close} className={primaryButtonClass}>
                    နားလည်ပါပြီ
                  </button>
                </footer>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
