# Task 02 — Authentication and Roles

## Goal

Implement secure Admin and Customer authentication, role separation, and ownership authorization.

## Dependencies

- Task 01

## Scope

- Customer registration, login, logout, authenticated profile retrieval.
- Admin login/logout and admin authorization middleware.
- Password hashing and validation.
- Customer and Admin route guards in React.
- Server-side ownership policies for customer resources.
- Ensure guest users cannot submit quotation requests or view quotation/order details.

## Acceptance Criteria

- Guest can browse catalog/cart but gets redirected to login/register when requesting quotation.
- Authenticated Customer can call only own quotation/order endpoints.
- Customer A cannot access Customer B data by changing an ID in URL/API request.
- Admin can access operational resources according to role.
- Plain-text passwords are never stored or returned.
- Token/OTP/guest quotation-link access is absent from MVP routes.

## References

- `specification/RolesPermissions.md`
- `specification/DatabaseFlow.md`
- `specification/TechnicalArchitecture.md`
