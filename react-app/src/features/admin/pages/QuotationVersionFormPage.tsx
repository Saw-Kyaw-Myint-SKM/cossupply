/**
 * Create or edit a Final Quotation draft (Task 07).
 *
 * Lines come from the original customer request; the Admin adds confirmed
 * supplier pricing, discounts, delivery and notes. The server remains the
 * authority for every total and for the fee snapshot.
 */
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  LoadingPanel,
  PageHeader,
  describeLoadError,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
  smallButtonClass,
  type LoadErrorState,
} from '../../../components/catalog-ui/CatalogUi';
import { formatMMK } from '../../../lib/money';
import {
  createQuotationVersion,
  getAdminQuotationRequest,
  getQuotationVersion,
  updateQuotationVersion,
  type QuotationRequestDetailResult,
  type QuotationVersion,
  type QuotationVersionInput,
} from '../api/quotationAdminApi';
import {
  buildVersionPayload,
  createVersionFormState,
  editVersionFormState,
  localVersionError,
  previewTotals,
  type VersionFormState,
  type VersionLineState,
} from '../lib/quotationVersionForm';

interface FormContext {
  requestId: number;
  quotationNumber: string;
  customerName: string;
  serviceFeeDefault: number;
  validityDays: number;
}

export default function QuotationVersionFormPage() {
  const { requestId, quotationId } = useParams<{
    requestId?: string;
    quotationId?: string;
  }>();
  const editingId = quotationId ? Number(quotationId) : null;
  const navigate = useNavigate();

  const [form, setForm] = useState<VersionFormState | null>(null);
  const [context, setContext] = useState<FormContext | null>(null);
  const [editingQuotation, setEditingQuotation] = useState<QuotationVersion | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<LoadErrorState | null>(null);
  const [saving, setSaving] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setLoadError(null);

      if (editingId !== null) {
        if (!Number.isInteger(editingId) || editingId <= 0) {
          setLoading(false);
          setLoadError({ message: 'That quotation version number is not valid.', needsLogin: false });
          return;
        }

        const versionResponse = await getQuotationVersion(editingId);

        if (cancelled) return;

        if (!versionResponse.success || !versionResponse.data) {
          setLoading(false);
          setLoadError(describeLoadError(versionResponse, 'this quotation version'));
          return;
        }

        const quotation = versionResponse.data.quotation;
        setEditingQuotation(quotation);
        setForm(editVersionFormState(quotation));

        const requestResponse = await getAdminQuotationRequest(quotation.quotation_request_id);

        if (cancelled) return;

        setContext(
          requestResponse.success && requestResponse.data
            ? {
                requestId: quotation.quotation_request_id,
                quotationNumber: quotation.quotation_number,
                customerName: requestResponse.data.quotation_request.customer_name,
                serviceFeeDefault:
                  requestResponse.data.service_fee_default_percentage,
                validityDays: requestResponse.data.quotation_validity_days,
              }
            : {
                requestId: quotation.quotation_request_id,
                quotationNumber: quotation.quotation_number,
                customerName: 'Customer',
                serviceFeeDefault: quotation.service_fee_percentage,
                validityDays: 7,
              },
        );

        setLoading(false);
        return;
      }

      const numericRequestId = Number(requestId);

      if (!Number.isInteger(numericRequestId) || numericRequestId <= 0) {
        setLoading(false);
        setLoadError({ message: 'That quotation request number is not valid.', needsLogin: false });
        return;
      }

      const response = await getAdminQuotationRequest(numericRequestId);

      if (cancelled) return;

      if (!response.success || !response.data) {
        setLoading(false);
        setLoadError(describeLoadError(response, 'this quotation request'));
        return;
      }

      const requestData: QuotationRequestDetailResult = response.data;
      const nextForm = createVersionFormState(
        requestData.quotation_request,
        requestData.service_fee_default_percentage,
        requestData.quotation_validity_days,
      );
      nextForm.delivery_fee = String(requestData.default_delivery_fee);

      setForm(nextForm);
      setContext({
        requestId: requestData.quotation_request.id,
        quotationNumber: requestData.quotation_request.quotation_number,
        customerName: requestData.quotation_request.customer_name,
        serviceFeeDefault: requestData.service_fee_default_percentage,
        validityDays: requestData.quotation_validity_days,
      });
      setLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [editingId, requestId]);

  const updateForm = (patch: Partial<VersionFormState>) => {
    setForm((current) => (current ? { ...current, ...patch } : current));
  };

  const updateLine = (key: string, patch: Partial<VersionLineState>) => {
    setForm((current) =>
      current
        ? {
            ...current,
            items: current.items.map((item) =>
              item.key === key ? { ...item, ...patch } : item,
            ),
          }
        : current,
    );
  };

  const removeLine = (key: string) => {
    setForm((current) =>
      current
        ? { ...current, items: current.items.filter((item) => item.key !== key) }
        : current,
    );
  };

  const fieldError = (key: string): string | null => fieldErrors[key]?.[0] ?? null;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form || !context) return;

    setGeneralError(null);
    setFieldErrors({});

    const localError = localVersionError(form);
    if (localError) {
      setGeneralError(localError);
      return;
    }

    const payload: QuotationVersionInput = buildVersionPayload(form);
    setSaving(true);

    const response =
      editingId !== null
        ? await updateQuotationVersion(editingId, payload)
        : await createQuotationVersion(context.requestId, payload);

    setSaving(false);

    if (!response.success) {
      setFieldErrors(response.errors ?? {});
      setGeneralError(
        response.errors
          ? null
          : response.message ?? 'The quotation draft could not be saved.',
      );
      return;
    }

    navigate(`/admin/quotation-requests/${context.requestId}`, {
      state: {
        notice:
          editingId !== null
            ? `Draft version ${editingQuotation?.version ?? ''} updated.`
            : 'Quotation draft created.',
      },
    });
  };

  if (loading) {
    return <LoadingPanel label="Loading quotation draft" />;
  }

  if (loadError || !form || !context) {
    return (
      <div className="space-y-4">
        <PageHeader title="Quotation draft" />
        <Alert tone="error">
          <p>{loadError?.message ?? 'The quotation draft could not be loaded.'}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {loadError?.needsLogin ? (
              <Link to="/admin/login" className={secondaryButtonClass}>
                Sign in again
              </Link>
            ) : null}
            {requestId ? (
              <Link to={`/admin/quotation-requests/${requestId}`} className={secondaryButtonClass}>
                Back to request
              </Link>
            ) : (
              <Link to="/admin/quotations" className={secondaryButtonClass}>
                Back to queue
              </Link>
            )}
          </div>
        </Alert>
      </div>
    );
  }

  if (editingQuotation && editingQuotation.status !== 'DRAFT') {
    return (
      <div className="space-y-4">
        <PageHeader title={`Version ${editingQuotation.version}`} />
        <Alert tone="warning">
          Sent and historical quotation versions are immutable. Create a new version to make
          changes.
        </Alert>
        <Link
          to={`/admin/quotation-requests/${context.requestId}`}
          className={secondaryButtonClass}
        >
          Back to request
        </Link>
      </div>
    );
  }

  const totals = previewTotals(form);

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          editingId !== null
            ? `Edit draft version ${editingQuotation?.version ?? ''}`
            : 'New quotation version'
        }
        description={`${context.quotationNumber} · ${context.customerName}`}
        action={
          <Link
            to={`/admin/quotation-requests/${context.requestId}`}
            className={secondaryButtonClass}
          >
            Cancel
          </Link>
        }
      />

      {generalError ? <Alert tone="error">{generalError}</Alert> : null}

      {Object.keys(fieldErrors).length > 0 ? (
        <Alert tone="error">
          <p>Please correct the highlighted fields and save again.</p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            {Object.entries(fieldErrors).map(([key, messages]) =>
              messages.map((message, index) => (
                <li key={`${key}-${index}`}>
                  <span className="font-medium">{key}:</span> {message}
                </li>
              )),
            )}
          </ul>
        </Alert>
      ) : null}

      <form onSubmit={submit} className="space-y-6">
        <section className="overflow-hidden rounded-lg border border-rule bg-plate">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-rule bg-gray-50 px-4 py-3">
            <div>
              <h2 className="text-base font-semibold text-ink">Confirmed quotation lines</h2>
              <p className="mt-1 text-xs text-gray-600">
                Items come from the customer request. Remove a line only if the supplier cannot
                fulfil it.
              </p>
            </div>
            <p className="text-xs text-gray-500">
              {form.items.length} {form.items.length === 1 ? 'line' : 'lines'}
            </p>
          </div>

          {form.items.length === 0 ? (
            <div className="p-6">
              <Alert tone="warning">
                No quotation lines remain. Reload this page to restore the request items.
              </Alert>
            </div>
          ) : (
            <div className="divide-y divide-rule">
              {form.items.map((item, index) => (
                <div key={item.key} className="space-y-4 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-ink">{item.product_name}</h3>
                      <p className="mt-1 text-xs text-gray-500">
                        {[item.sku, item.supplier_name, item.specification]
                          .filter(Boolean)
                          .join(' · ') || 'No item metadata'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLine(item.key)}
                      className={`${smallButtonClass} text-red-700`}
                    >
                      Remove line
                    </button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <label
                        htmlFor={`quantity-${item.key}`}
                        className="block text-sm font-medium text-gray-900"
                      >
                        Quantity
                      </label>
                      <input
                        id={`quantity-${item.key}`}
                        type="number"
                        min={1}
                        step={1}
                        value={item.quantity}
                        onChange={(event) =>
                          updateLine(item.key, { quantity: event.target.value })
                        }
                        className={`${inputClass(Boolean(fieldError(`items.${index}.quantity`)))} mt-1`}
                      />
                      {fieldError(`items.${index}.quantity`) ? (
                        <p className="mt-1 text-sm text-red-600">
                          {fieldError(`items.${index}.quantity`)}
                        </p>
                      ) : null}
                    </div>

                    <div>
                      <label
                        htmlFor={`unit-price-${item.key}`}
                        className="block text-sm font-medium text-gray-900"
                      >
                        Confirmed unit price (MMK)
                      </label>
                      <input
                        id={`unit-price-${item.key}`}
                        type="number"
                        min={1}
                        step={1}
                        value={item.unit_price}
                        onChange={(event) =>
                          updateLine(item.key, { unit_price: event.target.value })
                        }
                        className={`${inputClass(Boolean(fieldError(`items.${index}.unit_price`)))} mt-1`}
                      />
                      {fieldError(`items.${index}.unit_price`) ? (
                        <p className="mt-1 text-sm text-red-600">
                          {fieldError(`items.${index}.unit_price`)}
                        </p>
                      ) : null}
                    </div>

                    <div>
                      <label
                        htmlFor={`line-discount-${item.key}`}
                        className="block text-sm font-medium text-gray-900"
                      >
                        Line discount (MMK)
                      </label>
                      <input
                        id={`line-discount-${item.key}`}
                        type="number"
                        min={0}
                        step={1}
                        value={item.discount}
                        onChange={(event) =>
                          updateLine(item.key, { discount: event.target.value })
                        }
                        className={`${inputClass(Boolean(fieldError(`items.${index}.discount`)))} mt-1`}
                      />
                      {fieldError(`items.${index}.discount`) ? (
                        <p className="mt-1 text-sm text-red-600">
                          {fieldError(`items.${index}.discount`)}
                        </p>
                      ) : null}
                    </div>

                    <div>
                      <label
                        htmlFor={`line-total-${item.key}`}
                        className="block text-sm font-medium text-gray-900"
                      >
                        Line total
                      </label>
                      <p
                        id={`line-total-${item.key}`}
                        className="mt-2 text-base font-semibold tabular-nums text-ink"
                      >
                        {formatMMK(totals.lineTotals[index] ?? 0)} MMK
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <label
                        htmlFor={`delivery-date-${item.key}`}
                        className="block text-sm font-medium text-gray-900"
                      >
                        Supplier delivery date
                      </label>
                      <input
                        id={`delivery-date-${item.key}`}
                        type="date"
                        value={item.delivery_date}
                        onChange={(event) =>
                          updateLine(item.key, { delivery_date: event.target.value })
                        }
                        className={`${inputClass(Boolean(fieldError(`items.${index}.delivery_date`)))} mt-1`}
                      />
                      {fieldError(`items.${index}.delivery_date`) ? (
                        <p className="mt-1 text-sm text-red-600">
                          {fieldError(`items.${index}.delivery_date`)}
                        </p>
                      ) : null}
                    </div>

                    <div>
                      <label
                        htmlFor={`warranty-${item.key}`}
                        className="block text-sm font-medium text-gray-900"
                      >
                        Warranty note
                      </label>
                      <input
                        id={`warranty-${item.key}`}
                        type="text"
                        maxLength={1000}
                        value={item.warranty_note}
                        onChange={(event) =>
                          updateLine(item.key, { warranty_note: event.target.value })
                        }
                        className={`${inputClass(false)} mt-1`}
                      />
                    </div>

                    <div>
                      <label
                        htmlFor={`supplier-note-${item.key}`}
                        className="block text-sm font-medium text-gray-900"
                      >
                        Supplier note
                      </label>
                      <input
                        id={`supplier-note-${item.key}`}
                        type="text"
                        maxLength={1000}
                        value={item.supplier_note}
                        onChange={(event) =>
                          updateLine(item.key, { supplier_note: event.target.value })
                        }
                        className={`${inputClass(false)} mt-1`}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="grid gap-4 lg:grid-cols-3">
          <section className="space-y-4 rounded-lg border border-rule bg-plate p-4 lg:col-span-2">
            <h2 className="text-base font-semibold text-ink">Quotation terms</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="service-fee"
                  className="block text-sm font-medium text-gray-900"
                >
                  Service fee percentage
                </label>
                <p className="text-xs text-gray-500">
                  Master Setting default: {context.serviceFeeDefault}%. You can override it for
                  this version.
                </p>
                <input
                  id="service-fee"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={form.service_fee_percentage}
                  onChange={(event) =>
                    updateForm({ service_fee_percentage: event.target.value })
                  }
                  className={`${inputClass(Boolean(fieldError('service_fee_percentage')))} mt-1`}
                />
                {fieldError('service_fee_percentage') ? (
                  <p className="mt-1 text-sm text-red-600">
                    {fieldError('service_fee_percentage')}
                  </p>
                ) : null}
              </div>

              <div>
                <label
                  htmlFor="valid-until"
                  className="block text-sm font-medium text-gray-900"
                >
                  Valid until
                </label>
                <p className="text-xs text-gray-500">
                  Default validity: {context.validityDays} days.
                </p>
                <input
                  id="valid-until"
                  type="date"
                  value={form.valid_until}
                  onChange={(event) => updateForm({ valid_until: event.target.value })}
                  className={`${inputClass(Boolean(fieldError('valid_until')))} mt-1`}
                />
                {fieldError('valid_until') ? (
                  <p className="mt-1 text-sm text-red-600">{fieldError('valid_until')}</p>
                ) : null}
              </div>

              <div>
                <label
                  htmlFor="quotation-discount"
                  className="block text-sm font-medium text-gray-900"
                >
                  Quotation discount (MMK)
                </label>
                <input
                  id="quotation-discount"
                  type="number"
                  min={0}
                  step={1}
                  value={form.discount}
                  onChange={(event) => updateForm({ discount: event.target.value })}
                  className={`${inputClass(Boolean(fieldError('discount')))} mt-1`}
                />
                {fieldError('discount') ? (
                  <p className="mt-1 text-sm text-red-600">{fieldError('discount')}</p>
                ) : null}
              </div>

              <div>
                <label
                  htmlFor="delivery-fee"
                  className="block text-sm font-medium text-gray-900"
                >
                  Delivery fee (MMK)
                </label>
                <input
                  id="delivery-fee"
                  type="number"
                  min={0}
                  step={1}
                  value={form.delivery_fee}
                  onChange={(event) => updateForm({ delivery_fee: event.target.value })}
                  className={`${inputClass(Boolean(fieldError('delivery_fee')))} mt-1`}
                />
                {fieldError('delivery_fee') ? (
                  <p className="mt-1 text-sm text-red-600">{fieldError('delivery_fee')}</p>
                ) : null}
              </div>
            </div>

            <div>
              <label
                htmlFor="payment-terms"
                className="block text-sm font-medium text-gray-900"
              >
                Payment terms
              </label>
              <textarea
                id="payment-terms"
                rows={2}
                maxLength={1000}
                value={form.payment_terms}
                onChange={(event) => updateForm({ payment_terms: event.target.value })}
                className={`${inputClass(Boolean(fieldError('payment_terms')))} mt-1`}
              />
              {fieldError('payment_terms') ? (
                <p className="mt-1 text-sm text-red-600">{fieldError('payment_terms')}</p>
              ) : null}
              <p className="mt-1 text-xs text-gray-500">
                Payment method is fixed to Cash on Delivery.
              </p>
            </div>

            <div>
              <label
                htmlFor="admin-note"
                className="block text-sm font-medium text-gray-900"
              >
                Note to customer <span className="font-normal text-gray-500">(optional)</span>
              </label>
              <textarea
                id="admin-note"
                rows={3}
                maxLength={2000}
                value={form.admin_note}
                onChange={(event) => updateForm({ admin_note: event.target.value })}
                className={`${inputClass(Boolean(fieldError('admin_note')))} mt-1`}
                placeholder="Included in the PDF and email."
              />
              {fieldError('admin_note') ? (
                <p className="mt-1 text-sm text-red-600">{fieldError('admin_note')}</p>
              ) : null}
            </div>
          </section>

          <aside className="space-y-4">
            <section className="rounded-lg border border-rule bg-plate p-4">
              <h2 className="text-base font-semibold text-ink">Totals preview</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-600">Subtotal</dt>
                  <dd className="tabular-nums text-ink">{formatMMK(totals.subtotal)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-600">Discount</dt>
                  <dd className="tabular-nums text-ink">−{formatMMK(Number(form.discount) || 0)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-600">Delivery fee</dt>
                  <dd className="tabular-nums text-ink">
                    {formatMMK(Number(form.delivery_fee) || 0)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-600">
                    Service fee ({Number(form.service_fee_percentage) || 0}%)
                  </dt>
                  <dd className="tabular-nums text-ink">{formatMMK(totals.service_fee)}</dd>
                </div>
                <div className="flex justify-between gap-3 border-t border-rule pt-2 text-base font-semibold">
                  <dt className="text-ink">Total</dt>
                  <dd className="tabular-nums text-ink">{formatMMK(totals.total_amount)} MMK</dd>
                </div>
              </dl>
              <p className="mt-3 text-xs text-gray-500">
                Preview only. Saving recalculates these values on the server.
              </p>
            </section>

            <section className="rounded-lg border border-rule bg-plate p-4">
              <h2 className="text-base font-semibold text-ink">Save draft</h2>
              <p className="mt-1 text-xs text-gray-500">
                Drafts can be edited until sent. Sending locks the version and emails the
                customer.
              </p>
              <button
                type="submit"
                disabled={saving || form.items.length === 0}
                className={`${primaryButtonClass} mt-3 w-full`}
              >
                {saving ? 'Saving…' : editingId !== null ? 'Save draft changes' : 'Create draft'}
              </button>
              <Link
                to={`/admin/quotation-requests/${context.requestId}`}
                className={`${secondaryButtonClass} mt-2 w-full`}
              >
                Back to request
              </Link>
            </section>
          </aside>
        </div>
      </form>
    </div>
  );
}
