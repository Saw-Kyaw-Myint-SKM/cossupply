<?php

namespace App\Services\Order;

use App\Enums\PaymentStatus;
use App\Models\CashPayment;
use App\Models\Order;
use App\Models\OrderItem;
use App\Services\Quotation\SimplePdfDocument;
use App\Services\Setting\SettingService;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

/**
 * Renders the private COD cash receipt into local (non-public) storage.
 *
 * Receipts are only generated once the full COD amount has been collected.
 * The file path is stored on `cash_payments.receipt_file_path` and is never
 * exposed to clients; downloads go through authorization-protected routes.
 */
class CashReceiptPdfService
{
    public function __construct(
        private readonly SettingService $settings,
    ) {}

    /**
     * Whether a receipt may be downloaded for this payment.
     */
    public function isAvailable(CashPayment $payment): bool
    {
        return in_array($payment->status->value, [
            PaymentStatus::CASH_COLLECTED->value,
            PaymentStatus::PAYMENT_CONFIRMED->value,
        ], true);
    }

    /**
     * The download file name shown to the customer/admin.
     */
    public function fileName(CashPayment $payment): string
    {
        return sprintf('%s.pdf', $this->safeSegment($payment->receipt_number, 'receipt'));
    }

    /**
     * Regenerate the receipt when it is missing from private storage.
     */
    public function ensureGenerated(CashPayment $payment): string
    {
        $existing = $payment->receipt_file_path;

        if ($existing !== null && $existing !== '' && Storage::disk('local')->exists($existing)) {
            return $existing;
        }

        return $this->generate($payment);
    }

    /**
     * Render and store the receipt, updating the payment file path.
     */
    public function generate(CashPayment $payment): string
    {
        $payment->loadMissing(['order.items']);

        $order = $payment->order;

        if (! $order instanceof Order) {
            throw new RuntimeException('The cash payment has no order to render.');
        }

        $pdf = $this->render($payment, $order);
        $path = sprintf(
            'receipts/%s/%s.pdf',
            $this->safeSegment($order->order_number, 'order'),
            $this->safeSegment($payment->receipt_number, 'receipt'),
        );

        if (! Storage::disk('local')->put($path, $pdf)) {
            throw new RuntimeException('The cash receipt could not be written to private storage.');
        }

        $payment->forceFill(['receipt_file_path' => $path])->save();

        return $path;
    }

    private function render(CashPayment $payment, Order $order): string
    {
        $companyName = (string) $this->settings->get('company_name', 'CoSupply');
        $companyPhone = (string) $this->settings->get('company_phone', '');
        $companyEmail = (string) $this->settings->get('company_email', '');
        $companyAddress = (string) $this->settings->get('company_address', '');

        $doc = new SimplePdfDocument;
        $right = 547.0;

        $doc->text(48, 790, 18, $companyName, true);
        $doc->text(48, 773, 9, $companyAddress);
        $doc->text(48, 760, 9, trim($companyPhone.'  '.$companyEmail));
        $doc->textRight($right, 792, 22, 'CASH RECEIPT', true);
        $doc->textRight($right, 774, 10, $payment->receipt_number, true);
        $doc->textRight($right, 760, 9, 'Order '.$order->order_number);
        $doc->textRight($right, 747, 9, 'Issued '.($payment->collected_at?->format('d M Y H:i') ?? now()->format('d M Y H:i')));

        $doc->line(48, 736, $right, 736, 1.2);
        $doc->setY(716);

        $doc->text(48, $doc->y(), 11, 'RECEIVED FROM', true);
        $doc->text(310, $doc->y(), 11, 'DELIVERY DETAILS', true);
        $doc->moveY(-16);

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

        $blockHeight = max(count($customerLines), count($deliveryLines)) * 13;
        $startY = $doc->y();

        foreach ($customerLines as $index => $line) {
            $doc->text(48, $startY - ($index * 13), 9, $this->truncate($line, 48));
        }

        foreach ($deliveryLines as $index => $line) {
            $doc->text(310, $startY - ($index * 13), 9, $this->truncate($line, 48));
        }

        $doc->setY($startY - $blockHeight - 16);
        $doc->line(48, $doc->y(), $right, $doc->y(), 0.6);
        $doc->moveY(-22);

        $this->writeTableHeader($doc, $right);

        foreach ($order->items as $index => $item) {
            $this->writeItem($doc, $item, $index + 1, $right);
        }

        $doc->line(48, $doc->y(), $right, $doc->y(), 0.6);
        $doc->moveY(-18);

        $this->writeTotals($doc, $order, $right);

        $doc->moveY(-10);
        $doc->ensureSpace(140);
        $doc->text(48, $doc->y(), 10, 'PAYMENT RECEIVED', true);
        $doc->moveY(-16);

        $paymentRows = [
            ['Payment method', 'Cash on Delivery'],
            ['Amount due', $this->money($payment->amount_due)],
            ['Amount collected', $this->money($payment->amount_collected)],
            ['Amount remaining', $this->money($payment->amount_remaining)],
            ['Received by', $payment->received_by ?? '—'],
            ['Collected at', $payment->collected_at?->format('d M Y H:i') ?? '—'],
            ['Payment status', $payment->status->value],
        ];

        foreach ($paymentRows as [$label, $value]) {
            $doc->text(48, $doc->y(), 9, $label);
            $doc->text(200, $doc->y(), 9, $value, $label === 'Amount collected');
            $doc->moveY(-14);
        }

        if ($payment->note !== null && $payment->note !== '') {
            $doc->moveY(-4);
            $doc->text(48, $doc->y(), 10, 'NOTE', true);
            $doc->moveY(-14);

            foreach ($this->wrap($payment->note, 95) as $line) {
                $doc->write($line, 9, false, 48, 13);
            }
        }

        $doc->moveY(-18);
        $doc->line(48, $doc->y(), 260, $doc->y(), 0.5);
        $doc->line(330, $doc->y(), $right, $doc->y(), 0.5);
        $doc->moveY(-12);
        $doc->text(48, $doc->y(), 8, 'Customer signature');
        $doc->text(330, $doc->y(), 8, 'Receiver signature');

        $doc->moveY(-22);
        $doc->write(
            'This receipt confirms full cash payment for the delivered order. Partial payment is not accepted.',
            8,
            false,
            48,
            12,
        );

        return $doc->output();
    }

