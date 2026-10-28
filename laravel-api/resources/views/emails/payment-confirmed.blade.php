@extends('emails.layout')

@section('content')
    <p style="margin:0 0 12px;">Dear {{ $order->customer_name }},</p>

    <p style="margin:0 0 16px;">
        We received the full COD payment for order <strong>{{ $order->order_number }}</strong>.
        The order is complete.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;border-top:1px dashed #d1d5db;">
        <tr>
            <td style="padding:6px 0;color:#4b5563;">Amount paid</td>
            <td align="right" style="padding:6px 0;font-weight:700;">{{ number_format($order->total_amount) }} MMK</td>
        </tr>
        @if ($order->cashPayment?->receipt_number)
            <tr>
                <td style="padding:6px 0;color:#4b5563;">Receipt number</td>
                <td align="right" style="padding:6px 0;">{{ $order->cashPayment->receipt_number }}</td>
            </tr>
        @endif
    </table>

    <p style="margin:20px 0 0;">
        Your receipt is available from the order page in your CoSupply account.
    </p>

    <p style="margin:20px 0 0;">Thank you for your business,<br>CoSupply</p>
@endsection
