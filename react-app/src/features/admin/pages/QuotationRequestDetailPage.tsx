/**
 * Admin quotation request workspace (Task 07).
 *
 * One page for the request snapshot, assignment, workflow status, supplier
 * contact groups, and versioned final quotations. Mutations reload the
 * detail response so snapshots and server-calculated totals stay canonical.
 */
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
  Alert,
  LoadingPanel,
  PageHeader,
  StatusBadge,
  describeLoadError,
  formatStatusLabel,
  inputClass,
  linkClass,
  primaryButtonClass,
  secondaryButtonClass,
  smallButtonClass,
  type LoadErrorState,
} from '../../../components/catalog-ui/CatalogUi';
import { useAuth } from '../../../lib/auth-context';
import QuotationVersionPanel from '../components/QuotationVersionPanel';
import SupplierCommunicationPanel from '../components/SupplierCommunicationPanel';
import {
  assignQuotationRequest,
  getAdminQuotationRequest,
  updateQuotationRequestStatus,
  type QuotationRequestDetailResult,
  type QuotationRequestStatus,
} from '../api/quotationAdminApi';

const STATUS_ACTIONS: Partial<
  Record<
    QuotationRequestStatus,
    Array<{ status: QuotationRequestStatus; label: string; destructive?: boolean }>
  >
