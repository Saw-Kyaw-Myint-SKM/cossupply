/**
 * One supplier group inside an Admin quotation request (Task 07).
 *
 * Shows the request items that belong to the supplier, the append-only
 * contact log, and the manual Viber/phone/email logging form. Confirmed
 * price, stock and delivery details are captured as free-text supplier
 * responses here and become structured values in the version builder.
 */
import { useState, type FormEvent } from 'react';
import { useI18n } from '../../../lib/i18n-context';
import { formatLocalDate } from '../../../lib/localization';
import {
  Alert,
  FALLBACK_THUMB,
  StatusBadge,
  inputClass,
  panelClass,
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
import { saveDownloadedFile } from '../../../lib/downloadFile';

function formatDateTime(value: string | null, locale: 'en' | 'my', fallback: string): string {
  return formatLocalDate(value, locale, { dateStyle: 'medium', timeStyle: 'short' }) ?? fallback;
}

function formatMethod(value: string, t: ReturnType<typeof useI18n>['t']): string {
  const keys: Record<SupplierContactMethod, Parameters<typeof t>[0]> = {
    VIBER: 'viber', PHONE: 'phone', EMAIL: 'email', TELEGRAM: 'telegram', OTHER: 'other',
  };
  return value in keys ? t(keys[value as SupplierContactMethod]) : value;
}

/* Burmese stacks its vowels and medials above and below the baseline, so the
 * Latin default leading crowds labels against their fields. */
const fieldLabelClass = 'block text-sm font-medium leading-relaxed text-gray-900';
const fieldHintClass = 'mt-1 text-xs leading-relaxed text-gray-500';

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
  const { locale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const contactMethods: Array<{ value: SupplierContactMethod; label: string }> = [
    { value: 'VIBER', label: t('viber') }, { value: 'PHONE', label: t('phone') },
    { value: 'EMAIL', label: t('email') }, { value: 'TELEGRAM', label: t('telegram') }, { value: 'OTHER', label: t('other') },
  ];
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
    // The directory often stores the same number for phone and Viber; showing
    // it twice makes the contact line read as noise.
    supplier.viber_phone && supplier.viber_phone !== supplier.phone
      ? `${t('viber')} ${supplier.viber_phone}`
      : null,
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
      setFormError(t('supplierContactRequired'));
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
      setFormError(result.message ?? t('supplierContactSaveFailed'));
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
      onError(result.message ?? t('attachmentDownloadFailed'));
      return;
    }

    saveDownloadedFile(result.data);
  };

  return (
    <section className={`overflow-hidden ${panelClass}`}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-rule px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-ink">
              {supplier.shop_name ?? t('supplierNumber', { id: supplier.id })}
            </h2>
            <span className="rounded-full bg-paper px-2.5 py-1 text-xs font-medium leading-relaxed text-muted ring-1 ring-inset ring-rule">
              {t('itemCount', {
                count: group.items.length,
                noun: group.items.length === 1 ? t('item') : t('itemsPlural'),
              })}
            </span>
          </div>

          {contactBits.length > 0 ? (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              {contactBits.map((bit) => (
                <span key={bit} className="text-xs leading-relaxed text-gray-600">
                  {bit}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs leading-relaxed text-gray-500">
              {t('noSupplierContactDetails')}
            </p>
          )}

          {supplier.delivery_time || supplier.warranty_policy ? (
            <p className="mt-1 text-xs leading-relaxed text-gray-500">
              {[supplier.delivery_time, supplier.warranty_policy].filter(Boolean).join(' · ')}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          className={secondaryButtonClass}
          onClick={() => {
            setOpen((value) => !value);
            setFormError(null);
          }}
        >
          {open ? t('closeLogForm') : t('logContact')}
        </button>
      </header>

      <ul className="divide-y divide-rule">
        {group.items.map((item) => (
          <li key={`${supplier.id}-${item.product_id}`} className="flex items-start gap-3 px-5 py-3.5">
            <img
              src={item.photo_url ?? FALLBACK_THUMB}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-12 w-12 flex-none rounded-lg border border-rule bg-paper object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-relaxed text-ink">
                {item.product_name_snapshot}
              </p>
              <p className="mt-0.5 truncate text-xs text-gray-500">
                {[item.sku, item.specification_snapshot].filter(Boolean).join(' · ') || t('noSku')}
              </p>
              {item.stock_status ? (
                <div className="mt-1.5">
                  <StatusBadge status={item.stock_status} />
                </div>
              ) : null}
            </div>
            <div className="flex-none text-right">
              <p className="text-xs text-gray-500">{t('displayPrice')}</p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums text-ink">
                {item.display_price !== null ? formatMMK(item.display_price) : t('confirm')}
              </p>
              <p className="mt-1 text-xs tabular-nums text-gray-500">
                {t('qty')} {item.quantity}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <div className="border-t border-rule bg-paper/60 px-5 py-3">
        {group.communications.length === 0 ? (
          <p className="text-xs leading-relaxed text-gray-500">{t('noSupplierContact')}</p>
        ) : (
          <>
            <h3 className="text-xs font-semibold text-gray-500">{t('contactHistory')}</h3>
            <ol className="mt-2 space-y-2.5">
              {group.communications.map((communication) => (
                <li key={communication.id} className="border-l-2 border-primary/25 pl-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-ink">
                      {formatMethod(communication.contact_method, t)}
                      {communication.admin ? (
                        <span className="font-normal text-gray-500">
                          {' · '}
                          {communication.admin.name}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDateTime(communication.contacted_at, locale, t('noData'))}
                    </p>
                  </div>
                  {communication.message_text ? (
                    <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-gray-700">
                      {communication.message_text}
                    </p>
                  ) : null}
                  {communication.supplier_response ? (
                    <div className="mt-2 rounded-lg bg-success-soft px-3 py-2 text-sm leading-relaxed text-green-900">
                      <p className="text-xs font-semibold text-green-800">
                        {t('supplierResponse')}
                      </p>
                      <p className="mt-1 whitespace-pre-line">
                        {communication.supplier_response}
                      </p>
                      <p className="mt-1 text-xs text-green-800">
                        {formatDateTime(communication.responded_at, locale, t('noData'))}
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
                      {downloadingId === communication.id
                        ? t('downloading')
                        : t('downloadAttachment')}
                    </button>
                  ) : null}
                </li>
              ))}
            </ol>
          </>
        )}
      </div>

      {open ? (
        <form onSubmit={submit} className="space-y-3 border-t border-rule bg-paper px-5 py-4">
          {formError ? <Alert tone="error">{formError}</Alert> : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`method-${supplier.id}`} className={fieldLabelClass}>
                {t('contactMethod')}
              </label>
              <select
                id={`method-${supplier.id}`}
                value={method}
                onChange={(event) => setMethod(event.target.value as SupplierContactMethod)}
                className={`${inputClass(false)} mt-1`}
              >
                {contactMethods.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor={`attachment-${supplier.id}`} className={fieldLabelClass}>
                {t('attachment')} <span className="font-normal text-gray-500">({t('optional')})</span>
              </label>
              <input
                id={`attachment-${supplier.id}`}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={(event) => setAttachment(event.target.files?.[0] ?? null)}
                className="mt-1 block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-gray-700"
              />
              <p className={fieldHintClass}>{t('attachmentHint')}</p>
            </div>
          </div>

          <div>
            <label htmlFor={`message-${supplier.id}`} className={fieldLabelClass}>
              {t('messageSupplier')}
            </label>
            <textarea
              id={`message-${supplier.id}`}
              rows={3}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={t('supplierMessagePlaceholder')}
              maxLength={5000}
              className={`${inputClass(false)} mt-1`}
            />
          </div>

          <div>
            <label htmlFor={`response-${supplier.id}`} className={fieldLabelClass}>
              {t('supplierResponse')}
            </label>
            <p className={fieldHintClass}>
              {t('supplierResponseHint')}
            </p>
            <textarea
              id={`response-${supplier.id}`}
              rows={3}
              value={response}
              onChange={(event) => setResponse(event.target.value)}
              placeholder={t('supplierResponsePlaceholder')}
              maxLength={5000}
              className={`${inputClass(false)} mt-1`}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={submitting} className={primaryButtonClass}>
              {submitting ? t('savingChanges') : t('saveContactLog')}
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
              {t('cancel')}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