    private function writeTableHeader(SimplePdfDocument $doc, float $right): void
    {
        $y = $doc->y();

        $doc->text(48, $y, 8, '#', true);
        $doc->text(68, $y, 8, 'ITEM', true);
        $doc->text(370, $y, 8, 'QTY', true);
        $doc->text(410, $y, 8, 'UNIT PRICE', true);
        $doc->text(490, $y, 8, 'LINE TOTAL', true);
        $doc->line(48, $y - 5, $right, $y - 5, 0.5);
        $doc->setY($y - 18);
    }

    private function writeItem(SimplePdfDocument $doc, OrderItem $item, int $position, float $right): void
    {
        $detailLines = array_values(array_filter([
            $item->sku_snapshot !== null ? 'SKU '.$item->sku_snapshot : null,
            $item->specification_snapshot,
        ]));

        $nameLines = $this->wrap($item->product_name_snapshot, 44);
        $lineCount = count($nameLines) + count($detailLines);
        $rowHeight = max(30, $lineCount * 12 + 6);

        $previousPage = $doc->pageCount();
        $doc->ensureSpace($rowHeight);

        if ($doc->pageCount() !== $previousPage) {
            $this->writeTableHeader($doc, $right);
        }

        $top = $doc->y();
        $doc->text(48, $top, 9, (string) $position);
        $doc->text(370, $top, 9, (string) $item->quantity);
        $doc->text(410, $top, 9, $this->money($item->unit_price));
        $doc->text(490, $top, 9, $this->money($item->line_total), true);

        foreach ($nameLines as $index => $line) {
            $doc->text(68, $top - ($index * 12), 9, $line);
        }

        $detailStart = $top - (count($nameLines) * 12);

        foreach ($detailLines as $index => $line) {
            $doc->text(68, $detailStart - ($index * 11), 7.5, $this->truncate($line, 72));
        }

        $doc->setY($top - $rowHeight);
        $doc->line(48, $doc->y(), $right, $doc->y(), 0.25);
        $doc->moveY(-8);
    }

    private function writeTotals(SimplePdfDocument $doc, Order $order, float $right): void
    {
        $labelX = 360;
        $valueX = 500;

        $rows = [
            ['Subtotal', $this->money($order->subtotal), false],
            ['Discount', $this->money($order->discount), false],
            ['Delivery fee', $this->money($order->delivery_fee), false],
            [
                sprintf('Service fee (%d%%)', $order->service_fee_percentage),
                $this->money($order->service_fee),
                false,
            ],
            ['TOTAL (COD)', $this->money($order->total_amount), true],
        ];

        foreach ($rows as [$label, $value, $bold]) {
            $doc->text($labelX, $doc->y(), $bold ? 11 : 9, $label, $bold);
            $doc->text($valueX, $doc->y(), $bold ? 11 : 9, $value, $bold);
            $doc->moveY($bold ? -18 : -14);
        }
    }

    /**
     * @return list<string>
     */
    private function wrap(string $text, int $maxChars): array
    {
        $text = trim($text);

        if ($text === '') {
            return [''];
        }

        $words = preg_split('/\s+/', $text) ?: [];
        $lines = [];
        $current = '';

        foreach ($words as $word) {
            if ($current === '') {
                $current = $word;

                continue;
            }

            if (strlen($current) + 1 + strlen($word) <= $maxChars) {
                $current .= ' '.$word;

                continue;
            }

            $lines[] = $current;
            $current = $word;
        }

        if ($current !== '') {
            $lines[] = $current;
        }

        return array_map(fn (string $line): string => $this->truncate($line, $maxChars), $lines);
    }

    private function truncate(string $text, int $maxChars): string
    {
        return strlen($text) > $maxChars ? substr($text, 0, max($maxChars - 3, 0)).'...' : $text;
    }

    private function money(int $amount): string
    {
        return number_format($amount).' MMK';
    }

    /**
     * Keep stored paths predictable and free of traversal characters.
     */
    private function safeSegment(?string $value, string $fallback): string
    {
        $safe = preg_replace('/[^A-Za-z0-9_-]/', '_', (string) $value) ?? '';

        return $safe !== '' ? $safe : $fallback;
    }
}
