import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

interface AreaSwitchProps {
  /** Destination for the other half of the customer experience. */
  to: string;
  label: string;
  icon: ReactNode;
  /** Spoken label — the visible text is hidden on phones. */
  description: string;
}

/**
 * One pill that always points at the other side of the app: the shop while
 * the customer is in the dashboard, and the dashboard while they are in the
 * shop. The text collapses to an icon below `sm` so the mobile header keeps
 * its breathing room; `aria-label` carries the meaning for screen readers
 * once the visible label is hidden.
 */
export function AreaSwitch({ to, label, icon, description }: AreaSwitchProps) {
  return (
    <Link
      to={to}
      aria-label={description}
      title={description}
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm hover:border-primary/40 hover:bg-primary-light hover:text-primary hover:shadow active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-safe:transition-all sm:w-auto sm:px-4"
    >
      <span aria-hidden="true" className="text-[18px]">
        {icon}
      </span>
      <span className="hidden text-sm font-semibold sm:inline">{label}</span>
    </Link>
  );
}
