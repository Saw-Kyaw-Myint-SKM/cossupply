# Task 09 — Transactional Order Conversion and Supplier Confirmation

## Goal

Convert an accepted quotation version into exactly one order and run the supplier-confirmation workflow.

## Dependencies

- Task 03
- Task 08

## Scope

- Transactional quotation acceptance/order creation service.
- Row lock and one-order-per-quotation enforcement.
- Copy accepted quotation version items to immutable order items.
- Create delivery and COD cash-payment records.
- Create order-status history.
- Admin supplier-confirmation actions and statuses.
- Supplier unavailable/cancellation handling.

## Acceptance Criteria

- Concurrent accept requests create only one order.
- Failed transaction creates no partial order/payment/delivery records.
- Order begins `SUPPLIER_CONFIRMATION_REQUIRED`.
- Order customer ownership and customer snapshots are correct.
- Order items originate from accepted `quotation_version_items`, not original request items.
- Supplier-confirmed path is `ORDER_CONFIRMED → PREPARING`.

## References

- `specification/LogicFlow.md`
- `specification/StatusDefinitions.md`
- `specification/DatabaseFlow.md`
