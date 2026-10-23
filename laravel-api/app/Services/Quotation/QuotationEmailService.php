<?php

namespace App\Services\Quotation;

use App\Models\EmailLog;
use App\Models\Quotation;
use Illuminate\Mail\Message;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Throwable;

/**
 * Sends quotation emails synchronously and records every attempt.
 *
 * Delivery failure never throws: it is written to `email_logs` so the
 * quotation remains sent and the Admin can retry with the resend action.
 */
class QuotationEmailService
{
    public function send(Quotation $quotation, bool $resend = false): EmailLog
    {
        $quotation->loadMissing(['quotationRequest', 'pdfs']);
        $request = $quotation->quotationRequest;
        $recipient = trim((string) $request->email);
        $subject = sprintf(
            '%sQuotation %s (version %d)',
            $resend ? 'Resent: ' : '',
            $quotation->quotation_number,
            $quotation->version,
        );

        if ($recipient === '') {
            return $this->record(
                $quotation,
                '',
                $subject,
                'FAILED',
                null,
                'The customer has no email address on this quotation request.',
            );
        }

        $pdf = $quotation->pdfs->sortByDesc('generated_at')->first();

        try {
            Mail::raw($this->body($quotation), function (Message $message) use ($recipient, $subject, $pdf): void {
                $message->to($recipient)->subject($subject);

                if ($pdf !== null && Storage::disk('local')->exists($pdf->file_path)) {
                    $message->attach(Storage::disk('local')->path($pdf->file_path), [
                        'as' => $pdf->file_name,
                        'mime' => 'application/pdf',
                    ]);
                }
            });

            return $this->record($quotation, $recipient, $subject, 'SENT', now(), null);
        } catch (Throwable $exception) {
            return $this->record(
                $quotation,
                $recipient,
                $subject,
                'FAILED',
                null,
                substr($exception->getMessage(), 0, 2000),
            );
        }
    }

    private function body(Quotation $quotation): string
    {
        $request = $quotation->quotationRequest;

        $lines = [
            'Dear '.$request->customer_name.',',
            '',
            sprintf(
                'Please find attached quotation %s (version %d) from CoSupply.',
                $quotation->quotation_number,
                $quotation->version,
            ),
            '',
            'Subtotal: '.number_format($quotation->subtotal).' MMK',
            'Discount: '.number_format($quotation->discount).' MMK',
            'Delivery fee: '.number_format($quotation->delivery_fee).' MMK',
            sprintf(
                'Service fee (%d%%): %s MMK',
                $quotation->service_fee_percentage,
                number_format($quotation->service_fee),
            ),
            'Total (Cash on Delivery): '.number_format($quotation->total_amount).' MMK',
            'Valid until: '.($quotation->valid_until?->format('d M Y') ?? '-'),
            '',
            'Payment terms: '.$quotation->payment_terms,
        ];

        if ($quotation->admin_note !== null && $quotation->admin_note !== '') {
            $lines[] = '';
            $lines[] = 'Note: '.$quotation->admin_note;
        }

        $lines[] = '';
        $lines[] = 'Thank you,';
        $lines[] = 'CoSupply';

        return implode("\n", $lines);
    }

    private function record(
        Quotation $quotation,
        string $recipient,
        string $subject,
        string $status,
        mixed $sentAt,
        ?string $error,
    ): EmailLog {
        $log = new EmailLog;
        $log->forceFill([
            'recipient_email' => $recipient !== '' ? $recipient : 'unknown@example.invalid',
            'related_type' => Quotation::class,
            'related_id' => $quotation->id,
            'email_type' => 'QUOTATION_SENT',
            'subject' => $subject,
            'status' => $status,
            'sent_at' => $sentAt,
            'error_message' => $error,
        ])->save();

        return $log->refresh();
    }
}
