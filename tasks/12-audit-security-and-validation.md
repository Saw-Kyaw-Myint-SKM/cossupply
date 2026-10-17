# Task 12 — Audit, Security, and Validation Hardening

## Goal

Harden the system against authorization errors, invalid state changes, sensitive-file exposure, and incorrect money handling.

## Dependencies

- Tasks 02 through 11

## Scope

- Audit logging for documented admin operations and settings changes.
- Authorization tests for all customer-owned endpoints.
- State-transition validation service tests.
- Money calculation and full-payment validation tests.
- Upload validation and private-file authorization tests.
- API rate limiting and secure error response review where applicable.

## Acceptance Criteria

- Forbidden cross-customer access is tested for quotations, orders, receipts, and notifications.
- Invalid status transitions are rejected.
- Client-supplied totals/customer IDs cannot bypass server rules.
- Audit logs contain old/new data for selected sensitive changes.
- Private files cannot be accessed by URL guessing.
- No sensitive data or password hashes are exposed through APIs.

## References

- `specification/RolesPermissions.md`
- `specification/MoneyAndValidationRules.md`
- `specification/StatusDefinitions.md`
