<?php

namespace App\Services\Notification;

use App\Enums\EmailType;
use App\Models\EmailLog;
use App\Models\Order;
use App\Models\Quotation;
use App\Models\QuotationPdf;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Mail\Message;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Sends the documented transactional emails synchronously (LogicFlow §14)
 * and records every attempt in `email_logs`.
 *
 * Mail failure never throws: the delivery failure is stored so the business
 * record stays committed and an Admin can resend the email from the email
 * log. Every send method is safe to call after the business transaction.
 */
class EmailNotificationService
{
    /**
     * Revise and resend a previously attempted email.
     */
    public function resend(EmailLog $log): EmailLog
    {
        $type = EmailType::tryFrom($log->email_type);

        if ($type === null) {
            throw ValidationException::withMessages([
                'email_log' => ['This email type cannot be resent.'],
            ]);
        }

        if ($type === EmailType::QUOTATION_SENT) {
            $quotation = Quotation::query()->find($log->related_id);

            if ($quotation === null || $quotation->sent_at === null) {
                throw ValidationException::withMessages([
                    'email_log' => ['This quotation email can no longer be resent.'],
                ]);
            }

            return $this->sendQuotation($quotation, true);
        }

        $order = $log->related_type === Order::class
            ? Order::query()->find($log->related_id)
            : null;

        if ($order === null) {
            throw ValidationException::withMessages([
                'email_log' => ['This order email can no longer be resent.'],
            ]);
        }

        return match ($type) {
            EmailType::ORDER_CONFIRMED => $this->sendOrderConfirmed($order),
            EmailType::ORDER_OUT_FOR_DELIVERY => $this->sendOrderOutForDelivery($order),
            EmailType::PAYMENT_CONFIRMED => $this->sendPaymentConfirmed($order),
            EmailType::ORDER_CANCELLED => $this->sendOrderCancelled($order),
            default => throw ValidationException::withMessages([
                'email_log' => ['This email type cannot be resent.'],
            ]),
        };
    }

    public function sendQuotation(Quotation $quotation, bool $resend = false): EmailLog
    {
        $quotation->loadMissing(['quotationRequest', 'pdfs']);
        $request = $quotation->quotationRequest;
        $recipient = trim((string) $request?->email);
        $subject = sprintf(
            '%sQuotation %s (version %d)',
            $resend ? 'Resent: ' : '',
            $quotation->quotation_number,
            $quotation->version,
        );

        $pdf = $quotation->pdfs->sortByDesc('generated_at')->first();

        return $this->deliver(
            view: 'emails.quotation',
            data: ['quotation' => $quotation],
            recipient: $recipient,
            subject: $subject,
            type: EmailType::QUOTATION_SENT,
            related: $quotation,
            pdf: $pdf,
            error: $recipient === ''
                ? 'The customer has no email address on this quotation request.'
                : null,
        );
    }

    public function sendOrderConfirmed(Order $order): EmailLog
    {
        $order->loadMissing('items');

        return $this->deliver(
            view: 'emails.order-confirmed',
            data: ['order' => $order],
            recipient: trim((string) $order->email),
            subject: sprintf('Order %s confirmed', $order->order_number),
            type: EmailType::ORDER_CONFIRMED,
            related: $order,
            error: trim((string) $order->email) === ''
                ? 'The order has no customer email address.'
                : null,
        );
    }

    public function sendOrderOutForDelivery(Order $order): EmailLog
    {
        $order->loadMissing('items');

        return $this->deliver(
            view: 'emails.order-out-for-delivery',
            data: ['order' => $order],
            recipient: trim((string) $order->email),
            subject: sprintf('Order %s is out for delivery', $order->order_number),
            type: EmailType::ORDER_OUT_FOR_DELIVERY,
            related: $order,
            error: trim((string) $order->email) === ''
                ? 'The order has no customer email address.'
                : null,
        );
    }

    public function sendPaymentConfirmed(Order $order): EmailLog
    {
        $order->loadMissing(['items', 'cashPayment']);

        return $this->deliver(
            view: 'emails.payment-confirmed',
            data: ['order' => $order],
            recipient: trim((string) $order->email),
            subject: sprintf('Payment confirmed for order %s', $order->order_number),
            type: EmailType::PAYMENT_CONFIRMED,
            related: $order,
            error: trim((string) $order->email) === ''
                ? 'The order has no customer email address.'
                : null,
        );
    }

    public function sendOrderCancelled(Order $order): EmailLog
    {
        $order->loadMissing('items');

        return $this->deliver(
            view: 'emails.order-cancelled',
            data: ['order' => $order],
            recipient: trim((string) $order->email),
            subject: sprintf('Order %s cancelled', $order->order_number),
            type: EmailType::ORDER_CANCELLED,
            related: $order,
            error: trim((string) $order->email) === ''
                ? 'The order has no customer email address.'
                : null,
        );
    }

    /**
     * Render, send and log one email attempt.
     *
     * @param  array<string, mixed>  $data
     */
    private function deliver(
        string $view,
        array $data,
        string $recipient,
        string $subject,
        EmailType $type,
        Model $related,
        ?QuotationPdf $pdf = null,
        ?string $error = null,
    ): EmailLog {
        if ($error !== null) {
            return $this->record($related, $type, $recipient, $subject, 'FAILED', null, $error);
        }

        try {
            Mail::send($view, $data, function (Message $message) use ($recipient, $subject, $pdf): void {
                $message->to($recipient)->subject($subject);

                if ($pdf !== null && Storage::disk('local')->exists($pdf->file_path)) {
                    $message->attach(Storage::disk('local')->path($pdf->file_path), [
                        'as' => $pdf->file_name,
                        'mime' => 'application/pdf',
                    ]);
                }
            });

            return $this->record($related, $type, $recipient, $subject, 'SENT', now(), null);
        } catch (Throwable $exception) {
            return $this->record(
                $related,
                $type,
                $recipient,
                $subject,
                'FAILED',
                null,
                substr($exception->getMessage(), 0, 2000),
            );
        }
    }

    private function record(
        Model $related,
        EmailType $type,
        string $recipient,
        string $subject,
        string $status,
        mixed $sentAt,
        ?string $error,
    ): EmailLog {
        $log = new EmailLog;
        $log->forceFill([
            'recipient_email' => $recipient !== '' ? $recipient : 'unknown@example.invalid',
            'related_type' => $related::class,
            'related_id' => $related->getKey(),
            'email_type' => $type->value,
            'subject' => $subject,
            'status' => $status,
            'sent_at' => $sentAt,
            'error_message' => $error,
        ])->save();

        return $log->refresh();
    }
}
