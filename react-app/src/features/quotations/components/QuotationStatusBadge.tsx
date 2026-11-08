/**
 * Status pill for quotation request/version statuses (Task 08).
 *
 * Uses the semantic tone map in `quotationView` rather than the catalog's
 * generic StatusBadge, so "Accepted" reads green and "Expired"/"Rejected"
 * reads red everywhere the customer meets a quotation.
 */
import { useI18n } from '../../../lib/i18n-context';
import {
  QUOTATION_STATUS_TONE_CLASSES,
  quotationStatusLabel,
  quotationStatusTone,
} from '../lib/quotationView';

export default function QuotationStatusBadge({
  status,
  className = '',
  size = 'sm',
}: {
  status: string | null | undefined;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const { t } = useI18n();
  const tone = quotationStatusTone(status);

  return (
    <span
      className={`inline-flex items-center rounded-full font-bold ring-1 ring-inset ${
        size === 'md' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs'
      } ${QUOTATION_STATUS_TONE_CLASSES[tone]} ${className}`}
    >
      {quotationStatusLabel(status, t)}
    </span>
  );
}