> = {
  NEW: [
    { status: 'CONTACTING_SUPPLIER', label: 'Start supplier contact' },
    { status: 'CANCELLED', label: 'Cancel request', destructive: true },
  ],
  CONTACTING_SUPPLIER: [
    { status: 'SUPPLIER_RESPONSE_PENDING', label: 'Awaiting responses' },
    { status: 'PREPARING_QUOTATION', label: 'Ready to prepare quote' },
    { status: 'CANCELLED', label: 'Cancel request', destructive: true },
  ],
  SUPPLIER_RESPONSE_PENDING: [
    { status: 'CONTACTING_SUPPLIER', label: 'Contacting again' },
    { status: 'PREPARING_QUOTATION', label: 'Ready to prepare quote' },
    { status: 'CANCELLED', label: 'Cancel request', destructive: true },
  ],
  PREPARING_QUOTATION: [
    { status: 'CANCELLED', label: 'Cancel request', destructive: true },
  ],
  QUOTATION_SENT: [
    { status: 'CUSTOMER_REVIEWING', label: 'Customer reviewing' },
    { status: 'ACCEPTED', label: 'Mark accepted' },
    { status: 'REJECTED', label: 'Mark rejected' },
    { status: 'EXPIRED', label: 'Mark expired' },
    { status: 'CANCELLED', label: 'Cancel request', destructive: true },
  ],
  CUSTOMER_REVIEWING: [
    { status: 'CHANGE_REQUESTED', label: 'Changes requested' },
    { status: 'ACCEPTED', label: 'Mark accepted' },
    { status: 'REJECTED', label: 'Mark rejected' },
    { status: 'EXPIRED', label: 'Mark expired' },
    { status: 'CANCELLED', label: 'Cancel request', destructive: true },
  ],
  CHANGE_REQUESTED: [
    { status: 'PREPARING_QUOTATION', label: 'Prepare revision' },
    { status: 'CANCELLED', label: 'Cancel request', destructive: true },
  ],
  EXPIRED: [{ status: 'PREPARING_QUOTATION', label: 'Prepare new version' }],
};

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function QuotationRequestDetailPage() {
  const { requestId } = useParams<{ requestId: string }>();
  const id = Number(requestId);
  const { admin } = useAuth();
  const location = useLocation();

  const [detail, setDetail] = useState<QuotationRequestDetailResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<LoadErrorState | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [assignmentId, setAssignmentId] = useState('');
  const [assignmentBusy, setAssignmentBusy] = useState(false);
  const [statusBusy, setStatusBusy] = useState<QuotationRequestStatus | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(() => {
    const state = location.state as { notice?: string } | null;
    return state?.notice ?? null;
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!Number.isInteger(id) || id <= 0) {
        setLoading(false);
        setLoadError({ message: 'That quotation request number is not valid.', needsLogin: false });
        return;
      }

      setLoading(true);
      setLoadError(null);
      const response = await getAdminQuotationRequest(id);

      if (cancelled) return;

      if (response.success && response.data) {
        setDetail(response.data);
        setAssignmentId(
          response.data.quotation_request.assigned_admin
            ? String(response.data.quotation_request.assigned_admin.id)
            : '',
        );
      } else {
        setDetail(null);
        setLoadError(describeLoadError(response, 'this quotation request'));
      }

      setLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [id, reloadToken]);

  const refresh = () => setReloadToken((token) => token + 1);

  const saveAssignment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!detail) return;

    setActionError(null);
    setNotice(null);
    setAssignmentBusy(true);
    const result = await assignQuotationRequest(
      detail.quotation_request.id,
      assignmentId === '' ? null : Number(assignmentId),
    );
    setAssignmentBusy(false);

    if (!result.success) {
      setActionError(result.message ?? 'The assignment could not be updated.');
      return;
    }

    setNotice('Request assignment updated.');
    refresh();
  };

  const changeStatus = async (
    nextStatus: QuotationRequestStatus,
    label: string,
    destructive = false,
  ) => {
    if (!detail) return;

    const confirmed = window.confirm(
      destructive
        ? `${label}? This changes the request to ${formatStatusLabel(nextStatus)}.`
        : `Move this request to ${formatStatusLabel(nextStatus)}?`,
    );
    if (!confirmed) return;

    setActionError(null);
    setNotice(null);
    setStatusBusy(nextStatus);
    const result = await updateQuotationRequestStatus(detail.quotation_request.id, nextStatus);
    setStatusBusy(null);

    if (!result.success) {
      setActionError(result.message ?? 'The request status could not be updated.');
      return;
    }

    setNotice(`Request moved to ${formatStatusLabel(nextStatus)}.`);
    refresh();
  };

  if (loading && !detail) {
    return <LoadingPanel label="Loading quotation request" />;
  }

  if (loadError || !detail) {
    return (
      <div className="space-y-4">
        <PageHeader title="Quotation request" />
        <Alert tone="error">
          <p>{loadError?.message ?? 'The quotation request could not be loaded.'}</p>
          {loadError?.needsLogin ? (
            <Link to="/admin/login" className={`${linkClass} mt-2`}>
              Sign in again
            </Link>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={refresh} className={secondaryButtonClass}>
                Try again
              </button>
              <Link to="/admin/quotations" className={secondaryButtonClass}>
                Back to queue
              </Link>
            </div>
          )}
        </Alert>
      </div>
    );
  }

  const request = detail.quotation_request;
  const statusActions = STATUS_ACTIONS[request.status] ?? [];
  const canCreateVersion = !['ACCEPTED', 'REJECTED', 'CANCELLED'].includes(request.status);
  const assignmentUnchanged =
    (request.assigned_admin?.id ?? null) === (assignmentId === '' ? null : Number(assignmentId));

  return (
    <div className="space-y-6">
      <PageHeader
        title={request.quotation_number}
        description={`Received ${formatDateTime(request.created_at)}${
          request.required_delivery_date
            ? ` · Required delivery ${formatDate(request.required_delivery_date)}`
            : ''
        }`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={request.status} />
            <Link to="/admin/quotations" className={secondaryButtonClass}>
              Back to queue
            </Link>
          </div>
        }
      />

      {notice ? <Alert tone="success">{notice}</Alert> : null}
      {actionError ? <Alert tone="error">{actionError}</Alert> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-lg border border-rule bg-plate p-4 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-ink">{request.customer_name}</h2>
              {request.company_name ? (
                <p className="text-sm text-gray-600">{request.company_name}</p>
              ) : null}
            </div>
            <p className="text-xs text-gray-500">
              {request.items.length} {request.items.length === 1 ? 'item' : 'items'} ·{' '}
              {request.suppliers.length}{' '}
              {request.suppliers.length === 1 ? 'supplier' : 'suppliers'}
            </p>
          </div>

          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Phone
              </dt>
              <dd className="mt-1 text-gray-800">{request.phone}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Email
              </dt>
              <dd className="mt-1 break-all text-gray-800">{request.email ?? '—'}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Delivery address
              </dt>
              <dd className="mt-1 whitespace-pre-line text-gray-800">
                {request.delivery_address}
                {request.city ? `, ${request.city}` : ''}
                {request.township ? `, ${request.township}` : ''}
                {request.landmark ? ` (near ${request.landmark})` : ''}
              </dd>
            </div>
            {request.customer_note ? (
              <div className="sm:col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Customer note
                </dt>
                <dd className="mt-1 whitespace-pre-line rounded bg-gray-50 px-3 py-2 text-gray-700">
                  {request.customer_note}
                </dd>
              </div>
            ) : null}
          </dl>
        </section>

        <div className="space-y-4">
          <section className="rounded-lg border border-rule bg-plate p-4">
            <h2 className="text-base font-semibold text-ink">Assignment</h2>
            <form onSubmit={saveAssignment} className="mt-3 space-y-3">
              <div>
                <label htmlFor="assigned-admin" className="block text-sm font-medium text-gray-900">
                  Responsible Admin
                </label>
                <select
                  id="assigned-admin"
                  value={assignmentId}
                  onChange={(event) => setAssignmentId(event.target.value)}
                  className={`${inputClass(false)} mt-1`}
                >
                  <option value="">Unassigned</option>
                  {detail.admins.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                      {admin?.id === option.id ? ' (you)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={assignmentBusy || assignmentUnchanged}
                  className={primaryButtonClass}
                >
                  {assignmentBusy ? 'Saving…' : 'Save assignment'}
                </button>
                {admin ? (
                  <button
                    type="button"
                    disabled={assignmentBusy || assignmentId === String(admin.id)}
                    onClick={() => setAssignmentId(String(admin.id))}
                    className={secondaryButtonClass}
                  >
                    Assign to me
                  </button>
                ) : null}
              </div>
            </form>
          </section>

          {statusActions.length > 0 ? (
            <section className="rounded-lg border border-rule bg-plate p-4">
              <h2 className="text-base font-semibold text-ink">Workflow status</h2>
              <p className="mt-1 text-xs text-gray-500">
                Current: {formatStatusLabel(request.status)}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {statusActions.map((action) => (
                  <button
                    key={action.status}
                    type="button"
                    disabled={statusBusy !== null}
                    onClick={() =>
                      void changeStatus(action.status, action.label, action.destructive)
                    }
                    className={
                      action.destructive ? `${smallButtonClass} text-red-700` : secondaryButtonClass
                    }
                  >
                    {statusBusy === action.status ? 'Updating…' : action.label}
                  </button>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">Supplier contact</h2>
          <p className="mt-1 text-sm text-gray-600">
            Request items are grouped by supplier. Every contact entry is append-only.
          </p>
        </div>

        {request.suppliers.length === 0 ? (
          <Alert tone="warning">No supplier group could be derived from this request.</Alert>
        ) : (
          request.suppliers.map((group) => (
            <SupplierCommunicationPanel
              key={group.supplier.id}
              requestId={request.id}
              group={group}
              onLogged={() => {
                setNotice('Supplier contact logged.');
                setActionError(null);
                refresh();
              }}
              onError={setActionError}
            />
          ))
        )}
      </section>

      <QuotationVersionPanel
        requestId={request.id}
        versions={request.quotations}
        canCreateVersion={canCreateVersion}
        onChanged={refresh}
        onNotice={(message) => {
          setNotice(message);
          setActionError(null);
        }}
        onError={setActionError}
      />
    </div>
  );
}
