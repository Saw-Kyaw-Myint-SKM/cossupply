# Task 11 — Email and In-App Notifications

## Goal

Implement synchronous email delivery, database-backed in-app notifications, 60-second React polling, delivery-status logging, and Admin resend operations for quotation and order events.

## Dependencies

- Task 02
- Task 03
- Task 07
- Task 09
- Task 10

## Scope

- Email templates for documented customer/admin events.
- Synchronous email sending from Laravel.
- Email delivery status and error recording.
- Laravel database notification records for Customer and Admin events.
- Authenticated notification APIs: unread count, paginated list, and mark-as-read.
- React app-root notification provider that polls the notification endpoint every 60 seconds while authenticated.
- Stop polling on logout and pause polling when browser tab is hidden.
- Notification badge and notification-center UI for Customer and Admin.
- Admin email-log list and resend actions.
- Email attachment/link strategy for quotation PDFs where required.

## Out of Scope

- WebSocket/realtime notifications
- Mobile push notifications
- Queue worker or scheduled delivery/retry jobs

## Acceptance Criteria

- Laravel stores in-app notification records in the database.
- Authenticated Customer/Admin can only read and mark own notifications.
- React polls the authenticated notification endpoint every 60 seconds while the user is authenticated.
- Polling is implemented once in an app-root provider/service, not once per page.
- Polling stops on logout and pauses when browser tab is hidden.
- Quotation sent/changed, order confirmed, out-for-delivery, payment-confirmed, and cancellation events create notifications according to the specification.
- Email failure is recorded and does not undo successful quotation/order/status changes.
- Authorized Admin can view delivery errors and resend an eligible email.
- No WebSocket/realtime notification connection exists in the React application.

## References

- `specification/LogicFlow.md`
- `specification/TechnicalArchitecture.md`
- `specification/DatabaseFlow.md`
