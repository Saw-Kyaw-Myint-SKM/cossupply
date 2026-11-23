import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { FiEdit2, FiPlus, FiTrash2 } from 'react-icons/fi';
import {
  deleteBanner,
  listBanners,
  type Banner,
  type BannerStatus,
} from '../api/bannersApi';
import type { PaginationMeta } from '../api/catalogApiUtils';
import {
  Alert,
  EmptyState,
  LoadingPanel,
  PageHeader,
  Pagination,
  StatusBadge,
  describeLoadError,
  describeRequestError,
  filterSelectClass,
  inputClass,
  linkClass,
  primaryButtonClass,
  secondaryButtonClass,
  smallButtonClass,
  type LoadErrorState,
} from '../../../components/catalog-ui/CatalogUi';
import { TableActions } from '../../../components/ui/TableActions';
import { getBannerTheme } from '../../../lib/banner-themes';

const PER_PAGE = 15;

type StatusFilter = '' | BannerStatus;

function bannerLabel(banner: Banner): string {
  return banner.title_en || banner.title_mm;
}

function formatUpdated(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('en-US', { dateStyle: 'medium' });
}

/**
 * Admin banner list: search, status filter, pagination, edit links, and
 * delete with an anchored confirmation step.
 */
export default function BannerListPage() {
  const [banners, setBanners] = useState<Banner[] | null>(null);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<LoadErrorState | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('');
  const [page, setPage] = useState(1);

  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setLoadError(null);

      const response = await listBanners({
        page,
        per_page: PER_PAGE,
        search: search || undefined,
        status: status || undefined,
      });

      if (cancelled) return;

      if (response.success && response.data) {
        setBanners(response.data.banners);
        setMeta(response.data.meta);

        // After deleting the last row of a page the API returns an empty page;
        // step back to the last page that still has rows.
        if (
          response.data.banners.length === 0 &&
          page > 1 &&
          response.data.meta.last_page < page
        ) {
          setPage(Math.max(response.data.meta.last_page, 1));
        }
      } else {
        setLoadError(describeLoadError(response, 'banners'));
      }

      setIsLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [page, search, status, reloadToken]);

  const hasFilters = search !== '' || status !== '';

  const clearFilters = () => {
    setSearchInput('');
    setSearch('');
    setStatus('');
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

  const handleStatusChange = (value: string) => {
    setStatus(value as StatusFilter);
    setPage(1);
    setSuccessMessage(null);
    setActionError(null);
  };

  const handleDelete = async (banner: Banner) => {
    setActionError(null);
    setSuccessMessage(null);
    setIsDeleting(true);

    const response = await deleteBanner(banner.id);

    setIsDeleting(false);
    setConfirmingId(null);

    if (response.success) {
      setSuccessMessage(`Deleted “${bannerLabel(banner)}”.`);
      setReloadToken((token) => token + 1);
      return;
    }

    if (response.status === 404) {
      setActionError('That banner no longer exists. The list has been refreshed.');
      setReloadToken((token) => token + 1);
      return;
    }

    setActionError(describeRequestError(response, 'The banner could not be deleted.'));
  };

  const header = (
    <PageHeader
      title="Banners"
      description="Manage the hero slides shown on the home page."
      action={
        <Link to="/admin/banners/new" className={primaryButtonClass}>
          <FiPlus aria-hidden="true" className="mr-1.5 h-4 w-4" />
          New banner
        </Link>
      }
    />
  );

  if (loadError && (loadError.needsLogin || banners === null)) {
    return (
      <div className="space-y-6">
        {header}
        <div className="rounded-lg border border-red-200 bg-red-50 p-6" role="alert">
          <h2 className="text-lg font-semibold text-red-800">Banners are unavailable</h2>
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
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  if (isLoading && banners === null) {
    return (
      <div className="space-y-6">
        {header}
        <LoadingPanel label="Loading banners…" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

      {successMessage ? (
        <Alert tone="success" className="bg-white">
          {successMessage}
        </Alert>
      ) : null}

      {actionError ? <Alert tone="error">{actionError}</Alert> : null}

      <form
        onSubmit={handleSearchSubmit}
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-line/60 bg-white p-4 shadow-sm"
        role="search"
        aria-label="Filter banners"
      >
        <div className="min-w-52 flex-1">
          <label htmlFor="banner-search" className="block text-xs font-medium text-gray-500">
            Search
          </label>
          <input
            id="banner-search"
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Title (Burmese or English)"
            className={`${inputClass(false)} mt-1`}
          />
        </div>

        <div>
          <label htmlFor="banner-status" className="block text-xs font-medium text-gray-500">
            Status
          </label>
          <select
            id="banner-status"
            value={status}
            onChange={(event) => handleStatusChange(event.target.value)}
            className={`${filterSelectClass} mt-1`}
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>

        <button type="submit" className={secondaryButtonClass}>
          Search
        </button>

        {hasFilters ? (
          <button type="button" onClick={clearFilters} className={linkClass}>
            Clear filters
          </button>
        ) : null}
      </form>

      {!isLoading && !loadError && banners !== null && banners.length === 0 ? (
        <EmptyState
          title={hasFilters ? 'No banners match your filters' : 'No banners yet'}
          hint={
            hasFilters
              ? 'Try a different search term or clear the filters.'
              : 'Add the first banner to control the home-page hero.'
          }
        />
      ) : null}

      {banners !== null && banners.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-line/60 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Banner</th>
                  <th scope="col">Order</th>
                  <th scope="col">Status</th>
                  <th scope="col">Theme</th>
                  <th scope="col">Updated</th>
                  <th scope="col" className="text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {banners.map((banner) => {
                  const label = bannerLabel(banner);
                  const isConfirming = confirmingId === banner.id;
                  const theme = getBannerTheme(banner.background_style);

                  return (
                    <tr key={banner.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 flex-none overflow-hidden rounded-lg bg-paper ring-1 ring-line/60">
                            {banner.image_url ? (
                              <img
                                src={banner.image_url}
                                alt=""
                                loading="lazy"
                                decoding="async"
                                className="h-full w-full object-cover"
                              />
                            ) : null}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-ink">
                              {banner.title_en}
                            </p>
                            <p className="truncate text-xs text-muted">{banner.title_mm}</p>
                          </div>
                        </div>
                      </td>
                      <td className="text-sm text-muted">{banner.sort_order}</td>
                      <td>
                        <StatusBadge status={banner.status} />
                      </td>
                      <td>
                        <span className="inline-flex items-center gap-2 text-sm text-muted">
                          <span
                            aria-hidden="true"
                            className="h-3.5 w-3.5 flex-none rounded-full ring-1 ring-black/10"
                            style={{ backgroundImage: theme.background }}
                          />
                          {theme.label}
                        </span>
                      </td>
                      <td className="text-sm text-muted">{formatUpdated(banner.updated_at)}</td>
                      <td>
                        <TableActions
                          label={`Actions for ${label}`}
                          primary={
                            <Link
                              to={`/admin/banners/${banner.id}/edit`}
                              className={smallButtonClass}
                              aria-label={`Edit ${label}`}
                            >
                              <FiEdit2 aria-hidden="true" className="h-3.5 w-3.5" />
                              Edit
                            </Link>
                          }
                          groups={[
                            {
                              items: [
                                {
                                  key: 'delete',
                                  label: 'Delete',
                                  icon: <FiTrash2 />,
                                  tone: 'danger',
                                  onSelect: () => setConfirmingId(banner.id),
                                },
                              ],
                            },
                          ]}
                          confirm={
                            isConfirming
                              ? {
                                  title: `Delete “${label}”?`,
                                  description:
                                    'This removes the slide and its image from the home page.',
                                  confirmLabel: isDeleting ? 'Deleting…' : 'Delete',
                                  cancelLabel: 'Cancel',
                                  busy: isDeleting,
                                  tone: 'danger',
                                  onConfirm: () => void handleDelete(banner),
                                  onCancel: () => setConfirmingId(null),
                                }
                              : null
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {meta ? <Pagination meta={meta} onPage={setPage} disabled={isLoading} /> : null}
        </div>
      ) : null}
    </div>
  );
}
