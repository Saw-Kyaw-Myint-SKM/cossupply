/**
 * Quotation Detail Page (Placeholder)
 *
 * The Task 06 list links here; reading and reviewing a quotation version
 * itself (LogicFlow §8) is implemented in Task 08.
 */
import { Link } from 'react-router-dom';
import { linkClass, PageHeader } from '../../../components/catalog-ui/CatalogUi';

export default function QuotationDetailPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Quotation detail" />
      <div className="rounded-lg border border-rule bg-plate p-6">
        <p className="text-gray-600">
          The quotation review screen — versions, pricing, and accept flow — will be implemented
          in Task 08.
        </p>
        <Link to="/quotations" className={`${linkClass} mt-4 inline-block`}>
          Back to my quotations
        </Link>
      </div>
    </div>
  );
}
