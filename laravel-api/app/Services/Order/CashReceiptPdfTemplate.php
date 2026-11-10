<?php

namespace App\Services\Order;

use App\Models\CashPayment;
use App\Models\Order;
use App\Services\Setting\SettingService;
use DateTimeInterface;

/**
 * Builds the HTML body of the COD cash receipt.
 *
 * Split from {@see CashReceiptPdfService} so content can be asserted without
 * parsing the binary PDF. mPDF owns wrapping, page breaks and Burmese shaping.
 */
class CashReceiptPdfTemplate
{
    private const INK = '#1a1a1a';

    private const MUTED = '#5c5c5c';

    private const SUBTLE = '#8c8c8c';

    private const LINE = '#d4d4d4';

    private const RULE = '#ebebeb';

    public function __construct(
        private readonly SettingService $settings,
    ) {}

    public function html(CashPayment $payment, Order $order, DateTimeInterface $generatedAt): string
    {
        $companyName = (string) $this->settings->get('company_name', 'CoSupply');
        $companyPhone = (string) $this->settings->get('company_phone', '');
        $companyEmail = (string) $this->settings->get('company_email', '');
        $companyAddress = (string) $this->settings->get('company_address', '');

        $customerLines = array_values(array_filter([
            $payment->customer_name ?? $order->customer_name,
            $order->company_name,
            $order->phone,
            $order->email,
        ]));

        $deliveryLines = array_values(array_filter([
            $order->delivery_address,
            $order->landmark,
            $order->township !== null ? $order->township.', '.$order->city : $order->city,
            'Payment: Cash on Delivery',
        ]));

        $customerBlock = '';
        foreach ($customerLines as $line) {
            $customerBlock .= '<div class="party-line">'.$this->e((string) $line).'</div>';
        }

        $deliveryBlock = '';
        foreach ($deliveryLines as $index => $line) {
            $deliveryBlock .= '<div class="'.($index === 0 ? 'party-primary' : 'party-line').'">'
                .$this->e((string) $line).'</div>';
        }

        $itemRows = '';
        foreach ($order->items as $index => $item) {
            $details = array_values(array_filter([
                $item->sku_snapshot !== null ? 'SKU '.$item->sku_snapshot : null,
                $item->specification_snapshot,
            ]));

            $detailHtml = '';
            foreach ($details as $detail) {
                $detailHtml .= '<div class="item-detail">'.$this->e($detail).'</div>';
            }

            $itemRows .= '<tr>'
                .'<td class="num">'.($index + 1).'</td>'
                .'<td><span class="item-name">'.$this->e((string) $item->product_name_snapshot).'</span>'
                .$detailHtml.'</td>'
                .'<td class="right">'.$this->e((string) $item->quantity).'</td>'
                .'<td class="right">'.$this->e($this->money((int) $item->unit_price)).'</td>'
                .'<td class="right amount">'.$this->e($this->money((int) $item->line_total)).'</td>'
                .'</tr>';
        }

        $totalsRows = '';
        foreach ([
            ['Subtotal', (int) $order->subtotal, false],
            ['Discount', (int) $order->discount, false],
            ['Delivery fee', (int) $order->delivery_fee, false],
            [sprintf('Service fee (%d%%)', $order->service_fee_percentage), (int) $order->service_fee, false],
            ['TOTAL (COD)', (int) $order->total_amount, true],
        ] as [$label, $amount, $grand]) {
            $totalsRows .= '<tr'.($grand ? ' class="t-grand"' : '').'>'
                .'<td class="t-label">'.$this->e($label).'</td>'
                .'<td class="t-value">'.$this->e($this->money($amount)).'</td>'
                .'</tr>';
        }

        $paymentRows = '';
        foreach ([
            ['Payment method', 'Cash on Delivery'],
            ['Amount due', $this->money((int) $payment->amount_due)],
            ['Amount collected', $this->money((int) $payment->amount_collected)],
            ['Amount remaining', $this->money((int) $payment->amount_remaining)],
            ['Received by', $payment->received_by ?? '—'],
            ['Collected at', $payment->collected_at?->format('d M Y H:i') ?? '—'],
            ['Payment status', $payment->status->value],
        ] as [$label, $value]) {
            $paymentRows .= '<tr>'
                .'<td class="p-label">'.$this->e($label).'</td>'
                .'<td class="p-value'.($label === 'Amount collected' ? ' p-strong' : '').'">'
                .$this->e((string) $value).'</td>'
                .'</tr>';
        }

        $noteBlock = '';
        if ($payment->note !== null && $payment->note !== '') {
            $noteBlock = '<div class="section">'
                .'<div class="section-rule"></div>'
                .'<div class="section-title">NOTE</div>'
                .'<p class="section-paragraph">'.$this->e($payment->note).'</p>'
                .'</div>';
        }

        return '<!DOCTYPE html>'
            .'<html lang="en"><head><meta charset="utf-8">'
            .'<style>'.$this->styles().'</style>'
            .'</head><body>'

            .'<table class="head"><tr>'
            .'<td class="head-left">'
            .'<div class="brand">'.$this->e($companyName).'</div>'
            .($companyAddress !== '' ? '<div class="small">'.$this->e($companyAddress).'</div>' : '')
            .'<div class="small">'.$this->e(trim($companyPhone.'  '.$companyEmail)).'</div>'
            .'</td>'
            .'<td class="head-right">'
            .'<div class="doc-type">CASH RECEIPT</div>'
            .'<div class="doc-number">'.$this->e((string) $payment->receipt_number).'</div>'
            .'<div class="small">Order '.$this->e((string) $order->order_number).'</div>'
            .'<div class="small">Issued '.$this->e($payment->collected_at?->format('d M Y H:i') ?? $generatedAt->format('d M Y H:i')).'</div>'
            .'</td>'
            .'</tr></table>'
            .'<div class="rule-ink"></div>'

            .'<table class="parties"><tr>'
            .'<td class="party-left">'
            .'<div class="section-label">RECEIVED FROM</div>'
            .$customerBlock
            .'</td>'
            .'<td class="party-right">'
            .'<div class="section-label">DELIVERY DETAILS</div>'
            .$deliveryBlock
            .'</td>'
            .'</tr></table>'
            .'<div class="rule-line"></div>'

            .'<table class="items">'
            .'<thead><tr>'
            .'<th class="col-num">#</th>'
            .'<th class="col-item">ITEM</th>'
            .'<th class="col-qty">QTY</th>'
            .'<th class="col-unit">UNIT PRICE</th>'
            .'<th class="col-amount">LINE TOTAL</th>'
            .'</tr></thead>'
            .'<tbody>'.$itemRows.'</tbody>'
            .'</table>'
            .'<div class="rule-line-thin"></div>'

            .'<table class="totals-wrap"><tr>'
            .'<td class="totals-spacer"></td>'
            .'<td class="totals-cell"><table class="totals">'.$totalsRows.'</table></td>'
            .'</tr></table>'

            .'<div class="section">'
            .'<div class="section-rule"></div>'
            .'<div class="section-title">PAYMENT RECEIVED</div>'
            .'<table class="payment">'.$paymentRows.'</table>'
            .'</div>'

            .$noteBlock

            .'<table class="signatures"><tr>'
            .'<td class="signature"><div class="signature-line"></div><div class="signature-label">Customer signature</div></td>'
            .'<td class="signature-gap"></td>'
            .'<td class="signature"><div class="signature-line"></div><div class="signature-label">Receiver signature</div></td>'
            .'</tr></table>'

            .'<div class="disclaimer">This receipt confirms full cash payment for the delivered order. Partial payment is not accepted.</div>'
            .'</body></html>';
    }

