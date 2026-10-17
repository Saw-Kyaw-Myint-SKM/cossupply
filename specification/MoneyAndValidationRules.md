# CoSupply MVP Money and Validation Rules

## 1. Currency and Amounts

- All monetary values use Myanmar Kyat (`MMK`).
- Amounts are stored as integer values without decimal places.
- Negative amounts are not allowed unless a future credit/refund feature explicitly introduces them.

## 2. Quotation Formula

```text
line_total = (unit_price × quantity) - line_discount
subtotal = sum(line_total)
service_fee = round(subtotal × service_fee_percentage / 100)
total_amount = subtotal - quotation_discount + delivery_fee + service_fee
```

Rules:

- Every calculation must return an integer MMK value.
- `unit_price` must be greater than or equal to 0.
- `quantity` must be greater than 0 and meet the product MOQ.
- `discount`, `delivery_fee`, `service_fee_percentage`, and `service_fee` must be greater than or equal to 0.
- `total_amount` must not be negative.
- The server calculates all totals; the client must not be treated as a money source of truth.

## 3. Service Fee Percentage Rules

The quotation service fee is percentage-based and uses a master setting as the default.

```text
Master setting key: quotation_service_fee_percentage
Example master value: 5 means 5%
```

Rules:

1. Admin can create or edit `quotation_service_fee_percentage` in Master Settings.
2. When Admin creates a new quotation version, the system copies the current master setting value into that quotation version.
3. Admin can override the copied percentage for an individual quotation version.
4. Each quotation version stores its own `service_fee_percentage` and calculated `service_fee` as immutable snapshots after sending.
5. Changing the master setting affects only future quotation drafts/versions. It must not change a sent, accepted, superseded, or historical quotation.
6. Changing the individual quotation percentage recalculates `service_fee` and `total_amount` server-side before sending.
7. A service-fee override must be included in the audit log with the prior value, new value, and responsible Admin.

## 4. COD Full-Payment Rules

```text
amount_due = order.total_amount
amount_remaining = amount_due - amount_collected
```

- Payment method is always `CASH_ON_DELIVERY` in MVP.
- Partial payment is not allowed.
- `CASH_COLLECTED` and `PAYMENT_CONFIRMED` require:

```text
amount_collected = amount_due
amount_remaining = 0
receipt_number is present
```

- Payment confirmation changes order status to `COMPLETED` only when delivery status is `DELIVERED`.
- Customer refusal to pay must record a payment status, delivery outcome, responsible admin/receiver, and note.

## 5. Quotation Request Validation

- User must be an authenticated Customer.
- Cart must contain at least one item.
- Each item quantity must be at least the product MOQ.
- Product must be `PUBLISHED` and not `OUT_OF_STOCK`.
- Customer name, phone, city, and full delivery address are required.
- `customer_id` must be created from the authenticated account; it cannot be passed as an untrusted client value.
- Request contact/address fields are snapshots and remain unchanged if the profile changes later.

## 6. Quotation Version Validation

- A quotation version must contain at least one `quotation_version_item`.
- A quotation request may have multiple versions.
- `UNIQUE(quotation_request_id, version)` is required.
- Only one quotation per request may be current (`is_current = true`).
- Each quotation version must store the service fee percentage and calculated service fee snapshot.
- Sending a new current quotation supersedes the prior current quotation.
- Only the current quotation with status `SENT` or `VIEWED`, and `valid_until >= now`, can be accepted.
- Expiry must be checked by the API at read/accept time because MVP has no scheduler.

## 7. Order Conversion Validation

- Customer must own the quotation request through authenticated `customer_id`.
- Quotation must be current, valid, and in `SENT` or `VIEWED` state.
- `orders.quotation_id` is unique; one quotation version creates at most one order.
- Conversion runs in one database transaction using a row lock on the quotation.
- Order snapshots must include the accepted quotation's `service_fee_percentage` and `service_fee`.
- Order item snapshots must come from `quotation_version_items`, not original `quotation_items`.

## 8. Quotation PDF Validation

- Admin can generate a PDF from any quotation version.
- The PDF must use quotation version snapshot data, not current product/supplier values.
- PDF must include quotation number, version, customer/company details, item list, unit prices, discounts, delivery fee, service-fee percentage and amount, total amount, validity, COD terms, and admin note.
- PDF can be downloaded from Admin and used for manual sharing through Viber, Telegram, Email, or another manual channel.
- A generated PDF must identify its quotation version and generation time.
- If a sent quotation changes, Admin must create a new version and generate a new PDF; old PDFs must not be overwritten.

## 9. File Upload Validation

Public image uploads:

- Allow approved image types only.
- Enforce maximum file size.
- Generate/compress display-safe image formats where possible.

Private uploads:

- Allow approved document/image types only.
- Store outside public storage.
- Require authorization before download/streaming.
- Log admin action for sensitive uploaded files.
