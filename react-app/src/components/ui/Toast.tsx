import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { FiAlertCircle, FiX } from 'react-icons/fi';
import { useI18n } from '../../lib/i18n-context';

export type ToastTone = 'success' | 'error';

export interface ToastOptions {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** Milliseconds before the toast dismisses itself. Defaults to 5000. */
  duration?: number;
}

interface ToastRecord extends ToastOptions {
  id: number;
  tone: ToastTone;
  duration: number;
}

interface ToastContextValue {
  showToast: (options: ToastOptions) => void;
  dismissToast: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const DEFAULT_DURATION = 5000;
const MAX_TOASTS = 3;

let nextToastId = 1;

/**
 * Top-right notification stack shared by every area of the app.
 *
 * Mounted above the router, so a toast triggered just before navigation
 * (for example after creating a product) keeps showing on the next page.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((options: ToastOptions) => {
    const toast: ToastRecord = {
      ...options,
      id: nextToastId++,
      tone: options.tone ?? 'success',
      duration: options.duration ?? DEFAULT_DURATION,
    };

    setToasts((current) => [...current, toast].slice(-MAX_TOASTS));
  }, []);

  const value = useMemo(
    () => ({ showToast, dismissToast }),
    [showToast, dismissToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastRecord[];
  onDismiss: (id: number) => void;
}) {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed right-4 top-20 z-[100] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-3 sm:right-6"
    >
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>,
    document.body,
  );
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastRecord;
  onDismiss: (id: number) => void;
}) {
  const { t } = useI18n();
  const isSuccess = toast.tone === 'success';

  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(toast.id), toast.duration);
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.duration, onDismiss]);

  return (
    <div
      role="status"
      className={`pointer-events-auto relative overflow-hidden rounded-2xl border bg-white/95 p-4 pr-11 backdrop-blur-xl motion-safe:animate-toast-in ${
        isSuccess
          ? 'border-success/25 shadow-[0_20px_50px_-20px_rgba(45,159,74,0.45)]'
          : 'border-error/25 shadow-[0_20px_50px_-20px_rgba(217,54,54,0.45)]'
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={`flex h-10 w-10 flex-none items-center justify-center rounded-full text-white shadow-lg ${
            isSuccess
              ? 'bg-gradient-to-br from-emerald-400 to-teal-600 shadow-success/30'
              : 'bg-gradient-to-br from-rose-400 to-red-600 shadow-error/30'
          }`}
        >
          {isSuccess ? (
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
              <path
                d="M5 12.5l4.2 4.2L19 7"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="24"
                className="motion-safe:animate-check-draw"
              />
            </svg>
          ) : (
            <FiAlertCircle className="h-5 w-5" />
          )}
        </span>

        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-sm font-semibold text-ink">{toast.title}</p>
          {toast.description ? (
            <p className="mt-0.5 text-sm leading-5 text-muted">{toast.description}</p>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label={t('dismiss')}
        className="absolute right-3 top-3 rounded-lg p-1.5 text-subtle transition-colors hover:bg-slate-100 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        <FiX className="h-4 w-4" aria-hidden="true" />
      </button>

      <span
        aria-hidden="true"
        style={{ animationDuration: `${toast.duration}ms` }}
        className={`absolute inset-x-0 bottom-0 h-[3px] origin-left motion-safe:animate-toast-progress ${
          isSuccess
            ? 'bg-gradient-to-r from-success to-emerald-400'
            : 'bg-gradient-to-r from-error to-rose-400'
        }`}
      />
    </div>
  );
}
