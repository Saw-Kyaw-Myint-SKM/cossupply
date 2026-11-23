import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  deleteAdminUser,
  listAdminUsers,
  type AdminUser,
  type AdminUserRole,
  type AdminUserStatus,
} from '../api/adminUsersApi';
import type { PaginationMeta } from '../../../api/query';
import {
  Alert,
  LoadingPanel,
  PageHeader,
  Pagination,
  StatusBadge,
  describeLoadError,
  describeRequestError,
  filterSelectClass,
  formatStatusLabel,
  inputClass,
  linkClass,
  primaryButtonClass,
  secondaryButtonClass,
  type LoadErrorState,
} from '../../../components/catalog-ui/CatalogUi';
import { TableActions } from '../../../components/ui/TableActions';
import { MobileRecordCard, MobileRecordList } from '../../../components/admin-ui/MobileRecordList';
import { useAuth } from '../../../lib/auth-context';

const PER_PAGE = 15;

type RoleFilter = '' | AdminUserRole;
type StatusFilter = '' | AdminUserStatus;
type SortOption = 'default' | 'created_at:desc' | 'created_at:asc';

const SORT_PARAMS: Record<
  SortOption,
  { sort_by?: 'created_at'; sort_direction?: 'asc' | 'desc' }
> = {
  default: {},
  'created_at:desc': { sort_by: 'created_at', sort_direction: 'desc' },
  'created_at:asc': { sort_by: 'created_at', sort_direction: 'asc' },
};

/**
 * Admin user list: search, role/status filters, pagination, edit links, and
 * delete with an inline confirmation step. Only super admins can open it —
 * the API returns 403 for everyone else.
 */
