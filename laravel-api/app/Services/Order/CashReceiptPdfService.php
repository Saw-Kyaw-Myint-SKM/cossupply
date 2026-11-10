<?php

namespace App\Services\Order;

use App\Enums\PaymentStatus;
use App\Models\CashPayment;
use App\Models\Order;
use App\Services\Pdf\PdfRenderer;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

/**
 * Renders the private COD cash receipt into local (non-public) storage.
 *
 * Receipts are only generated once the full COD amount has been collected.
 * The file path is stored on `cash_payments.receipt_file_path` and is never
 * exposed to clients; downloads go through authorization-protected routes.
 *
 * Rendering goes through mPDF so Burmese names and addresses are shaped
 * correctly; see {@see PdfRenderer}.
 */
class CashReceiptPdfService
{
    public function __construct(
        private readonly CashReceiptPdfTemplate $template,
        private readonly PdfRenderer $renderer,
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
     * Regenerate the receipt when it is missing or was written by the
     * retired Helvetica/WinAnsi engine, whose fonts dropped Burmese text.
     */
    public function ensureGenerated(CashPayment $payment): string
    {
        $existing = $payment->receipt_file_path;

        if ($existing !== null && $existing !== '' && $this->isCurrentFormat($existing)) {
            return $existing;
        }

        return $this->generate($payment);
    }

    /**
     * Whether the stored file is a PDF rendered by the current engine.
     *
     * The current renderer embeds a TrueType subset, while the old writer used
     * non-embedded base-14 fonts that cannot draw Myanmar characters.
     */
    private function isCurrentFormat(string $path): bool
    {
        $disk = Storage::disk('local');

        if (! $disk->exists($path)) {
            return false;
        }

        $contents = $disk->get($path);

        return is_string($contents)
            && str_starts_with($contents, '%PDF-')
            && str_contains($contents, '/Contents')
            && str_contains($contents, '/FontFile2');
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

        $generatedAt = now();
        $pdf = $this->renderer->render(
            $this->template->html($payment, $order, $generatedAt),
            $this->template->footer($generatedAt),
        );

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

    /**
     * Keep stored paths predictable and free of traversal characters.
     */
    private function safeSegment(?string $value, string $fallback): string
    {
        $safe = preg_replace('/[^A-Za-z0-9_-]/', '_', (string) $value) ?? '';

        return $safe !== '' ? $safe : $fallback;
    }
}
