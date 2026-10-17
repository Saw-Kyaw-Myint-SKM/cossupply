# Task 10 — Delivery, Full COD Collection, and Receipts

## Goal

Implement delivery status updates, full COD collection, payment verification, and private receipts.

## Dependencies

- Task 03
- Task 09

## Scope

- Admin delivery detail and transitions.
- Full delivery only workflow.
- Cash collection entry, receipt-number generation, and verification.
- Private receipt file generation/storage/download.
- Customer order-detail and receipt access.
- Delivery failed, returned, and customer-refused-to-pay handling.

## Acceptance Criteria

- Partial delivery and partial payment are rejected.
- Cash collected requires delivered order, receipt number, and `amount_collected = amount_due`.
- Payment confirmed requires full collection and changes delivered order to `COMPLETED`.
- Customer can only view own delivery/receipt records.
- Receipt/proof files are private and authorization-protected.
- Status histories record operational changes.

## References

- `specification/LogicFlow.md`
- `specification/StatusDefinitions.md`
- `specification/MoneyAndValidationRules.md`
