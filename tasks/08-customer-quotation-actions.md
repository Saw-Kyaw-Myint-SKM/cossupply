# Task 08 — Customer Quotation View and Actions

## Goal

Allow authenticated Customers to view and act on their own current quotations.

## Dependencies

- Task 02
- Task 06
- Task 07

## Scope

- Customer dashboard and My Quotations list.
- Quotation detail view with version, products, pricing, delivery, validity, and COD terms.
- Mark viewed action.
- Accept, reject, and request-change actions.
- Ownership authorization and expiry validation.
- Request/quotation status transitions and action history.

## Acceptance Criteria

- Customer only sees quotation records belonging to own account.
- First viewing of current sent quotation moves quotation to `VIEWED` and request to `CUSTOMER_REVIEWING`.
- Change request saves customer note and moves request/quotation to `CHANGE_REQUESTED`.
- Expired, superseded, rejected, cancelled, or non-current quotations cannot be accepted.
- No token/OTP/email-link verification route exists for quotation access.

## References

- `specification/LogicFlow.md`
- `specification/StatusDefinitions.md`
- `specification/RolesPermissions.md`
