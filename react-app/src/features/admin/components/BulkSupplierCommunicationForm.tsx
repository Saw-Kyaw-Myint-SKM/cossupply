/**
 * Log one append-only contact entry for several supplier groups at once.
 *
 * The admin picks the suppliers, writes one shared message and optionally
 * attaches one file. Every selected supplier group receives its own
 * communication row; the backend stores the attachment once and shares it.
 */
import { useState, type FormEvent } from 'react';
import { useI18n } from '../../../lib/i18n-context';
import {
  Alert,
  inputClass,
  panelClass,
  primaryButtonClass,
  secondaryButtonClass,
  smallButtonClass,
} from '../../../components/catalog-ui/CatalogUi';
import {
  createBulkSupplierCommunication,
  type SupplierContactMethod,
  type SupplierGroup,
} from '../api/quotationAdminApi';

const fieldLabelClass = 'block text-sm font-medium leading-relaxed text-gray-900';
const fieldHintClass = 'mt-1 text-xs leading-relaxed text-gray-500';

interface BulkSupplierCommunicationFormProps {
  requestId: number;
  groups: SupplierGroup[];
  onLogged: (count: number) => void;
  onCancel: () => void;
}

export default function BulkSupplierCommunicationForm({
  requestId,
  groups,
  onLogged,
  onCancel,
}: BulkSupplierCommunicationFormProps) {
  const { t } = useI18n();
  const contactMethods: Array<{ value: SupplierContactMethod; label: string }> = [
    { value: 'VIBER', label: t('viber') },
    { value: 'PHONE', label: t('phone') },
    { value: 'EMAIL', label: t('email') },
    { value: 'TELEGRAM', label: t('telegram') },
    { value: 'OTHER', label: t('other') },
  ];

  const [method, setMethod] = useState<SupplierContactMethod>('VIBER');
  const [message, setMessage] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>(() =>
    groups.map((group) => group.supplier.id),
  );
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const allSelected = selectedIds.length === groups.length;

  const toggleSupplier = (supplierId: number) => {
    setSelectedIds((current) =>
      current.includes(supplierId)
        ? current.filter((id) => id !== supplierId)
        : [...current, supplierId],
    );
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    if (selectedIds.length === 0) {
      setFormError(t('selectAtLeastOneSupplier'));
      return;
    }

    if (message.trim() === '') {
      setFormError(t('bulkContactMessageRequired'));
      return;
    }

    setSubmitting(true);
    const result = await createBulkSupplierCommunication(requestId, {
      supplier_ids: selectedIds,
      contact_method: method,
      message_text: message,
      attachment,
    });
    setSubmitting(false);

    if (!result.success) {
      setFormError(result.message ?? t('bulkContactSaveFailed'));
      return;
    }

    onLogged(result.data?.communications.length ?? selectedIds.length);
  };

  return (
    <form onSubmit={submit} className={`${panelClass} space-y-4 p-5`}>
      {formError ? <Alert tone="error">{formError}</Alert> : null}

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-ink">{t('logContactForSuppliers')}</h3>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={submitting || allSelected}
              onClick={() => setSelectedIds(groups.map((group) => group.supplier.id))}
              className={smallButtonClass}
            >
              {t('selectAllSuppliers')}
            </button>
            <button
              type="button"
              disabled={submitting || selectedIds.length === 0}
              onClick={() => setSelectedIds([])}
              className={smallButtonClass}
            >
              {t('clearSuppliers')}
            </button>
          </div>
        </div>

        <fieldset className="mt-2" disabled={submitting}>
          <legend className={`${fieldLabelClass} mb-1`}>
            {t('suppliersToLog')} <span className="font-normal text-gray-500">*</span>
          </legend>
          <ul className="divide-y divide-rule rounded-lg border border-rule bg-white">
            {groups.map((group) => (
              <li key={group.supplier.id}>
                <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(group.supplier.id)}
                    onChange={() => toggleSupplier(group.supplier.id)}
                    className="h-4 w-4 flex-none rounded border-rule text-primary focus:ring-primary"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                    {group.supplier.shop_name ?? t('supplierNumber', { id: group.supplier.id })}
                  </span>
                  <span className="flex-none text-xs leading-relaxed text-gray-500">
                    {t('itemCount', {
                      count: group.items.length,
                      noun: group.items.length === 1 ? t('item') : t('itemsPlural'),
                    })}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="bulk-method" className={fieldLabelClass}>
            {t('contactMethod')}
          </label>
          <select
            id="bulk-method"
            value={method}
            disabled={submitting}
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
          <label htmlFor="bulk-attachment" className={fieldLabelClass}>
            {t('attachment')} <span className="font-normal text-gray-500">({t('optional')})</span>
          </label>
          <input
            id="bulk-attachment"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            disabled={submitting}
            onChange={(event) => setAttachment(event.target.files?.[0] ?? null)}
            className="mt-1 block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-gray-700"
          />
          <p className={fieldHintClass}>{t('attachmentHint')}</p>
        </div>
      </div>

      <div>
        <label htmlFor="bulk-message" className={fieldLabelClass}>
          {t('messageSupplier')} <span className="font-normal text-gray-500">*</span>
        </label>
        <textarea
          id="bulk-message"
          rows={3}
          value={message}
          disabled={submitting}
          onChange={(event) => setMessage(event.target.value)}
          placeholder={t('supplierMessagePlaceholder')}
          maxLength={5000}
          className={`${inputClass(false)} mt-1`}
        />
      </div>

      <p
        className={`text-xs leading-relaxed ${
          selectedIds.length === 0 ? 'font-medium text-red-600' : 'text-gray-500'
        }`}
      >
        {selectedIds.length === 0
          ? t('selectAtLeastOneSupplier')
          : t('bulkContactEntryHint', {
              count: selectedIds.length,
              groups: selectedIds.length === 1 ? t('supplierGroup') : t('supplierGroups'),
            })}
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={submitting || selectedIds.length === 0}
          className={primaryButtonClass}
        >
          {submitting ? t('savingChanges') : t('saveContactLog')}
        </button>
        <button type="button" disabled={submitting} onClick={onCancel} className={secondaryButtonClass}>
          {t('cancel')}
        </button>
      </div>
    </form>
  );
}
