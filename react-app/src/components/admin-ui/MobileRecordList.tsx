import type { ReactNode } from 'react';

/**
 * Mobile presentation for the admin record tables.
 *
 * Every admin list still renders its real `<table>` from `lg` upward. Below
 * that breakpoint the table would either squeeze rows into unreadable stacks
 * or hide columns behind a horizontal scroll, so each list pairs the table
 * with this stacked card view instead.
 */
export function MobileRecordList({
  label,
  children,
  className = '',
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <ul aria-label={label} className={`divide-y divide-slate-100 lg:hidden ${className}`}>
      {children}
    </ul>
  );
}

export interface MobileRecordMeta {
  label: string;
  value: ReactNode;
}

export function MobileRecordCard({
  leading,
  title,
  subtitle,
  badges,
  trailing,
  meta,
  footer,
  children,
}: {
  /** Thumbnail, logo, or avatar shown beside the title. */
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  badges?: ReactNode;
  /** Price, date, or other value pinned to the top-right. */
  trailing?: ReactNode;
  /** Short label/value pairs shown in a two-column grid. */
  meta?: MobileRecordMeta[];
  /** Row actions, aligned to the trailing edge. */
  footer?: ReactNode;
  /** Expandable detail rendered inside the card, below the actions. */
  children?: ReactNode;
}) {
  return (
    <li className="px-4 py-4">
      <div className="flex items-start gap-3">
        {leading ? <div className="flex-none">{leading}</div> : null}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-ink">{title}</div>
          {subtitle ? <div className="mt-0.5 text-xs text-gray-500">{subtitle}</div> : null}
          {badges ? <div className="mt-2 flex flex-wrap gap-1.5">{badges}</div> : null}
        </div>
        {trailing ? <div className="flex-none text-right">{trailing}</div> : null}
      </div>

      {meta && meta.length > 0 ? (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          {meta.map((item) => (
            <div key={item.label} className="min-w-0">
              <dt className="text-gray-500">{item.label}</dt>
              <dd className="mt-0.5 break-words font-medium text-gray-800">{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {footer ? (
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3">
          {footer}
        </div>
      ) : null}

      {children ? <div className="mt-3">{children}</div> : null}
    </li>
  );
}
