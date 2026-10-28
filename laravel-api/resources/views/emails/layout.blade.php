<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $subject ?? 'CoSupply' }}</title>
</head>
<body style="margin:0;padding:0;background:#f6f5f2;color:#1f2937;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f5f2;padding:24px 12px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                    <tr>
                        <td style="padding:20px 24px;border-bottom:1px solid #e5e7eb;">
                            <span style="font-size:20px;font-weight:700;color:#111827;">Co<span style="color:#b45309;">Supply</span></span>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:24px;font-size:14px;line-height:1.6;">
                            @yield('content')
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:16px 24px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;">
                            CoSupply — office supplies for Myanmar, sold on a quotation basis.
                            Cash on delivery, full payment only.
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
