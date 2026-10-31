import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Alert,
  StatusBadge,
  primaryButtonClass,
  secondaryButtonClass,
  smallButtonClass,
} from '../../../components/catalog-ui/CatalogUi';
import { useI18n } from '../../../lib/i18n-context';
import { formatLocalDate } from '../../../lib/localization';
import { formatMMK } from '../../../lib/money';
import {
  downloadQuotationPdf,
  generateQuotationPdf,
  resendQuotationEmail,
  sendQuotation,
  type EmailLog,
  type QuotationVersion,
} from '../api/quotationAdminApi';
import { saveDownloadedFile } from '../../../lib/downloadFile';

interface QuotationVersionPanelProps {
  requestId: number;
  versions: QuotationVersion[];
  canCreateVersion: boolean;
  onChanged: () => void;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
}

export default function QuotationVersionPanel({ requestId, versions, canCreateVersion, onChanged, onNotice, onError }: QuotationVersionPanelProps) {
  const { locale, t } = useI18n();
  const [busy, setBusy] = useState<string | null>(null);
  const date = (value: string | null) => formatLocalDate(value, locale) ?? t('noData');
  const dateTime = (value: string | null) => formatLocalDate(value, locale, { dateStyle: 'medium', timeStyle: 'short' }) ?? t('noData');

  const runDownload = async (version: QuotationVersion) => {
    setBusy(`${version.id}:download`);
    const result = await downloadQuotationPdf(version.id);
    setBusy(null);
    if (!result.success || !result.data) return onError(result.message ?? t('quotationPdfDownloadFailed'));
    saveDownloadedFile(result.data);
  };
  const runGeneratePdf = async (version: QuotationVersion) => {
    setBusy(`${version.id}:pdf`);
    const result = await generateQuotationPdf(version.id);
    setBusy(null);
    if (!result.success || !result.data) return onError(result.message ?? t('quotationPdfGenerateFailed'));
    onNotice(t('pdfGeneratedVersion', { version: version.version }));
    onChanged();
  };
  const runSend = async (version: QuotationVersion) => {
    if (!window.confirm(t('sendQuotationConfirm', { version: version.version, quotation: version.quotation_number }))) return;
    setBusy(`${version.id}:send`);
    const result = await sendQuotation(version.id);
    setBusy(null);
    if (!result.success || !result.data) return onError(result.message ?? t('quotationSendFailed'));
    const email: EmailLog = result.data.email;
    onNotice(email.status === 'SENT' ? t('versionSent', { version: version.version, email: email.recipient_email }) : t('versionEmailFailed', { version: version.version }));
    onChanged();
  };
  const runResend = async (version: QuotationVersion) => {
    setBusy(`${version.id}:resend`);
    const result = await resendQuotationEmail(version.id);
    setBusy(null);
    if (!result.success || !result.data) return onError(result.message ?? t('quotationEmailResendFailed'));
    onNotice(result.data.email.status === 'SENT' ? t('quotationEmailResent', { email: result.data.email.recipient_email }) : t('resendAttemptFailed'));
    onChanged();
  };

  return <section className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-semibold text-ink">{t('finalQuotations')}</h2><p className="mt-1 text-sm text-gray-600">{t('sentVersionsImmutable')}</p></div>{canCreateVersion ? <Link to={`/admin/quotation-requests/${requestId}/versions/new`} className={primaryButtonClass}>{t('createNewVersion')}</Link> : <p className="text-sm text-gray-500">{t('requestClosedVersions')}</p>}</div>
    {versions.length === 0 ? <div className="rounded-lg border border-dashed border-rule bg-plate p-6 text-center"><p className="text-sm font-medium text-ink">{t('noQuotationVersion')}</p><p className="mt-1 text-sm text-gray-500">{t('quotationVersionEmptyHint')}</p>{canCreateVersion ? <Link to={`/admin/quotation-requests/${requestId}/versions/new`} className={`${primaryButtonClass} mt-4`}>{t('createFirstVersion')}</Link> : null}</div> : <div className="space-y-4">{versions.map((version) => {
      const isDraft = version.status === 'DRAFT'; const latestPdf = version.pdfs[0] ?? null;
      return <article key={version.id} className={`overflow-hidden rounded-lg border bg-plate ${version.is_current ? 'border-accent ring-1 ring-accent' : 'border-rule'}`}>
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-rule bg-gray-50 px-4 py-3"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-base font-semibold text-ink">{t('version', { version: version.version })}</h3><StatusBadge status={version.status}/>{version.is_current ? <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800">{t('current')}</span> : null}</div><p className="mt-1 text-xs text-gray-500">{version.quotation_number} · {t('createdOn', { date: dateTime(version.created_at) })}{version.created_by_admin ? ` · ${version.created_by_admin.name}` : ''}</p></div><div className="flex flex-wrap gap-2">{isDraft ? <><Link to={`/admin/quotations/${version.id}/edit`} className={secondaryButtonClass}>{t('editDraft')}</Link>{version.pdfs.length > 0 ? <button type="button" onClick={() => void runDownload(version)} disabled={busy === `${version.id}:download`} className={secondaryButtonClass}>{busy === `${version.id}:download` ? t('downloading') : t('downloadPdf')}</button> : null}<button type="button" onClick={() => void runGeneratePdf(version)} disabled={busy === `${version.id}:pdf`} className={secondaryButtonClass}>{busy === `${version.id}:pdf` ? t('generating') : t('generatePdf')}</button><button type="button" onClick={() => void runSend(version)} disabled={busy === `${version.id}:send`} className={primaryButtonClass}>{busy === `${version.id}:send` ? t('sending') : t('sendToCustomer')}</button></> : <><button type="button" onClick={() => void runDownload(version)} disabled={busy === `${version.id}:download`} className={secondaryButtonClass}>{busy === `${version.id}:download` ? t('downloading') : t('downloadPdf')}</button>{version.sent_at ? <button type="button" onClick={() => void runResend(version)} disabled={busy === `${version.id}:resend`} className={primaryButtonClass}>{busy === `${version.id}:resend` ? t('resending') : t('resendEmail')}</button> : null}</>}</div></header>
        <div className="grid gap-3 border-b border-rule px-4 py-3 text-sm sm:grid-cols-3 lg:grid-cols-6">{[[t('subtotal'), formatMMK(version.subtotal)], [t('discount'), formatMMK(version.discount)], [t('delivery'), formatMMK(version.delivery_fee)], [t('serviceFee', { percent: version.service_fee_percentage }), formatMMK(version.service_fee)], [t('total'), `${formatMMK(version.total_amount)} MMK`], [t('validUntil', { date: '' }).replace(/\s*$/, ''), date(version.valid_until)]].map(([label, value]) => <div key={label}><p className="text-xs text-gray-500">{label}</p><p className="font-medium tabular-nums text-ink">{value}</p></div>)}</div>
        <div className="overflow-x-auto"><table className="min-w-full divide-y divide-rule text-sm"><thead className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500"><tr>{[t('itemLabel'), t('qty'), t('unitPrice'), t('discount'), t('lineTotal'), t('delivery')].map((label) => <th key={label} className="px-4 py-2">{label}</th>)}</tr></thead><tbody className="divide-y divide-rule">{version.items.map((item) => <tr key={item.id}><td className="px-4 py-2"><p className="font-medium text-ink">{item.product_name_snapshot}</p><p className="text-xs text-gray-500">{[item.sku_snapshot, item.supplier?.shop_name].filter(Boolean).join(' · ') || t('noData')}</p>{item.supplier_note || item.warranty_note ? <p className="mt-1 text-xs text-gray-600">{[item.supplier_note, item.warranty_note].filter(Boolean).join(' · ')}</p> : null}</td><td className="px-4 py-2 tabular-nums text-gray-700">{item.quantity}</td><td className="px-4 py-2 tabular-nums text-gray-700">{formatMMK(item.unit_price)}</td><td className="px-4 py-2 tabular-nums text-gray-700">{formatMMK(item.discount)}</td><td className="px-4 py-2 tabular-nums font-medium text-ink">{formatMMK(item.line_total)}</td><td className="px-4 py-2 text-gray-600">{date(item.delivery_date)}</td></tr>)}</tbody></table></div>
        <div className="grid gap-4 border-t border-rule px-4 py-3 text-sm md:grid-cols-2"><div><h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t('terms')}</h4><p className="mt-1 whitespace-pre-line text-gray-700">{version.payment_terms}</p><p className="mt-1 text-xs text-gray-500">{version.payment_method}</p>{version.admin_note ? <p className="mt-2 whitespace-pre-line rounded bg-gray-50 px-3 py-2 text-gray-700">{version.admin_note}</p> : null}</div><div><h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t('pdfAndEmail')}</h4><p className="mt-1 text-xs text-gray-600">{version.pdfs.length === 0 ? t('noPdfGenerated') : t('pdfGenerated', { count: version.pdfs.length, suffix: version.pdfs.length === 1 ? '' : 's', file: latestPdf?.file_name ?? t('noData') })}</p>{version.email_logs.length > 0 ? <ul className="mt-2 space-y-1">{version.email_logs.map((email) => <li key={email.id} className="flex flex-wrap items-center gap-2 text-xs text-gray-600"><span className={`font-semibold ${email.status === 'SENT' ? 'text-green-700' : 'text-red-700'}`}>{email.status}</span><span>{email.recipient_email}</span><span>{dateTime(email.sent_at ?? email.created_at)}</span>{email.error_message ? <span className="w-full text-red-700">{email.error_message}</span> : null}</li>)}</ul> : <p className="mt-1 text-xs text-gray-500">{t('noEmailAttempt')}</p>}</div></div>
      </article>;
    })}</div>}
    {versions.length > 0 ? <Alert tone="warning">{t('sharePdfHint')}</Alert> : null}
    {versions.some((version) => version.status === 'DRAFT') ? <p className="text-xs text-gray-500">{t('draftTotalsHint')}</p> : null}
    <div className="flex gap-2"><Link to={`/admin/quotation-requests/${requestId}`} className={smallButtonClass}>{t('backToRequest')}</Link></div>
  </section>;
}
