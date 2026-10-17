# CoSupply MVP Implementation Tasks

## Confirmed Scope

- Laravel REST API + React SPA (Tailwind CSS, React Router)
- API-first design for future mobile app
- Domain: `cos.shop`; API: `api.cos.shop`
- Guest can browse and use cart only
- Authenticated Customer can submit quotation request and access only own quotation/order
- No direct order; accepted current valid quotation creates an order
- MMK integer amounts; full COD payment only
- No partial payment or partial delivery
- Laravel local file storage
- Email + in-app notification with 60-second polling
- No token/OTP quotation flow, queue, scheduler, realtime WebSocket, S3/R2 in MVP

## Implementation Sequence

1. `01-project-foundation.md`
2. `02-authentication-and-roles.md`
3. `03-database-and-settings.md`
4. `04-catalog-and-media.md`
5. `05-public-catalog-and-cart.md`
6. `06-customer-quotation-request.md`
7. `07-admin-quotation-workflow.md`
8. `08-customer-quotation-actions.md`
9. `09-order-and-supplier-confirmation.md`
10. `10-delivery-cod-and-receipts.md`
11. `11-notifications-and-email.md`
12. `12-audit-security-and-validation.md`
13. `13-testing-and-deployment.md`

## Global Definition of Done

Each task is complete only when:

- API authorization and validation are implemented server-side.
- Relevant database constraints/migrations exist.
- React UI handles loading, empty, validation-error, and permission-error states.
- Relevant unit/feature tests pass.
- No confirmed MVP rule is bypassed by a direct API request.