    /**
     * Footer HTML injected by the renderer so page numbers stay native.
     */
    public function footer(DateTimeInterface $generatedAt): string
    {
        return '<div class="page-footer">Page {PAGENO} of {nbpg}  |  Generated '
            .$this->e($generatedAt->format('d M Y H:i')).'</div>';
    }

    private function styles(): string
    {
        $ink = self::INK;
        $muted = self::MUTED;
        $subtle = self::SUBTLE;
        $line = self::LINE;
        $rule = self::RULE;

        return <<<CSS
body { font-family: dejavusans; color: {$ink}; font-size: 9pt; line-height: 1.35; }
table { border-collapse: collapse; width: 100%; }
.head td { vertical-align: top; padding: 0; }
.head-left { width: 55%; }
.head-right { width: 45%; text-align: right; }
.brand { font-size: 18pt; font-weight: bold; color: {$ink}; line-height: 1.1; }
.doc-type { font-size: 22pt; font-weight: bold; color: {$ink}; line-height: 1.1; }
.doc-number { font-size: 10pt; font-weight: bold; color: {$ink}; margin-top: 2px; }
.small { font-size: 9pt; color: {$muted}; }
.rule-ink { border-top: 1.2px solid {$ink}; margin: 8px 0 14px 0; }
.rule-line { border-top: 0.6px solid {$line}; margin: 12px 0 14px 0; }
.rule-line-thin { border-top: 0.6px solid {$line}; margin: 6px 0 0 0; }
.parties td { vertical-align: top; padding: 0; }
.party-left { width: 48%; padding-right: 10px; }
.party-right { width: 52%; }
.section-label { font-size: 11pt; font-weight: bold; color: {$ink}; margin-bottom: 6px; }
.party-line { font-size: 9pt; color: {$muted}; margin-bottom: 2px; }
.party-primary { font-size: 9.5pt; font-weight: bold; color: {$ink}; margin-bottom: 3px; }
.items { width: 100%; }
.items th { font-size: 8pt; font-weight: bold; color: {$ink}; padding: 0 4px 5px 4px; border-bottom: 0.5px solid {$line}; text-align: left; }
.items td { font-size: 9pt; padding: 6px 4px; vertical-align: top; border-bottom: 0.25px solid {$rule}; }
.items tr { page-break-inside: avoid; }
.col-num { width: 5%; }
.col-item { width: 45%; }
.col-qty { width: 8%; text-align: right; }
.col-unit { width: 20%; text-align: right; }
.col-amount { width: 22%; text-align: right; }
.num { color: {$muted}; }
.right { text-align: right; }
.amount { font-weight: bold; }
.item-name { font-size: 9pt; color: {$ink}; }
.item-detail { font-size: 7.5pt; color: {$subtle}; margin-top: 2px; }
.totals-wrap { margin-top: 10px; }
.totals-wrap td { vertical-align: top; padding: 0; }
.totals-spacer { width: 55%; }
.totals-cell { width: 45%; }
.totals { width: 100%; }
.totals td { font-size: 9pt; padding: 3px 2px; }
.t-label { color: {$muted}; }
.t-value { text-align: right; color: {$ink}; }
.t-grand td { font-size: 11pt; font-weight: bold; border-top: 0.6px solid {$line}; padding-top: 6px; }
.section { margin-top: 18px; page-break-inside: avoid; }
.section-rule { border-top: 0.6px solid {$subtle}; margin-bottom: 8px; }
.section-title { font-size: 11pt; font-weight: bold; color: {$ink}; margin-bottom: 6px; }
.section-paragraph { font-size: 9pt; color: {$ink}; margin: 0; }
.payment { width: 100%; }
.payment td { font-size: 9pt; padding: 2px 0; vertical-align: top; }
.p-label { width: 30%; color: {$muted}; }
.p-value { color: {$ink}; }
.p-strong { font-weight: bold; }
.signatures { margin-top: 26px; }
.signatures td { vertical-align: bottom; padding: 0; }
.signature { width: 45%; }
.signature-gap { width: 10%; }
.signature-line { border-top: 0.5px solid {$ink}; margin-bottom: 4px; }
.signature-label { font-size: 8pt; color: {$muted}; }
.disclaimer { margin-top: 18px; font-size: 8pt; color: {$muted}; }
.page-footer { border-top: 0.5px solid {$rule}; padding-top: 4px; text-align: center; font-size: 7.5pt; color: {$subtle}; }
CSS;
    }

    private function money(int $amount): string
    {
        return number_format($amount).' MMK';
    }

    /**
     * Escape text for HTML while keeping UTF-8 (Myanmar) characters intact.
     */
    private function e(string $value): string
    {
        return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }
}
