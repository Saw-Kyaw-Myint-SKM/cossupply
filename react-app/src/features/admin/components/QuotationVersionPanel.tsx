/**
 * Final quotation versions for one Admin request (Task 07).
 *
 * Source of truth for money is the server. This panel only previews the
 * snapshotted values returned with each version and exposes the draft edit,
 * send, PDF and email-resend operations allowed by the version status.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Alert,
  StatusBadge,
  primaryButtonClass,
  secondaryButtonClass,
  smallButtonClass,
} from '../../../components/catalog-ui/CatalogUi';
import { formatMMK } from '../../../lib/money';
import {
  downloadQuotationPdf,
  generateQuotationPdf,
  resendQuotationEmail,
  sendQuotation,
  type EmailLog,
  type QuotationVersion,
} from '../api/quotationAdminApi';
import { saveDownloadedFile } from '../lib/downloadFile';

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

interface QuotationVersionPanelProps {
  requestId: number;
  versions: QuotationVersion[];
  canCreateVersion: boolean;
  onChanged: () => void;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
}

export default function QuotationVersionPanel({
  requestId,
  versions,
  canCreateVersion,
  onChanged,
  onNotice,
  onError,
}: QuotationVersionPanelProps) {
  const [busy, setBusy] = useState<string | null>(null);

  const runDownload = async (version: QuotationVersion) => {
    setBusy(`${version.id}:download`);
    const result = await downloadQuotationPdf(version.id);
    setBusy(null);

    if (!result.success || !result.data) {
      onError(result.message ?? 'The quotation PDF could not be downloaded.');
      return;
    }

    saveDownloadedFile(result.data);
  };

  const runGeneratePdf = async (version: QuotationVersion) => {
    setBusy(`${version.id}:pdf`);
    const result = await generateQuotationPdf(version.id);
    setBusy(null);

    if (!result.success || !result.data) {
      onError(result.message ?? 'The quotation PDF could not be generated.');
      return;
    }

    onNotice(`PDF generated for version ${version.version}.`);
    onChanged();
  };

  const runSend = async (version: QuotationVersion) => {
    const confirmed = window.confirm(
      `Send version ${version.version} to ${version.quotation_number}’s customer? ` +
        'This creates the PDF, supersedes any current version, and emails the customer.',
    );
    if (!confirmed) return;

    setBusy(`${version.id}:send`);
    const result = await sendQuotation(version.id);
    setBusy(null);

    if (!result.success || !result.data) {
      onError(result.message ?? 'The quotation could not be sent.');
      return;
    }

    const email: EmailLog = result.data.email;
    onNotice(
      email.status === 'SENT'
        ? `Version ${version.version} sent to ${email.recipient_email}.`
        : `Version ${version.version} was sent, but the email failed. ` +
            'You can resend it from this panel.',
    );
    onChanged();
  };

  const runResend = async (version: QuotationVersion) => {
    setBusy(`${version.id}:resend`);
    const result = await resendQuotationEmail(version.id);
    setBusy(null);

    if (!result.success || !result.data) {
      onError(result.message ?? 'The quotation email could not be resent.');
      return;
    }

    onNotice(
      result.data.email.status === 'SENT'
        ? `Quotation email resent to ${result.data.email.recipient_email}.`
        : 'The resend attempt failed. Check the email settings and try again.',
    );
    onChanged();
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">Final quotations</h2>
          <p className="mt-1 text-sm text-gray-600">
            Sent versions are immutable. Create a new version to revise a quotation.
          </p>
        </div>
        {canCreateVersion ? (
          <Link
            to={`/admin/quotation-requests/${requestId}/versions/new`}
            className={primaryButtonClass}
          >
            Create new version
          </Link>
        ) : (
          <p className="text-sm text-gray-500">This request is closed for new versions.</p>
        )}
      </div>

      {versions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-rule bg-plate p-6 text-center">
          <p className="text-sm font-medium text-ink">No quotation version yet</p>
          <p className="mt-1 text-sm text-gray-500">
            Log supplier responses, then create a draft with confirmed prices.
          </p>
          {canCreateVersion ? (
            <Link
              to={`/admin/quotation-requests/${requestId}/versions/new`}
              className={`${primaryButtonClass} mt-4`}
            >
              Create first version
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          {versions.map((version) => {
            const isDraft = version.status === 'DRAFT';
            const latestPdf = version.pdfs[0] ?? null;

            return (
              <article
                key={version.id}
                className={`overflow-hidden rounded-lg border bg-plate ${
                  version.is_current ? 'border-accent ring-1 ring-accent' : 'border-rule'
                }`}
              >
                <header className="flex flex-wrap items-start justify-between gap-3 border-b border-rule bg-gray-50 px-4 py-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-ink">
                        Version {version.version}
                      </h3>
                      <StatusBadge status={version.status} />
                      {version.is_current ? (
                        <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800">
                          Current
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {version.quotation_number} · Created {formatDateTime(version.created_at)}
                      {version.created_by_admin ? ` by ${version.created_by_admin.name}` : ''}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {isDraft ? (
                      <>
                        <Link
                          to={`/admin/quotations/${version.id}/edit`}
                          className={secondaryButtonClass}
                        >
                          Edit draft
                        </Link>
                        {version.pdfs.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => void runDownload(version)}
                            disabled={busy === `${version.id}:download`}
                            className={secondaryButtonClass}
                          >
                            {busy === `${version.id}:download`
                              ? 'Downloading…'
                              : 'Download PDF'}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void runGeneratePdf(version)}
                          disabled={busy === `${version.id}:pdf`}
                          className={secondaryButtonClass}
                        >
                          {busy === `${version.id}:pdf` ? 'Generating…' : 'Generate PDF'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void runSend(version)}
                          disabled={busy === `${version.id}:send`}
                          className={primaryButtonClass}
                        >
                          {busy === `${version.id}:send` ? 'Sending…' : 'Send to customer'}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => void runDownload(version)}
                          disabled={busy === `${version.id}:download`}
                          className={secondaryButtonClass}
                        >
                          {busy === `${version.id}:download` ? 'Downloading…' : 'Download PDF'}
                        </button>
                        {version.sent_at ? (
                          <button
                            type="button"
                            onClick={() => void runResend(version)}
                            disabled={busy === `${version.id}:resend`}
                            className={primaryButtonClass}
                          >
                            {busy === `${version.id}:resend` ? 'Resending…' : 'Resend email'}
                          </button>
                        ) : null}
                      </>
                    )}
                  </div>
                </header>

                <div className="grid gap-3 border-b border-rule px-4 py-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
                  <div>
                    <p className="text-xs text-gray-500">Subtotal</p>
                    <p className="font-medium tabular-nums text-ink">{formatMMK(version.subtotal)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Discount</p>
                    <p className="font-medium tabular-nums text-ink">{formatMMK(version.discount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Delivery</p>
                    <p className="font-medium tabular-nums text-ink">
                      {formatMMK(version.delivery_fee)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">
                      Service fee ({version.service_fee_percentage}%)
                    </p>
                    <p className="font-medium tabular-nums text-ink">
                      {formatMMK(version.service_fee)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Total</p>
                    <p className="font-semibold tabular-nums text-ink">
                      {formatMMK(version.total_amount)} MMK
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Valid until</p>
                    <p className="font-medium text-ink">{formatDate(version.valid_until)}</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-rule text-sm">
                    <thead className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-4 py-2">Item</th>
                        <th className="px-4 py-2">Qty</th>
                        <th className="px-4 py-2">Unit price</th>
                        <th className="px-4 py-2">Discount</th>
                        <th className="px-4 py-2">Line total</th>
                        <th className="px-4 py-2">Delivery</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-rule">
                      {version.items.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-2">
                            <p className="font-medium text-ink">{item.product_name_snapshot}</p>
                            <p className="text-xs text-gray-500">
                              {[item.sku_snapshot, item.supplier?.shop_name]
                                .filter(Boolean)
                                .join(' · ') || '—'}
                            </p>
                            {item.supplier_note || item.warranty_note ? (
                              <p className="mt-1 text-xs text-gray-600">
                                {[item.supplier_note, item.warranty_note]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </p>
                            ) : null}
                          </td>
                          <td className="px-4 py-2 tabular-nums text-gray-700">{item.quantity}</td>
                          <td className="px-4 py-2 tabular-nums text-gray-700">
                            {formatMMK(item.unit_price)}
                          </td>
                          <td className="px-4 py-2 tabular-nums text-gray-700">
                            {formatMMK(item.discount)}
                          </td>
                          <td className="px-4 py-2 tabular-nums font-medium text-ink">
                            {formatMMK(item.line_total)}
                          </td>
                          <td className="px-4 py-2 text-gray-600">
                            {item.delivery_date ? formatDate(item.delivery_date) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="grid gap-4 border-t border-rule px-4 py-3 text-sm md:grid-cols-2">
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Terms
                    </h4>
                    <p className="mt-1 whitespace-pre-line text-gray-700">{version.payment_terms}</p>
                    <p className="mt-1 text-xs text-gray-500">{version.payment_method}</p>
                    {version.admin_note ? (
                      <p className="mt-2 whitespace-pre-line rounded bg-gray-50 px-3 py-2 text-gray-700">
                        {version.admin_note}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      PDF & email
                    </h4>
                    <p className="mt-1 text-xs text-gray-600">
                      {version.pdfs.length === 0
                        ? 'No PDF generated yet.'
                        : `${version.pdfs.length} PDF${
                            version.pdfs.length === 1 ? '' : 's'
                          } generated. Latest: ${latestPdf?.file_name ?? '—'}`}
                    </p>
                    {version.email_logs.length > 0 ? (
                      <ul className="mt-2 space-y-1">
                        {version.email_logs.map((email) => (
                          <li
                            key={email.id}
                            className="flex flex-wrap items-center gap-2 text-xs text-gray-600"
                          >
                            <span
                              className={`font-semibold ${
                                email.status === 'SENT' ? 'text-green-700' : 'text-red-700'
                              }`}
                            >
                              {email.status}
                            </span>
                            <span>{email.recipient_email}</span>
                            <span>{formatDateTime(email.sent_at ?? email.created_at)}</span>
                            {email.error_message ? (
                              <span className="w-full text-red-700">{email.error_message}</span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-xs text-gray-500">No email attempt recorded.</p>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {versions.length > 0 ? (
        <Alert tone="warning">
          To share through Viber or Telegram, download the PDF and attach it manually. CoSupply
          only sends the email version automatically.
        </Alert>
      ) : null}

      {versions.some((version) => version.status === 'DRAFT') ? (
        <p className="text-xs text-gray-500">
          Draft totals update only after saving. Sending always uses server-calculated values.
        </p>
      ) : null}

      <div className="flex gap-2">
        <Link to={`/admin/quotation-requests/${requestId}`} className={`${smallButtonClass}`}>
          Back to request
        </Link>
      </div>
    </section>
  );
}
