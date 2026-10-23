/**
 * One supplier group inside an Admin quotation request (Task 07).
 *
 * Shows the request items that belong to the supplier, the append-only
 * contact log, and the manual Viber/phone/email logging form. Confirmed
 * price, stock and delivery details are captured as free-text supplier
 * responses here and become structured values in the version builder.
 */
import { useState, type FormEvent } from 'react';
import {
  Alert,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
  smallButtonClass,
} from '../../../components/catalog-ui/CatalogUi';
import { formatMMK } from '../../../lib/money';
import {
  createSupplierCommunication,
  downloadAdminPrivateFile,
  type SupplierCommunication,
  type SupplierContactMethod,
  type SupplierGroup,
} from '../api/quotationAdminApi';
import { saveDownloadedFile } from '../lib/downloadFile';

const CONTACT_METHODS: Array<{ value: SupplierContactMethod; label: string }> = [
  { value: 'VIBER', label: 'Viber' },
  { value: 'PHONE', label: 'Phone' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'TELEGRAM', label: 'Telegram' },
  { value: 'OTHER', label: 'Other' },
];

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function formatMethod(value: string): string {
  return CONTACT_METHODS.find((method) => method.value === value)?.label ?? value;
}

interface SupplierCommunicationPanelProps {
  requestId: number;
  group: SupplierGroup;
  onLogged: () => void;
  onError: (message: string) => void;
}

