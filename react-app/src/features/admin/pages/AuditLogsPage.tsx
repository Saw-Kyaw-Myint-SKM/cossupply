/**
 * Admin audit trail (Task 12).
 *
 * Read-only view of every documented admin operation. Each row keeps the
 * before/after snapshot written by the backend service; the expander shows
 * exactly which fields changed and their old → new values.
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
  describeLoadError,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
  smallButtonClass,
  type LoadErrorState,
} from '../../../components/catalog-ui/CatalogUi';
import type { PaginationMeta } from '../../../api/query';
import {
  changedFields,
  listAuditLogs,
  type AuditLogAdmin,
  type AuditLogEntry,
} from '../api/auditLogsApi';

const PER_PAGE = 20;

function formatWhen(value: string | null, locale: 'en' | 'my', fallback: string): string {
  return formatLocalDate(value, locale, { dateStyle: 'medium', timeStyle: 'short' }) ?? fallback;
}

function formatAction(action: string): string {
  const spaced = action.replace(/[._]/g, ' ').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function formatValue(value: unknown, fallback: string, emptyValue: string): string {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') return value === '' ? emptyValue : value;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function emptyToUndefined(value: string): string | undefined {
  return value === '' ? undefined : value;
}

export default function AdminAuditLogsPage() {
  const { locale, t } = useI18n();
  const [logs, setLogs] = useState<AuditLogEntry[] | null>(null);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [actions, setActions] = useState<string[]>([]);
  const [entityTypes, setEntityTypes] = useState<string[]>([]);
  const [admins, setAdmins] = useState<AuditLogAdmin[]>([]);

  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [adminId, setAdminId] = useState<number | ''>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<LoadErrorState | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setLoadError(null);

      const response = await listAuditLogs({
        page,
        per_page: PER_PAGE,
        action: emptyToUndefined(action),
        entity_type: emptyToUndefined(entityType),
        admin_id: adminId,
        search: emptyToUndefined(search),
        from: emptyToUndefined(from),
        to: emptyToUndefined(to),
      });

      if (cancelled) return;

      if (response.success && response.data) {
        setLogs(response.data.audit_logs);
        setMeta(response.data.meta);
        setActions(response.data.actions);
        setEntityTypes(response.data.entity_types);
        setAdmins(response.data.admins);
      } else {
        setLoadError(describeLoadError(response, t('auditTrail'), t));
      }

      setIsLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [page, action, entityType, adminId, search, from, to, reloadToken]);

  const hasFilters =
    action !== '' || entityType !== '' || adminId !== '' || search !== '' || from !== '' || to !== '';

  const clearFilters = () => {
    setAction('');
    setEntityType('');
    setAdminId('');
    setSearchInput('');
    setSearch('');
    setFrom('');
    setTo('');
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
        title={t('auditTrail')}
        description={t('auditDescription')}
      />

      <div className="rounded-lg border border-rule bg-plate p-4">
        <form
          onSubmit={submitSearch}
          role="search"
          aria-label={t('filterAuditEntries')}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          <div>
            <label htmlFor="audit-action" className="block text-sm font-medium text-ink">
              {t('action')}
            </label>
            <select
              id="audit-action"
              value={action}
              onChange={(event) => {
                setAction(event.target.value);
                setPage(1);
              }}
              className={`${inputClass(false)} mt-1`}
            >
              <option value="">{t('allActions')}</option>
              {actions.map((option) => (
                <option key={option} value={option}>
                  {formatAction(option)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="audit-entity" className="block text-sm font-medium text-ink">
              {t('entity')}
            </label>
            <select
              id="audit-entity"
              value={entityType}
              onChange={(event) => {
                setEntityType(event.target.value);
                setPage(1);
              }}
              className={`${inputClass(false)} mt-1`}
            >
              <option value="">{t('allEntities')}</option>
              {entityTypes.map((option) => (
                <option key={option} value={option}>
                  {formatAction(option)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="audit-admin" className="block text-sm font-medium text-ink">
              {t('admin')}
            </label>
            <select
              id="audit-admin"
              value={adminId === '' ? '' : String(adminId)}
              onChange={(event) => {
                setAdminId(event.target.value === '' ? '' : Number(event.target.value));
                setPage(1);
              }}
              className={`${inputClass(false)} mt-1`}
            >
              <option value="">{t('allAdmins')}</option>
              {admins.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="audit-search" className="block text-sm font-medium text-ink">
              {t('searchAudit')}
            </label>
            <div className="mt-1 flex gap-2">
              <input
                id="audit-search"
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                maxLength={100}
                className={`${inputClass(false)} min-w-0 flex-1`}
                placeholder={t('auditSearchPlaceholder')}
              />
              <button type="submit" className={secondaryButtonClass}>
                {t('search')}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="audit-from" className="block text-sm font-medium text-ink">
              {t('from')}
            </label>
            <input
              id="audit-from"
              type="date"
              value={from}
              onChange={(event) => {
                setFrom(event.target.value);
                setPage(1);
              }}
              className={`${inputClass(false)} mt-1`}
            />
          </div>

          <div>
            <label htmlFor="audit-to" className="block text-sm font-medium text-ink">
              {t('to')}
            </label>
            <input
              id="audit-to"
              type="date"
              value={to}
              onChange={(event) => {
                setTo(event.target.value);
                setPage(1);
              }}
              className={`${inputClass(false)} mt-1`}
            />
          </div>

          <div className="flex items-end">
            <button type="button" onClick={clearFilters} className={secondaryButtonClass} disabled={!hasFilters}>
              {t('clearFilters')}
            </button>
          </div>
        </form>
      </div>

      {isLoading && logs === null ? <LoadingPanel label={t('loadingAuditTrail')} /> : null}

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

      {!isLoading && !loadError && logs !== null && logs.length === 0 ? (
        <EmptyState
          title={hasFilters ? t('noAuditEntriesMatch') : t('noAuditEntriesYet')}
          hint={hasFilters ? t('auditFilterHint') : t('auditEmptyHint')}
        />
      ) : null}

      {logs !== null && logs.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-rule bg-plate">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-rule text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">{t('when')}</th>
                  <th scope="col" className="px-4 py-3 font-medium">{t('action')}</th>
                  <th scope="col" className="px-4 py-3 font-medium">{t('entity')}</th>
                  <th scope="col" className="px-4 py-3 font-medium">{t('admin')}</th>
                  <th scope="col" className="px-4 py-3 font-medium">{t('ipAddress')}</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">{t('changes')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {logs.map((entry) => {
                  const fields = changedFields(entry);
                  const expanded = expandedId === entry.id;

                  return (
                    <tr key={entry.id} className="align-top">
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">
                        {formatWhen(entry.created_at, locale, t('noData'))}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-ink">{formatAction(entry.action)}</p>
                        <code className="text-xs text-gray-500">{entry.action}</code>
                      </td>
                      <td className="px-4 py-3 text-ink">
                        <p>{formatAction(entry.entity_type)}</p>
                        <p className="text-xs text-gray-500">#{entry.entity_id}</p>
                      </td>
                      <td className="px-4 py-3">
                        {entry.admin ? (
                          <>
                            <p className="text-ink">{entry.admin.name}</p>
                            <p className="text-xs text-gray-500">{entry.admin.email}</p>
                          </>
                        ) : (
                          <span className="text-xs text-gray-400">{t('system')}</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">
                        {entry.ip_address ?? t('noData')}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {fields.length > 0 || entry.old_data || entry.new_data ? (
                          <button
                            type="button"
                            onClick={() => setExpandedId(expanded ? null : entry.id)}
                            className={smallButtonClass}
                            aria-expanded={expanded}
                            aria-controls={`audit-changes-${entry.id}`}
                          >
                            {expanded ? t('hide') : fields.length > 0 ? t('showCount', { count: fields.length }) : t('showCount', { count: t('snapshot') })}
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">{t('noDataAvailable')}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {expandedId !== null ? (
            <AuditChanges
              entry={logs.find((entry) => entry.id === expandedId) ?? null}
              t={t}
            />
          ) : null}

          {meta ? <Pagination meta={meta} onPage={setPage} disabled={isLoading} /> : null}
        </div>
      ) : null}
    </div>
  );
}

/** The before/after snapshot for the expanded audit row. */
function AuditChanges({
  entry,
  t,
}: {
  entry: AuditLogEntry | null;
  t: ReturnType<typeof useI18n>['t'];
}) {
  if (entry === null) return null;

  const fields = changedFields(entry);

  return (
    <div id={`audit-changes-${entry.id}`} className="border-t border-rule bg-gray-50 px-4 py-4">
      <h2 className="text-sm font-semibold text-ink">
        {formatAction(entry.action)} · {formatAction(entry.entity_type)} #{entry.entity_id}
      </h2>

      {fields.length > 0 ? (
        <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {fields.map((field) => (
            <div key={field} className="rounded-md border border-rule bg-white p-2">
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{field}</dt>
              <dd className="mt-1 break-words text-xs text-gray-700">
                <span className="text-red-700 line-through">{formatValue(entry.old_data?.[field], t('noData'), t('emptyValue'))}</span>
                <span aria-hidden="true" className="px-1 text-gray-400">
                  →
                </span>
                <span className="text-green-700">{formatValue(entry.new_data?.[field], t('noData'), t('emptyValue'))}</span>
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-2 text-sm text-gray-600">{t('noFieldChanges')}</p>
      )}

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Snapshot label={t('oldData')} value={entry.old_data} fallback={t('noData')} />
        <Snapshot label={t('newData')} value={entry.new_data} fallback={t('noData')} />
      </div>
    </div>
  );
}

function Snapshot({
  label,
  value,
  fallback,
}: {
  label: string;
  value: Record<string, unknown> | null;
  fallback: string;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <pre className="mt-1 max-h-64 overflow-auto rounded-md border border-rule bg-white p-2 text-xs text-gray-700">
        {value === null ? fallback : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