export default function AdminUserListPage() {
  const { admin: currentUser } = useAuth();

  const [adminUsers, setAdminUsers] = useState<AdminUser[] | null>(null);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<LoadErrorState | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<RoleFilter>('');
  const [status, setStatus] = useState<StatusFilter>('');
  const [sort, setSort] = useState<SortOption>('default');
  const [page, setPage] = useState(1);

  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setLoadError(null);

      const response = await listAdminUsers({
        page,
        per_page: PER_PAGE,
        search: search || undefined,
        role: role || undefined,
        status: status || undefined,
        ...SORT_PARAMS[sort],
      });

      if (cancelled) return;

      if (response.success && response.data) {
        setAdminUsers(response.data.admin_users);
        setMeta(response.data.meta);

        // After deleting the last row of a page the API returns an empty page;
        // step back to the last page that still has rows.
        if (
          response.data.admin_users.length === 0 &&
          page > 1 &&
          response.data.meta.last_page < page
        ) {
          setPage(Math.max(response.data.meta.last_page, 1));
        }
      } else {
        setLoadError(describeLoadError(response, 'admin users'));
      }

      setIsLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [page, search, role, status, sort, reloadToken]);

  const hasFilters = search !== '' || role !== '' || status !== '';

  const clearFilters = () => {
    setSearchInput('');
    setSearch('');
    setRole('');
    setStatus('');
    setSort('default');
    setPage(1);
    setActionError(null);
  };

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
    setSuccessMessage(null);
    setActionError(null);
  };

  const handleFilterChange = (key: 'role' | 'status', value: string) => {
    if (key === 'role') setRole(value as RoleFilter);
    else setStatus(value as StatusFilter);
    setPage(1);
    setSuccessMessage(null);
    setActionError(null);
  };

  const handleSortChange = (value: string) => {
    setSort(value as SortOption);
    setPage(1);
    setSuccessMessage(null);
    setActionError(null);
  };

  const handleDelete = async (adminUser: AdminUser) => {
    setActionError(null);
    setSuccessMessage(null);
    setIsDeleting(true);

    const response = await deleteAdminUser(adminUser.id);

    setIsDeleting(false);
    setConfirmingId(null);

    if (response.success) {
      setSuccessMessage(response.message ?? `Deleted “${adminUser.name}”.`);
      setReloadToken((token) => token + 1);
      return;
    }

    if (response.status === 404) {
      setActionError('That admin user no longer exists. The list has been refreshed.');
      setReloadToken((token) => token + 1);
      return;
    }

    if (response.status === 409) {
      setActionError(
        response.message ??
          'This admin user cannot be deleted. Set their status to inactive instead.',
      );
      return;
    }

    setActionError(describeRequestError(response, 'The admin user could not be deleted.'));
  };

  const header = (
    <PageHeader
      title="Admin users"
      description="Control who can sign in to the CoSupply admin panel, and which role they hold."
      action={
        <Link to="/admin/admin-users/new" className={primaryButtonClass}>
          New admin user
        </Link>
      }
    />
  );

  if (loadError && (loadError.needsLogin || adminUsers === null)) {
    return (
      <div className="space-y-6">
        {header}
        <div className="rounded-lg border border-red-200 bg-red-50 p-6" role="alert">
          <h2 className="text-lg font-semibold text-red-800">Admin users are unavailable</h2>
          <p className="mt-1 text-sm text-red-700">{loadError.message}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setReloadToken((token) => token + 1)}
              className={primaryButtonClass}
            >
              Try again
            </button>
            {loadError.needsLogin ? (
              <Link to="/admin/login" className={linkClass}>
                Go to admin login
              </Link>
            ) : (
              <Link to="/admin/dashboard" className={linkClass}>
                Back to dashboard
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isLoading && adminUsers === null) {
    return (
      <div className="space-y-6">
        {header}
        <LoadingPanel label="Loading admin users…" />
      </div>
    );
  }

  const renderAdminUserActions = (adminUser: AdminUser) => {
    const isCurrentUser = currentUser?.id === adminUser.id;

    return (
      <TableActions
        label={`Actions for ${adminUser.name}`}
        disabled={isDeleting}
        primary={
          <Link
            to={`/admin/admin-users/${adminUser.id}/edit`}
            className={linkClass}
            aria-label={`Edit ${adminUser.name}`}
          >
            Edit
          </Link>
        }
        groups={
          isCurrentUser
            ? []
            : [
                {
                  items: [
                    {
                      key: 'delete',
                      label: 'Delete',
                      tone: 'danger' as const,
                      disabled: isDeleting,
                      onSelect: () => {
                        setConfirmingId(adminUser.id);
                        setActionError(null);
                        setSuccessMessage(null);
                      },
                    },
                  ],
                },
              ]
        }
        confirm={
          confirmingId === adminUser.id
            ? {
                title: `Delete “${adminUser.name}”?`,
                description:
                  'Their sign-in stops working immediately. This cannot be undone.',
                confirmLabel: isDeleting ? 'Deleting…' : 'Confirm',
                cancelLabel: 'Cancel',
                busy: isDeleting,
                tone: 'danger' as const,
                onConfirm: () => void handleDelete(adminUser),
                onCancel: () => setConfirmingId(null),
              }
            : null
        }
      />
    );
  };

  return (
    <div className="space-y-6">
      {header}

      {successMessage ? (
        <Alert tone="success">
          <p className="text-sm font-medium">{successMessage}</p>
        </Alert>
      ) : null}

      {actionError ? (
        <Alert tone="error">
          <p className="text-sm font-medium">{actionError}</p>
        </Alert>
      ) : null}

      <section className="rounded-lg bg-white p-4 shadow sm:p-6">
        <form
          onSubmit={handleSearchSubmit}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:flex lg:flex-nowrap lg:items-end"
          role="search"
          aria-label="Filter admin users"
        >
          <div className="sm:col-span-2 lg:min-w-0 lg:max-w-md lg:flex-1">
            <label htmlFor="admin-user-search" className="block text-sm font-medium text-gray-700">
              Search
            </label>
            <div className="mt-1 flex gap-2">
              <input
                id="admin-user-search"
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Name, email, or phone"
                className={`${inputClass(false)} min-w-0 flex-1`}
              />
              <button type="submit" className={secondaryButtonClass}>
                Search
              </button>
            </div>
          </div>

          <div className="lg:shrink-0">
            <label
              htmlFor="admin-user-role-filter"
              className="block text-sm font-medium text-gray-700"
            >
              Role
            </label>
            <select
              id="admin-user-role-filter"
              value={role}
              onChange={(event) => handleFilterChange('role', event.target.value)}
              className={`${filterSelectClass} mt-1`}
            >
              <option value="">All roles</option>
              <option value="super_admin">Super admin</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div className="lg:shrink-0">
            <label
              htmlFor="admin-user-status-filter"
              className="block text-sm font-medium text-gray-700"
            >
              Status
            </label>
            <select
              id="admin-user-status-filter"
              value={status}
              onChange={(event) => handleFilterChange('status', event.target.value)}
              className={`${filterSelectClass} mt-1`}
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="lg:shrink-0">
            <label htmlFor="admin-user-sort" className="block text-sm font-medium text-gray-700">
              Sort by
            </label>
            <select
              id="admin-user-sort"
              value={sort}
              onChange={(event) => handleSortChange(event.target.value)}
              className={`${filterSelectClass} mt-1`}
            >
              <option value="default">Name (A–Z)</option>
              <option value="created_at:desc">Newest first</option>
              <option value="created_at:asc">Oldest first</option>
            </select>
          </div>
        </form>
      </section>

      <section
        className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm"
        aria-busy={isLoading || undefined}
      >
        {loadError ? (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-amber-800">{loadError.message}</p>
              <button
                type="button"
                onClick={() => setReloadToken((token) => token + 1)}
                className={secondaryButtonClass}
              >
                Try again
              </button>
            </div>
          </div>
        ) : null}

        {isLoading ? (
          <div
            className="flex items-center gap-2 border-b border-gray-100 px-4 py-2 text-sm text-gray-500"
            role="status"
          >
            <span
              className="h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600 motion-reduce:animate-none"
              aria-hidden="true"
            />
            Updating list…
          </div>
        ) : null}

        {adminUsers !== null && adminUsers.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <h2 className="text-base font-semibold text-gray-900">
              {hasFilters ? 'No admin users match your filters' : 'No admin users yet'}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {hasFilters
                ? 'Try a different search term or clear the filters.'
                : 'Create the first admin user to give someone access to this panel.'}
            </p>
            <div className="mt-4">
              {hasFilters ? (
                <button type="button" onClick={clearFilters} className={secondaryButtonClass}>
                  Clear filters
                </button>
              ) : (
                <Link to="/admin/admin-users/new" className={primaryButtonClass}>
                  New admin user
                </Link>
              )}
            </div>
          </div>
        ) : null}

        {adminUsers !== null && adminUsers.length > 0 ? (
          <>
            <div className="hidden lg:block">
              <div className="overflow-x-auto">
                <table className="admin-table min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                      Admin user
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                      Role
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                      Last login
                    </th>
                    <th
                      scope="col"
                      className="w-24 whitespace-nowrap px-4 py-3 text-right text-xs font-semibold text-gray-600"
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {adminUsers.map((adminUser) => {
                    const isCurrentUser = currentUser?.id === adminUser.id;

                    return (
                      <tr key={adminUser.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span
                              aria-hidden="true"
                              className="flex h-10 w-10 flex-none items-center justify-center rounded-md bg-gray-100 text-sm font-medium text-gray-400"
                            >
                              {adminUser.name.charAt(0).toUpperCase() || '#'}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-gray-900">
                                {adminUser.name}
                                {isCurrentUser ? (
                                  <span className="ml-2 text-xs font-normal text-gray-400">
                                    (you)
                                  </span>
                                ) : null}
                              </p>
                              <p className="truncate text-sm text-gray-500">{adminUser.email}</p>
                              {adminUser.phone ? (
                                <p className="truncate text-xs text-gray-400">{adminUser.phone}</p>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                          {formatStatusLabel(adminUser.role)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <StatusBadge status={adminUser.status.toUpperCase()} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                          {adminUser.last_login_at
                            ? new Date(adminUser.last_login_at).toLocaleDateString()
                            : 'Never'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right align-middle">
                          {renderAdminUserActions(adminUser)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </div>

            <MobileRecordList label="Admin users">
              {adminUsers.map((adminUser) => {
                const isCurrentUser = currentUser?.id === adminUser.id;
                return (
                  <MobileRecordCard
                    key={adminUser.id}
                    leading={
                      <span
                        aria-hidden="true"
                        className="flex h-10 w-10 items-center justify-center rounded-md bg-gray-100 text-sm font-medium text-gray-400"
                      >
                        {adminUser.name.charAt(0).toUpperCase() || '#'}
                      </span>
                    }
                    title={
                      <>
                        {adminUser.name}
                        {isCurrentUser ? (
                          <span className="ml-2 text-xs font-normal text-gray-400">(you)</span>
                        ) : null}
                      </>
                    }
                    subtitle={
                      <>
                        <span className="block">{adminUser.email}</span>
                        {adminUser.phone ? (
                          <span className="block text-gray-400">{adminUser.phone}</span>
                        ) : null}
                      </>
                    }
                    badges={<StatusBadge status={adminUser.status.toUpperCase()} />}
                    meta={[
                      { label: 'Role', value: formatStatusLabel(adminUser.role) },
                      {
                        label: 'Last login',
                        value: adminUser.last_login_at
                          ? new Date(adminUser.last_login_at).toLocaleDateString()
                          : 'Never',
                      },
                    ]}
                    footer={renderAdminUserActions(adminUser)}
                  />
                );
              })}
            </MobileRecordList>

            {meta ? (
              <Pagination meta={meta} onPage={setPage} disabled={isLoading || isDeleting} />
            ) : null}
          </>
        ) : null}
      </section>
    </div>
  );
}
