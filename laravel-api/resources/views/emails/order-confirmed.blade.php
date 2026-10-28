@extends('emails.layout')

@section('content')
    <p style="margin:0 0 12px;">Dear {{ $order->customer_name }},</p>

    <p style="margin:0 0 16px;">
        Your order <strong>{{ $order->order_number }}</strong> is confirmed with the supplier
        and is now being prepared.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;border-top:1px dashed #d1d5db;">
        <tr>
            <td style="padding:6px 0;color:#4b5563;">Items</td>
            <td align="right" style="padding:6px 0;">{{ $order->items->count() }}</td>
        </tr>
        <tr>
            <td style="padding:6px 0;color:#4b5563;">Total (COD)</td>
            <td align="right" style="padding:6px 0;font-weight:700;">{{ number_format($order->total_amount) }} MMK</td>
        </tr>
    </table>

    <p style="margin:16px 0 0;color:#4b5563;">
        Delivery address: {{ $order->delivery_address }},
        {{ $order->township ? $order->township.', ' : '' }}{{ $order->city }}
    </p>

    <p style="margin:20px 0 0;">
        We will email you again when the order leaves for delivery.
        Payment is full cash on delivery.
    </p>

    <p style="margin:20px 0 0;">Thank you,<br>CoSupply</p>
@endsection