export default function SupplierCommunicationPanel({
  requestId,
  group,
  onLogged,
  onError,
}: SupplierCommunicationPanelProps) {
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<SupplierContactMethod>('VIBER');
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const supplier = group.supplier;
  const contactBits = [
    supplier.contact_person,
    supplier.phone,
    supplier.viber_phone ? `Viber ${supplier.viber_phone}` : null,
    supplier.email,
  ].filter(Boolean);

  const resetForm = () => {
    setMethod('VIBER');
    setMessage('');
    setResponse('');
    setAttachment(null);
    setFormError(null);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    if (message.trim() === '' && response.trim() === '') {
      setFormError('Add the message sent or the supplier response.');
      return;
    }

    setSubmitting(true);
    const result = await createSupplierCommunication(requestId, {
      supplier_id: supplier.id,
      contact_method: method,
      message_text: message,
      supplier_response: response,
      attachment,
    });
    setSubmitting(false);

    if (!result.success) {
      setFormError(result.message ?? 'The supplier contact could not be saved.');
      return;
    }

    resetForm();
    setOpen(false);
    onLogged();
  };

  const downloadAttachment = async (communication: SupplierCommunication) => {
    if (!communication.attachment_path) return;

    setDownloadingId(communication.id);
    const fileName =
      communication.attachment_path.split('/').pop() ?? `communication-${communication.id}`;
    const result = await downloadAdminPrivateFile(communication.attachment_path, fileName);
    setDownloadingId(null);

    if (!result.success || !result.data) {
      onError(result.message ?? 'The attachment could not be downloaded.');
      return;
    }

    saveDownloadedFile(result.data);
  };

  return (
    <section className="overflow-hidden rounded-lg border border-rule bg-plate">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-rule bg-gray-50 px-4 py-3">
        <div>
          <h2 className="text-base font-semibold text-ink">
            {supplier.shop_name ?? `Supplier #${supplier.id}`}
          </h2>
          <p className="mt-1 text-xs text-gray-600">
            {contactBits.length > 0 ? contactBits.join(' · ') : 'No supplier contact details on file'}
          </p>
          {supplier.delivery_time || supplier.warranty_policy ? (
            <p className="mt-1 text-xs text-gray-500">
              {[supplier.delivery_time, supplier.warranty_policy].filter(Boolean).join(' · ')}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-gray-600 ring-1 ring-rule">
            {group.items.length} {group.items.length === 1 ? 'item' : 'items'}
          </span>
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={() => {
              setOpen((value) => !value);
              setFormError(null);
            }}
          >
            {open ? 'Close log form' : 'Log contact'}
          </button>
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-rule text-sm">
          <thead className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-2">Requested item</th>
              <th className="px-4 py-2">Qty</th>
              <th className="px-4 py-2">Display price</th>
              <th className="px-4 py-2">Stock snapshot</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {group.items.map((item) => (
              <tr key={`${supplier.id}-${item.product_id}`}>
                <td className="px-4 py-2">
                  <p className="font-medium text-ink">{item.product_name_snapshot}</p>
                  <p className="text-xs text-gray-500">
                    {[item.sku, item.specification_snapshot].filter(Boolean).join(' · ') || 'No SKU'}
                  </p>
                </td>
                <td className="px-4 py-2 tabular-nums text-gray-700">{item.quantity}</td>
                <td className="px-4 py-2 tabular-nums text-gray-700">
                  {item.display_price !== null ? formatMMK(item.display_price) : 'Confirm'}
                </td>
                <td className="px-4 py-2 text-gray-600">{item.stock_status ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t border-rule px-4 py-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Contact history
        </h3>
        {group.communications.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No supplier contact has been logged yet.</p>
        ) : (
          <ol className="mt-2 space-y-3">
            {group.communications.map((communication) => (
              <li key={communication.id} className="rounded-md border border-rule bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-ink">
                    {formatMethod(communication.contact_method)}
                    {communication.admin ? (
                      <span className="font-normal text-gray-500"> · {communication.admin.name}</span>
                    ) : null}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatDateTime(communication.contacted_at)}
                  </p>
                </div>
                {communication.message_text ? (
                  <p className="mt-2 whitespace-pre-line text-sm text-gray-700">
                    {communication.message_text}
                  </p>
                ) : null}
                {communication.supplier_response ? (
                  <div className="mt-2 rounded bg-green-50 px-3 py-2 text-sm text-green-900">
                    <p className="text-xs font-semibold uppercase tracking-wide text-green-800">
                      Supplier response
                    </p>
                    <p className="mt-1 whitespace-pre-line">{communication.supplier_response}</p>
                    <p className="mt-1 text-xs text-green-800">
                      {formatDateTime(communication.responded_at)}
                    </p>
                  </div>
                ) : null}
                {communication.attachment_path ? (
                  <button
                    type="button"
                    disabled={downloadingId === communication.id}
                    onClick={() => void downloadAttachment(communication)}
                    className={`${smallButtonClass} mt-2`}
                  >
                    {downloadingId === communication.id ? 'Downloading…' : 'Download attachment'}
                  </button>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </div>

      {open ? (
        <form onSubmit={submit} className="space-y-3 border-t border-rule bg-gray-50 px-4 py-4">
          {formError ? <Alert tone="error">{formError}</Alert> : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`method-${supplier.id}`} className="block text-sm font-medium text-gray-900">
                Contact method
              </label>
              <select
                id={`method-${supplier.id}`}
                value={method}
                onChange={(event) => setMethod(event.target.value as SupplierContactMethod)}
                className={`${inputClass(false)} mt-1`}
              >
                {CONTACT_METHODS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor={`attachment-${supplier.id}`} className="block text-sm font-medium text-gray-900">
                Attachment <span className="font-normal text-gray-500">(optional)</span>
              </label>
              <input
                id={`attachment-${supplier.id}`}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={(event) => setAttachment(event.target.files?.[0] ?? null)}
                className="mt-1 block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-gray-700"
              />
              <p className="mt-1 text-xs text-gray-500">PDF, JPG, PNG or WebP up to 5 MB.</p>
            </div>
          </div>

          <div>
            <label htmlFor={`message-${supplier.id}`} className="block text-sm font-medium text-gray-900">
              Message sent to supplier
            </label>
            <textarea
              id={`message-${supplier.id}`}
              rows={3}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Items requested, quantity, delivery deadline…"
              maxLength={5000}
              className={`${inputClass(false)} mt-1`}
            />
          </div>

          <div>
            <label htmlFor={`response-${supplier.id}`} className="block text-sm font-medium text-gray-900">
              Supplier response
            </label>
            <p className="text-xs text-gray-500">
              Record confirmed price, stock availability, delivery time, or warranty details.
            </p>
            <textarea
              id={`response-${supplier.id}`}
              rows={3}
              value={response}
              onChange={(event) => setResponse(event.target.value)}
              placeholder="Example: confirmed 12 pcs at 45,000 MMK each; delivery in 5 days."
              maxLength={5000}
              className={`${inputClass(false)} mt-1`}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={submitting} className={primaryButtonClass}>
              {submitting ? 'Saving…' : 'Save contact log'}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                resetForm();
                setOpen(false);
              }}
              className={secondaryButtonClass}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
