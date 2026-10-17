# Task 06 — Customer Quotation Request

## Goal

Allow authenticated Customers to submit a quotation request from their cart with immutable request snapshots.

## Dependencies

- Task 02
- Task 03
- Task 05

## Scope

- Customer profile and address selection/entry.
- Authenticated quotation request API.
- Request/contact/delivery snapshot persistence.
- Original `quotation_items` snapshot creation.
- Quotation number generation.
- Customer success page and My Quotations list foundation.

## Acceptance Criteria

- Unauthenticated request returns unauthorized and frontend redirects to login.
- Request always uses authenticated `customer_id`, never a body-supplied customer ID.
- Request requires at least one valid cart item, name, phone, city, and delivery address.
- Product and display-price snapshots remain unchanged after source product updates.
- Successful request has `NEW` status and a unique quotation number.

## References

- `specification/LogicFlow.md`
- `specification/DatabaseFlow.md`
- `specification/MoneyAndValidationRules.md`
