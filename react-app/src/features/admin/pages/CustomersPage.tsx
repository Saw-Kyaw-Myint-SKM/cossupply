/**
 * Admin customer directory (Task 12).
 *
 * Read-only list of registered customers with quotation/order counts. There
 * is deliberately no create/edit action here: registration and profile edits
 * belong to the customer, and the backend exposes no admin write route.
 */
import { useEffect, useState, type FormEvent } from 'react';
import { useI18n } from '../../../lib/i18n-context';
import { formatLocalDate } from '../../../lib/localization';
import {
  Alert,
  EmptyState,
  LoadingPanel,
  PageHeader,
  Pagination,
  StatusBadge,
  describeLoadError,
  formatStatusLabel,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
  type LoadErrorState,
} from '../../../components/catalog-ui/CatalogUi';
import type { PaginationMeta } from '../../../api/query';
import {
  listCustomers,
  type CustomerStatus,
  type CustomerType,
  type DirectoryCustomer,
} from '../api/customersApi';

const PER_PAGE = 20;

function formatWhen(value: string, locale: 'en' | 'my', fallback: string): string {
  return formatLocalDate(value, locale) ?? fallback;
}

export default function AdminCustomersPage() {
  const { locale, t } = useI18n();
  const [customers, setCustomers] = useState<DirectoryCustomer[] | null>(null);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<CustomerStatus | ''>('');
  const [customerType, setCustomerType] = useState<CustomerType | ''>('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<LoadErrorState | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setLoadError(null);

      const response = await listCustomers({
        page,
        per_page: PER_PAGE,
        status: status || undefined,
        customer_type: customerType || undefined,
        search: search || undefined,
      });

      if (cancelled) return;

      if (response.success && response.data) {
        setCustomers(response.data.customers);
        setMeta(response.data.meta);
      } else {
        setLoadError(describeLoadError(response, t('customersTitle'), t));
      }

      setIsLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [page, status, customerType, search, reloadToken]);

  const hasFilters = search !== '' || status !== '' || customerType !== '';

  const clearFilters = () => {
    setSearchInput('');
    setSearch('');
    setStatus('');
    setCustomerType('');
    setPage(1);
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('customersTitle')}
        description={t('customersDescription')}
      />

      <div className="rounded-lg border border-rule bg-plate p-4">
        <form
          onSubmit={submitSearch}
          role="search"
          aria-label={t('filterCustomers')}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          <div className="lg:col-span-2">
            <label htmlFor="customer-search" className="block text-sm font-medium text-ink">
              {t('searchCustomer')}
            </label>
            <div className="mt-1 flex gap-2">
              <input
                id="customer-search"
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                maxLength={100}
                className={`${inputClass(false)} min-w-0 flex-1`}
                placeholder="09123456789"
              />
              <button type="submit" className={secondaryButtonClass}>
                {t('search')}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="customer-status-filter" className="block text-sm font-medium text-ink">
              {t('status')}
            </label>
            <select
              id="customer-status-filter"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as CustomerStatus | '');
                setPage(1);
              }}
              className={`${inputClass(false)} mt-1`}
            >
              <option value="">{t('allStatuses')}</option>
              <option value="active">{t('active')}</option>
              <option value="inactive">{t('inactive')}</option>
              <option value="suspended">{t('suspended')}</option>
            </select>
          </div>

          <div>
            <label htmlFor="customer-type-filter" className="block text-sm font-medium text-ink">
              {t('accountType')}
            </label>
            <select
              id="customer-type-filter"
              value={customerType}
              onChange={(event) => {
                setCustomerType(event.target.value as CustomerType | '');
                setPage(1);
              }}
              className={`${inputClass(false)} mt-1`}
            >
              <option value="">{t('allTypes')}</option>
              <option value="individual">{t('individual')}</option>
              <option value="business">{t('business')}</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={clearFilters}
              className={secondaryButtonClass}
              disabled={!hasFilters}
            >
              {t('clearFilters')}
            </button>
          </div>
        </form>
      </div>

      {isLoading && customers === null ? <LoadingPanel label={t('loadingCustomers')} /> : null}

      {loadError ? (
        <Alert>
          <p>{loadError.message}</p>
          {loadError.needsLogin ? null : (
            <button
              type="button"
              onClick={() => setReloadToken((token) => token + 1)}
              className={`${primaryButtonClass} mt-3`}
            >
              {t('tryAgain')}
            </button>
          )}
        </Alert>
      ) : null}

      {!isLoading && !loadError && customers !== null && customers.length === 0 ? (
        <EmptyState
          title={hasFilters ? t('noCustomersMatch') : t('noCustomersYet')}
          hint={hasFilters ? t('customerFilterHint') : t('customerEmptyHint')}
        />
      ) : null}

      {customers !== null && customers.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-rule bg-plate">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-rule text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">{t('customer')}</th>
                  <th scope="col" className="px-4 py-3 font-medium">{t('contact')}</th>
                  <th scope="col" className="px-4 py-3 font-medium">{t('type')}</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">{t('quotations')}</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">{t('orders')}</th>
                  <th scope="col" className="px-4 py-3 font-medium">{t('joined')}</th>
                  <th scope="col" className="px-4 py-3 font-medium">{t('status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {customers.map((customer) => (
                  <tr key={customer.id} className="align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{customer.name}</p>
                      {customer.company_name ? (
                        <p className="text-xs text-gray-500">{customer.company_name}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <p className="whitespace-nowrap text-ink">{customer.phone}</p>
                      <p className="whitespace-nowrap text-xs text-gray-500">
                        {customer.email ?? t('noEmail')}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-ink">
                      {formatStatusLabel(customer.customer_type)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-ink">
                      {customer.quotation_requests_count}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-ink">
                      {customer.orders_count}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">
                      {formatWhen(customer.created_at, locale, t('noData'))}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <StatusBadge status={customer.status.toUpperCase()} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="border-t border-rule px-4 py-3 text-xs text-gray-500">
            {t('customersReadOnlyHint')}
          </p>

          {meta ? <Pagination meta={meta} onPage={setPage} disabled={isLoading} /> : null}
        </div>
      ) : null}
    </div>
  );
}
