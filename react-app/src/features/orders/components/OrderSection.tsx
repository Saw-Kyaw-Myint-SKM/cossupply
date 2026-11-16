/**
 * One numbered card on the customer order detail page.
 *
 * The journey band says where the order is; these cards explain the four parts
 * of the order itself. A card leads with its number (when it belongs to the
 * guided sequence), then its purpose, then the data — so a buyer can skip
 * straight to the card they need without reading every value on the page.
 */
import { useId, type ReactNode } from 'react';
import { useI18n } from '../../../lib/i18n-context';

export type OrderSectionAccent = 'sky' | 'emerald' | 'amber' | 'violet';

const ACCENT_CLASSES: Record<
  OrderSectionAccent,
  { tile: string; step: string }
> = {
  sky: {
    tile: 'bg-sky-50 text-sky-700 ring-sky-200/70',
    step: 'text-sky-700',
  },
  emerald: {
    tile: 'bg-emerald-50 text-emerald-700 ring-emerald-200/70',
    step: 'text-emerald-700',
  },
  amber: {
    tile: 'bg-amber-50 text-amber-700 ring-amber-200/70',
    step: 'text-amber-700',
  },
  violet: {
    tile: 'bg-violet-50 text-violet-700 ring-violet-200/70',
    step: 'text-violet-700',
  },
};

interface OrderSectionProps {
  /** 1-based position in the guided sequence; omit for supporting cards. */
  step?: number;
  accent: OrderSectionAccent;
  icon: ReactNode;
  title: string;
  /** One plain sentence on why this card exists. */
  hint?: string;
  /** Small contextual value shown at the top-right of the header. */
  meta?: ReactNode;
  contentClassName?: string;
  className?: string;
  children: ReactNode;
}

export function OrderSection({
  step,
  accent,
  icon,
  title,
  hint,
  meta,
  contentClassName = 'px-4 py-4 sm:px-5 sm:py-5',
  className = '',
  children,
}: OrderSectionProps) {
  const { t } = useI18n();
  const headingId = useId();
  const accentClasses = ACCENT_CLASSES[accent];

  return (
    <section
      aria-labelledby={headingId}
      className={`glass-card overflow-hidden ${className}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-line/50 px-4 pb-3 pt-4 sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <span
            aria-hidden="true"
            className={`flex h-9 w-9 flex-none items-center justify-center rounded-xl ring-1 ring-inset ${accentClasses.tile}`}
          >
            {icon}
          </span>

          <div className="min-w-0">
            {step !== undefined ? (
              <p
                className={`text-[10.5px] font-semibold uppercase tracking-[0.14em] ${accentClasses.step}`}
              >
                {t('stepNumber', { number: step })}
              </p>
            ) : null}
            <h2
              id={headingId}
              className="text-[15px] font-semibold leading-snug text-ink"
            >
              {title}
            </h2>
            {hint ? (
              <p className="mt-0.5 max-w-[58ch] text-xs leading-relaxed text-muted">
                {hint}
              </p>
            ) : null}
          </div>
        </div>

        {meta ? <div className="flex-none text-right">{meta}</div> : null}
      </header>

      <div className={contentClassName}>{children}</div>
    </section>
  );
}
