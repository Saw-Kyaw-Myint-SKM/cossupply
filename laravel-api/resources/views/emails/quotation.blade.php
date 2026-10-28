@extends('emails.layout')

@section('content')
    <p style="margin:0 0 12px;">Dear {{ $quotation->quotationRequest?->customer_name ?? 'Customer' }},</p>

    <p style="margin:0 0 16px;">
        Please find attached quotation <strong>{{ $quotation->quotation_number }}</strong>
        (version {{ $quotation->version }}) from CoSupply.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;border-top:1px dashed #d1d5db;">
        <tr>
            <td style="padding:6px 0;color:#4b5563;">Subtotal</td>
            <td align="right" style="padding:6px 0;">{{ number_format($quotation->subtotal) }} MMK</td>
        </tr>
        <tr>
            <td style="padding:6px 0;color:#4b5563;">Discount</td>
            <td align="right" style="padding:6px 0;">{{ number_format($quotation->discount) }} MMK</td>
        </tr>
        <tr>
            <td style="padding:6px 0;color:#4b5563;">Delivery fee</td>
            <td align="right" style="padding:6px 0;">{{ number_format($quotation->delivery_fee) }} MMK</td>
        </tr>
        <tr>
            <td style="padding:6px 0;color:#4b5563;">Service fee ({{ $quotation->service_fee_percentage }}%)</td>
            <td align="right" style="padding:6px 0;">{{ number_format($quotation->service_fee) }} MMK</td>
        </tr>
        <tr>
            <td style="padding:10px 0;border-top:1px solid #d1d5db;font-weight:700;">Total (COD)</td>
            <td align="right" style="padding:10px 0;border-top:1px solid #d1d5db;font-weight:700;">
                {{ number_format($quotation->total_amount) }} MMK
            </td>
        </tr>
    </table>

    <p style="margin:16px 0 0;color:#4b5563;">
        Valid until <strong>{{ $quotation->valid_until?->format('d M Y') ?? '-' }}</strong>.<br>
        Payment terms: {{ $quotation->payment_terms }}
    </p>

    @if ($quotation->admin_note)
        <p style="margin:16px 0 0;padding:12px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;">
            <strong>Note:</strong> {{ $quotation->admin_note }}
        </p>
    @endif

    <p style="margin:20px 0 0;">Open your CoSupply account to review and accept the quotation.</p>

    <p style="margin:20px 0 0;">Thank you,<br>CoSupply</p>
@endsection
