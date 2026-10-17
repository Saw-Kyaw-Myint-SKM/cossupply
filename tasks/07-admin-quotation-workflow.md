# Task 07 — Admin Quotation Workflow, Service Fee, and PDF Builder

## Goal

Implement Admin processing of quotation requests, manual supplier contact logs, versioned Final Quotations, configurable service fees, PDF export, and email delivery.

## Dependencies

- Task 03
- Task 04
- Task 06

## Scope

- Admin quotation queue, assignment, filtering, and detail page.
- Group request items by supplier.
- Manual Viber/phone/email supplier communication log.
- Update supplier responses and confirmed price/stock/delivery data.
- Draft, create, edit, and send quotation versions.
- Create `quotation_version_items` and calculate totals server-side.
- Read default service-fee percentage from Master Setting `quotation_service_fee_percentage`.
- Allow Admin to override service-fee percentage per quotation version.
- Snapshot `service_fee_percentage` and calculated `service_fee` in each quotation version.
- Generate and download a version-specific quotation PDF.
- Enable Admin to manually share the downloaded PDF through Viber, Telegram, Email, or another channel.
- Supersede prior current version when sending newer version.
- Store email delivery status and provide an Admin resend operation.

## Acceptance Criteria

- Only authorized Admin can process requests, edit fees, generate PDFs, or send quotation versions.
- Every sent version has item snapshots, fee snapshots, totals, valid-until date, and COD terms.
- `service_fee = round(subtotal × service_fee_percentage / 100)` is calculated server-side.
- New drafts take default percentage from Master Settings; Admin can override it for that version.
- Changing Master Settings never modifies sent, accepted, superseded, or historical quotation fee values.
- `total_amount = subtotal - discount + delivery_fee + service_fee` is server-calculated.
- The PDF includes quotation number/version, customer/company details, item list, prices, discounts, delivery fee, service-fee percentage and amount, total, validity, COD terms, and admin note.
- A new quotation version creates a separate PDF; an old version PDF is never overwritten.
- Sending a newer version marks the older current version `SUPERSEDED` and clears `is_current`.
- Original customer request items are never overwritten by final quotation edits.
- Email failure does not roll back a sent quotation; resend is possible.

## References

- `specification/LogicFlow.md`
- `specification/DatabaseFlow.md`
- `specification/MoneyAndValidationRules.md`
