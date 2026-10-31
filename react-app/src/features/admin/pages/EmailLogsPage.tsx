/**
 * Admin email delivery log and resend page (Task 11).
 *
 * Failed sends keep their stored error so Admin can see what went wrong and
 * resend an eligible email. Resending appends a new log row; the original
 * attempt is never overwritten.
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
  describeRequestError,
  formatStatusLabel,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
  smallButtonClass,
  type LoadErrorState,
} from '../../../components/catalog-ui/CatalogUi';
import type { PaginationMeta } from '../../../api/query';
import {
  listEmailLogs,
  resendEmailLog,
  type EmailLog,
  type EmailLogStatus,
} from '../../notifications/api/emailLogsApi';

const PER_PAGE = 15;

const STATUS_OPTIONS: EmailLogStatus[] = ['SENT', 'FAILED'];

function formatWhen(value: string | null, locale: 'en' | 'my', fallback: string): string {
  return formatLocalDate(value, locale, { dateStyle: 'medium', timeStyle: 'short' }) ?? fallback;
}

export default function AdminEmailLogsPage() {
  const { locale, t } = useI18n();
  const [logs, setLogs] = useState<EmailLog[] | null>(null);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<EmailLogStatus | ''>('FAILED');
  const [search, setSearch] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<LoadErrorState | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [resendingId, setResendingId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setLoadError(null);

      const response = await listEmailLogs({
        page,
        per_page: PER_PAGE,
        status,
        search: searchTerm,
      });

      if (cancelled) return;

      if (response.success && response.data) {
        setLogs(response.data.email_logs);
        setMeta(response.data.meta);
      } else {
        setLoadError(describeLoadError(response, t('emailDeliveryLog'), t));
      }

      setIsLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [page, status, searchTerm, reloadToken]);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setSearchTerm(search.trim());
  };

  const resend = async (log: EmailLog) => {
    setResendingId(log.id);
    setNotice(null);
    setActionError(null);

    const response = await resendEmailLog(log.id);

    setResendingId(null);

    if (response.success && response.data) {
      setNotice(
        t('emailResent', {
          email: response.data.email.recipient_email,
          status: response.data.email.status === 'SENT' ? t('statusSent') : t('statusFailed'),
        }),
      );
      setReloadToken((token) => token + 1);
      return;
    }

    setActionError(describeRequestError(response, t('resendEmailFailed'), t));
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('emailDeliveryLog')}
        description={t('emailDeliveryDescription')}
      />

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-rule bg-plate p-4">
        <div>
          <label htmlFor="email-log-status" className="block text-sm font-medium text-ink">
            {t('status')}
          </label>
          <select
            id="email-log-status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as EmailLogStatus | '');
              setPage(1);
            }}
            className={`${inputClass(false)} mt-1 w-full sm:w-48`}
          >
            <option value="">{t('allStatuses')}</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option === 'SENT' ? t('statusSent') : t('statusFailed')}
              </option>
            ))}
          </select>
        </div>

        <form onSubmit={submitSearch} className="flex flex-1 flex-wrap items-end gap-2">
          <div className="min-w-48 flex-1">
            <label htmlFor="email-log-search" className="block text-sm font-medium text-ink">
              {t('recipientOrSubject')}
            </label>
            <input
              id="email-log-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              maxLength={100}
              className={`${inputClass(false)} mt-1`}
              placeholder={t('emailLogSearchPlaceholder')}
            />
          </div>
          <button type="submit" className={primaryButtonClass}>
            {t('search')}
          </button>
          {searchTerm ? (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setSearchTerm('');
                setPage(1);
              }}
              className={secondaryButtonClass}
            >
              {t('clearFilters')}
            </button>
          ) : null}
        </form>
      </div>

      {notice ? <Alert tone="success">{notice}</Alert> : null}
      {actionError ? <Alert>{actionError}</Alert> : null}

      {isLoading && logs === null ? <LoadingPanel label={t('loadingEmailLog')} /> : null}

      {loadError ? (
        <Alert>
          <p>{loadError.message}</p>
          {loadError.needsLogin ? null : (
            <button
              type="button"
              onClick={() => setReloadToken((token) => token + 1)}
              className={`${secondaryButtonClass} mt-3`}
            >
              {t('tryAgain')}
            </button>
          )}
        </Alert>
      ) : null}

      {!isLoading && !loadError && logs !== null && logs.length === 0 ? (
        <EmptyState
          title={t('noEmailAttempts')}
          hint={t('emailEmptyHint')}
        />
      ) : null}

      {logs !== null && logs.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-rule bg-plate">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-rule text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">{t('recipient')}</th>
                  <th scope="col" className="px-4 py-3 font-medium">{t('email')}</th>
                  <th scope="col" className="px-4 py-3 font-medium">{t('status')}</th>
                  <th scope="col" className="px-4 py-3 font-medium">{t('attempted')}</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">{t('action')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {logs.map((log) => (
                  <tr key={log.id} className="align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{log.recipient_email}</p>
                      <p className="text-xs text-gray-500">
                        {formatStatusLabel(log.related_type.split('\\').pop() ?? log.related_type)}{' '}
                        #{log.related_id}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-ink">{log.subject}</p>
                      <p className="text-xs text-gray-500">{formatStatusLabel(log.email_type)}</p>
                      {log.error_message ? (
                        <p className="mt-1 max-w-md text-xs text-red-700">{log.error_message}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={log.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{formatWhen(log.created_at, locale, t('noData'))}</td>
                    <td className="px-4 py-3 text-right">
                      {log.resendable ? (
                        <button
                          type="button"
                          onClick={() => void resend(log)}
                          disabled={resendingId === log.id}
                          className={smallButtonClass}
                        >
                          {resendingId === log.id ? t('resending') : t('resendEmail')}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">{t('notResendable')}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {meta ? <Pagination meta={meta} onPage={setPage} disabled={isLoading} /> : null}
        </div>
      ) : null}
    </div>
  );
}
