# Task 04 — Catalog, Suppliers, Products, and Media

## Goal

Implement admin management of categories, suppliers, products, prices, stock, and local media files.

## Dependencies

- Task 02
- Task 03

## Scope

- Category CRUD including parent/subcategory support.
- Supplier CRUD with Active/Inactive/Suspended rules.
- Product CRUD, draft/publish/hide/out-of-stock statuses.
- Price/MOQ and stock management.
- Public image uploads to Laravel public storage.
- Supplier logo and category image upload.
- Private file service pattern for sensitive attachments.

## Acceptance Criteria

- Product cannot be published without valid supplier/category and price > 0.
- Inactive/suspended supplier cannot publish new product.
- Out-of-stock product cannot be added to cart.
- Images enforce type/size limits and use expected public paths.
- Sensitive file routes require authorization and do not expose public storage URLs.

## References

- `specification/BusinessRequirements.md`
- `specification/DatabaseFlow.md`
- `specification/MoneyAndValidationRules.md`
