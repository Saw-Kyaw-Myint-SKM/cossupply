# Task 05 — Public Catalog and Guest Cart

## Goal

Build the mobile-first public product browsing experience and guest-capable cart.

## Dependencies

- Task 01
- Task 04

## Scope

- Home, category, product-list, and product-detail pages.
- Search and filters for category, supplier, product name, and stock where applicable.
- Lazy-loaded/compressed product media display.
- Browser-local guest cart.
- MOQ validation in cart.
- Login/register redirect when guest selects Request Quotation.

## Acceptance Criteria

- Guest can browse only published products.
- Guest can add available products to cart and update quantities respecting MOQ.
- Out-of-stock products cannot enter cart.
- Display price is labelled as non-final/final confirmation required.
- Guest cannot create quotation request from direct API or frontend flow.

## References

- `specification/BusinessRequirements.md`
- `specification/LogicFlow.md`
- `specification/RolesPermissions.md`
