# Task 03 — Database, Statuses, and Master Settings

## Goal

Create the relational schema, required constraints, status enums/constants, audit foundation, and master settings.

## Dependencies

- Task 01
- Task 02

## Scope

- Create migrations/models for admins, customers, addresses, categories, suppliers, products, prices, stocks, quotation workflow, order workflow, payments, deliveries, notifications, settings, and audit logs.
- Enforce NOT NULL customer ownership for quotation requests and orders.
- Enforce unique quotation version and one-order-per-quotation constraints.
- Add status constants/state-transition service boundaries.
- Implement typed master settings CRUD for authorized Admin.
- Record setting changes in audit logs.

## Acceptance Criteria

- `quotation_requests.customer_id` and `orders.customer_id` cannot be null.
- `orders.quotation_id` is unique.
- `UNIQUE(quotation_request_id, version)` exists.
- Money values use integer fields/validation appropriate for MMK.
- Unsupported status transitions are rejected by server logic.
- Admin can manage the minimum documented settings.

## References

- `specification/DatabaseFlow.md`
- `specification/StatusDefinitions.md`
- `specification/MoneyAndValidationRules.md`
