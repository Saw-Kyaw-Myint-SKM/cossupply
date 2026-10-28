@extends('emails.layout')

@section('content')
    <p style="margin:0 0 12px;">Dear {{ $order->customer_name }},</p>

    <p style="margin:0 0 16px;">
        Order <strong>{{ $order->order_number }}</strong> is out for delivery.
    </p>

    <p style="margin:0 0 16px;padding:12px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;">
        Please prepare <strong>{{ number_format($order->total_amount) }} MMK</strong> in cash.
        Full payment on delivery is required; partial payment is not accepted.
    </p>

    <p style="margin:0;color:#4b5563;">
        Delivery address: {{ $order->delivery_address }},
        {{ $order->township ? $order->township.', ' : '' }}{{ $order->city }}
    </p>

    <p style="margin:20px 0 0;">Thank you,<br>CoSupply</p>
@endsection
