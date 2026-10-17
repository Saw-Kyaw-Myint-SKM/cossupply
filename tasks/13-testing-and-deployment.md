# Task 13 — Testing and Deployment

## Goal

Validate the MVP end-to-end and prepare it for deployment to `cos.shop` and `api.cos.shop`.

## Dependencies

- Tasks 01 through 12

## Scope

- Backend unit/feature tests for critical workflows.
- Frontend route/access smoke tests.
- End-to-end scenario validation.
- cPanel deployment checklist.
- Environment configuration and secret handling.
- Storage-link, writable-directory, database migration, HTTPS, CORS, and backup checks.

## Required End-to-End Scenarios

1. Guest browses products, creates cart, is redirected to login when requesting quotation.
2. Customer registers/logs in and submits quotation request.
3. Admin contacts supplier, creates and sends quotation version.
4. Customer sees notification, views own quotation, requests change.
5. Admin sends superseding version.
6. Customer accepts latest valid version; exactly one order is created.
7. Admin confirms supplier, delivers full order, records full COD amount, confirms payment, and order completes.
8. Customer cannot access another customer quotation/order/receipt/notification.

## Acceptance Criteria

- All critical scenario tests pass.
- No scheduler or long-running queue process is required for core MVP behavior.
- Laravel public directory and file permissions work on cPanel.
- HTTPS and CORS work for `cos.shop` → `api.cos.shop`.
- Local storage backup process is documented before production launch.

## References

- All files under `specification/`
- All previous task files
