@extends('emails.layout')

@section('content')
    <p style="margin:0 0 12px;">Dear {{ $order->customer_name }},</p>

    <p style="margin:0 0 16px;">
        Order <strong>{{ $order->order_number }}</strong> has been cancelled.
    </p>

    <p style="margin:0 0 16px;color:#4b5563;">
        If you did not expect this, or you would like to place a new request,
        please contact our team over Viber.
    </p>

    <p style="margin:20px 0 0;">Thank you,<br>CoSupply</p>
@endsection
