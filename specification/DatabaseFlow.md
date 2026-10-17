# CoSupply Database Flow

## 1. Core Relationship

```text
admins
  └── creates suppliers, categories, products, quotations, status updates

customers
  ├── has customer_addresses
  ├── submits quotation_requests
  ├── owns quotations, orders and notifications
  └── authenticates before submitting a quotation request

suppliers
  └── has products

quotation_requests
  ├── has original quotation_items
  ├── has supplier_communications
  └── produces quotation versions

quotations
  ├── has quotation_version_items
  └── accepted quotation version produces one order

orders
  ├── has order_items
  ├── has deliveries
  ├── has cash_payments
  └── has order_status_histories
```

## 2. Data Model Principles

1. Guest သည် Cart သုံးနိုင်သော်လည်း Quotation Request တင်မရ။ `quotation_requests.customer_id` သည် NOT NULL ဖြစ်ရမည်။
2. `quotation_items` သည် Customer ၏ original request item snapshot ဖြစ်သည်။
3. `quotation_version_items` သည် Admin ပို့သော Final Quotation version snapshot ဖြစ်သည်။
4. `order_items` သည် Customer Accept လုပ်ခဲ့သော quotation version ၏ immutable snapshot ဖြစ်သည်။
5. Price နှင့် money amount များကို MMK integer အဖြစ် သိမ်းရမည်။ Decimal မသုံးရ။
6. Order တစ်ခုသည် quotation version တစ်ခုမှသာ ဖြစ်ရမည်။ `orders.quotation_id` ကို unique ထားရမည်။

## 3. Tables

### `admins`

```text
id PK
name
email UNIQUE
phone
password_hash
role
status
last_login_at
created_at
updated_at
```

### `customers`

Customer သည် register/login ဝင်ပြီးမှ Quotation Request တင်နိုင်သည်။ Phone ကို primary login/contact identifier အဖြစ် အသုံးပြုနိုင်ပြီး email သည် optional ဖြစ်သည်။

```text
id PK
name
company_name NULL
email NULL
phone UNIQUE
password_hash NOT NULL
customer_type
status
email_verified_at NULL
phone_verified_at NULL
created_at
updated_at
```

### `customer_addresses`

```text
id PK
customer_id FK -> customers.id
contact_name
phone
city
township
ward NULL
street NULL
building_no NULL
landmark NULL
full_address
is_default
created_at
updated_at
```

### `categories`

```text
id PK
parent_id NULL FK -> categories.id
name_mm
name_en
slug UNIQUE
description NULL
image NULL
sort_order
status
created_at
updated_at
```

### `suppliers`

Supplier ကို Admin ကသာ ဖန်တီးမည်။ Supplier login မပါသေးပါ။

```text
id PK
shop_name
company_name NULL
contact_person
phone
viber_phone NULL
email NULL
logo NULL
address
city
township NULL
business_description NULL
delivery_area NULL
delivery_time NULL
warranty_policy NULL
return_policy NULL
status
verified
created_by_admin_id FK -> admins.id
created_at
updated_at
```

### `products`

```text
id PK
supplier_id FK -> suppliers.id
category_id FK -> categories.id
name_mm
name_en NULL
slug UNIQUE
sku NULL
brand NULL
model NULL
description NULL
specification NULL
size NULL
color NULL
unit
package_size NULL
photo
status
created_by_admin_id FK -> admins.id
created_at
updated_at
```

### `product_prices`

All amounts are MMK integers.

```text
id PK
product_id FK -> products.id
retail_price
wholesale_price NULL
discount_price NULL
minimum_order_quantity DEFAULT 1
price_valid_until NULL
last_updated_at
updated_by_admin_id FK -> admins.id
```

### `product_stocks`

```text
id PK
product_id FK -> products.id
supplier_id FK -> suppliers.id
stock_quantity NULL
stock_status
last_confirmed_at NULL
confirmed_by_admin_id NULL FK -> admins.id
supplier_note NULL
created_at
updated_at
```

### `quotation_requests`

Customer contact နှင့် delivery data ကို request အချိန်၏ snapshot အဖြစ် သိမ်းရမည်။ Guest request မခွင့်ပြုသောကြောင့် `customer_id` သည် NOT NULL ဖြစ်ရမည်။

```text
id PK
quotation_number UNIQUE
customer_id NOT NULL FK -> customers.id
customer_name
company_name NULL
phone
email NULL
delivery_address
city
township NULL
landmark NULL
required_delivery_date NULL
customer_note NULL
status
assigned_admin_id NULL FK -> admins.id
created_at
updated_at
```

### `quotation_items`

Customer က Cart မှ ပထမဆုံးတောင်းထားသော original request item snapshot ဖြစ်သည်။ Final quotation နှင့် order အတွက် source of truth မဟုတ်ပါ။

```text
id PK
quotation_request_id FK -> quotation_requests.id
product_id FK -> products.id
supplier_id FK -> suppliers.id
product_name_snapshot
specification_snapshot NULL
quantity
display_price NULL
stock_status NULL
created_at
updated_at
```

### `supplier_communications`

Viber ကို API ဖြင့် မချိတ်သေးဘဲ Admin က Copy Message/Open Viber လုပ်ပြီး ရရှိသော response ကို မှတ်တမ်းတင်မည်။ Attachment ကို private Laravel storage တွင် သိမ်းရမည်။

```text
id PK
quotation_request_id FK -> quotation_requests.id
supplier_id FK -> suppliers.id
admin_id FK -> admins.id
contact_method
message_text NULL
supplier_response NULL
attachment_path NULL
contacted_at
responded_at NULL
created_at
```

### `quotations`

Quotation Request တစ်ခုတွင် Version များ ရှိနိုင်သည်။ Latest current version တစ်ခုတည်းသာ Customer Accept လုပ်နိုင်သည်။

```text
id PK
quotation_request_id FK -> quotation_requests.id
quotation_number
version DEFAULT 1
status
is_current DEFAULT false
subtotal
discount DEFAULT 0
delivery_fee DEFAULT 0
service_fee_percentage DEFAULT 0
service_fee DEFAULT 0
total_amount
payment_method DEFAULT 'CASH_ON_DELIVERY'
payment_terms
valid_until
admin_note NULL
sent_at NULL
viewed_at NULL
accepted_at NULL
rejected_at NULL
created_by_admin_id FK -> admins.id
created_at
updated_at
```

Constraints and rules:

```text
UNIQUE(quotation_request_id, version)
```

- `status` သည် `DRAFT`, `SENT`, `VIEWED`, `CHANGE_REQUESTED`, `ACCEPTED`, `REJECTED`, `EXPIRED`, `SUPERSEDED`, `CANCELLED` ထဲမှ တစ်ခုဖြစ်ရမည်။
- `is_current = true` ဖြစ်သော version တစ်ခုတည်းသာ request တစ်ခုအတွက်ရှိရမည်။ ဒီ rule ကို transaction + row lock ဖြင့် enforce လုပ်ရမည်။
- `total_amount = subtotal - discount + delivery_fee + service_fee` ဖြစ်ရမည်။
- `service_fee_percentage` သည် Master Setting (`quotation_service_fee_percentage`) မှ default ယူရမည်။ Admin သည် quotation version တစ်ခုချင်းအလိုက် override လုပ်နိုင်ပြီး sent version တွင် percentage နှင့် amount ကို snapshot အဖြစ် သိမ်းရမည်။

### `quotation_version_items`

Admin က Customer ထံပို့သော Final Quotation version item snapshot ဖြစ်သည်။ Accepted version ၏ item များမှသာ `order_items` ကို copy လုပ်ရမည်။

```text
id PK
quotation_id FK -> quotations.id
product_id NULL FK -> products.id
supplier_id NULL FK -> suppliers.id
product_name_snapshot
sku_snapshot NULL
specification_snapshot NULL
quantity
unit_price
discount DEFAULT 0
line_total
delivery_date NULL
warranty_note NULL
supplier_note NULL
created_at
updated_at
```

### `quotation_pdfs`

Admin generates a version-specific PDF for manual sharing through Viber, Telegram, Email, or another channel. PDF data must use the quotation version snapshot.

```text
id PK
quotation_id FK -> quotations.id
file_path
file_name
generated_by_admin_id FK -> admins.id
generated_at
created_at
```

Rules:

- A PDF belongs to one quotation version.
- Old quotation-version PDFs must not be overwritten when a new version is created.
- Admin can download the PDF for manual sharing.

### `quotation_actions`

```text
id PK
quotation_id FK -> quotations.id
action
customer_note NULL
actor_type
actor_id NULL
ip_address NULL
created_at
```

### `orders`

Quotation ကို Accept လုပ်ပြီးမှ ဖန်တီးမည်။ `customer_id` နှင့် `quotation_id` သည် NOT NULL ဖြစ်ရမည်။ Order တွင် accepted quotation snapshot ကို အခြေခံပြီး total မပြောင်းစေရ။

```text
id PK
order_number UNIQUE
quotation_id NOT NULL UNIQUE FK -> quotations.id
quotation_request_id NOT NULL FK -> quotation_requests.id
customer_id NOT NULL FK -> customers.id
customer_name
company_name NULL
phone
email NULL
delivery_address
city
township NULL
landmark NULL
subtotal
discount DEFAULT 0
delivery_fee DEFAULT 0
service_fee_percentage DEFAULT 0
service_fee DEFAULT 0
total_amount
payment_method DEFAULT 'CASH_ON_DELIVERY'
payment_status
order_status
delivery_status
customer_note NULL
created_at
updated_at
```

### `order_items`

```text
id PK
order_id FK -> orders.id
product_id NULL FK -> products.id
supplier_id NULL FK -> suppliers.id
product_name_snapshot
sku_snapshot NULL
specification_snapshot NULL
quantity
unit_price
discount DEFAULT 0
line_total
created_at
updated_at
```

> MVP တွင် partial delivery မရှိသောကြောင့် `delivered_quantity` နှင့် `returned_quantity` fields မလိုအပ်ပါ။ Future partial delivery module တွင်သာ ထည့်မည်။

### `deliveries`

MVP တွင် Order တစ်ခုကို full delivery တစ်ကြိမ်သာပို့မည်။

```text
id PK
order_id FK -> orders.id
supplier_id NULL FK -> suppliers.id
delivery_contact_name
delivery_phone
delivery_address
city
township NULL
landmark NULL
delivery_fee DEFAULT 0
delivery_partner NULL
tracking_number NULL
estimated_delivery_date NULL
shipped_at NULL
delivered_at NULL
received_by NULL
customer_note NULL
delivery_status
created_at
updated_at
```

### `cash_payments`

MVP တွင် full COD payment only ဖြစ်သည်။ Sensitive proof/signature/receipt file များကို private Laravel storage တွင် သိမ်းရမည်။

```text
id PK
order_id FK -> orders.id
delivery_id NULL FK -> deliveries.id
receipt_number UNIQUE
amount_due
amount_collected DEFAULT 0
amount_remaining
received_by NULL
collected_at NULL
customer_name NULL
customer_signature_path NULL
receipt_file_path NULL
note NULL
status
created_at
updated_at
```

Rules:

```text
amount_due = orders.total_amount
amount_remaining = amount_due - amount_collected
CASH_COLLECTED/PAYMENT_CONFIRMED requires amount_collected = amount_due
```

### `order_status_histories`

```text
id PK
order_id FK -> orders.id
old_status NULL
new_status
changed_by_type
changed_by_id NULL
note NULL
created_at
```

### `notifications`

Laravel stores in-app notification records in this table. React polls the authenticated notification API every 60 seconds while the user is logged in. Email delivery is tracked separately in `email_logs`.

```text
id PK
recipient_type
recipient_id
customer_id NULL FK -> customers.id
admin_id NULL FK -> admins.id
quotation_id NULL FK -> quotations.id
order_id NULL FK -> orders.id
type
title
message
data NULL
is_read DEFAULT false
read_at NULL
created_at
updated_at
```

Rules:

- `recipient_type` is `CUSTOMER` or `ADMIN`.
- `recipient_id` is required and must match the recipient type.
- API returns only the authenticated recipient's notifications.
- API supports unread count, paginated list, and mark-as-read action.

### `email_logs`

Unified log for synchronous email delivery and Admin resend actions.

```text
id PK
recipient_email
related_type
related_id
email_type
subject
status
sent_at NULL
error_message NULL
created_at
updated_at
```

### `settings`

Master setting များကို typed key/value model ဖြင့် သိမ်းမည်။ ပြောင်းလဲမှုတိုင်းကို audit log ထဲ မှတ်တမ်းတင်ရမည်။

```text
id PK
key UNIQUE
value
value_type
group_name
label
description NULL
is_public DEFAULT false
updated_by_admin_id NULL FK -> admins.id
created_at
updated_at
```

Minimum setting keys:

```text
company_name
company_phone
company_email
company_address
default_currency = MMK
timezone = Asia/Yangon
quotation_number_prefix = QT
quotation_validity_days = 7
quotation_service_fee_percentage = 0
order_number_prefix = ORD
default_delivery_fee = 0
delivery_fee_mode = MANUAL_PER_QUOTATION
payment_method = CASH_ON_DELIVERY
require_full_payment = true
require_receipt_number = true
```

### `audit_logs`

```text
id PK
admin_id FK -> admins.id
action
entity_type
entity_id
old_data NULL
new_data NULL
ip_address NULL
created_at
```

## 4. Main Foreign-Key and Integrity Rules

- `products.supplier_id` သည် Supplier မရှိပါက Product မဖန်တီးနိုင်စေရ။
- `quotation_requests.customer_id` သည် NOT NULL ဖြစ်ရမည်။ Guest quotation request မခွင့်ပြုရ။
- `quotation_items.supplier_id` သည် မူရင်း Product Supplier ကို snapshot အဖြစ် သိမ်းရမည်။
- `quotation_version_items` သည် Final Quotation version item snapshot ဖြစ်ရမည်။
- `order_items` ကို accepted `quotation_version_items` မှသာ copy လုပ်ရမည်။
- `orders.quotation_id` နှင့် `orders.customer_id` သည် မဖြစ်မနေရှိရမည်။ Direct Order မခွင့်ပြုရ။
- `orders.quotation_id` unique ဖြစ်ရမည်။
- `cash_payments.order_id` သည် Order တစ်ခုတည်းနှင့် ချိတ်ရမည်။
- Order total, quotation total, unit price များကို source record ပြောင်းလဲသော်လည်း မပြောင်းစေရ။
- Customer-facing APIs သည် authenticated customer ownership ကို server-side မှ စစ်ရမည်။

## 5. Recommended Indexes

- `customers.phone` UNIQUE
- `customers.email`
- `suppliers.shop_name`
- `products.category_id`
- `products.supplier_id`
- `products.slug`
- `quotation_requests.quotation_number`
- `quotation_requests.customer_id`
- `quotation_requests.status`
- `quotations.quotation_request_id, quotations.version` UNIQUE
- `quotations.status`
- `quotations.is_current`
- `orders.order_number`
- `orders.quotation_id` UNIQUE
- `orders.customer_id`
- `orders.order_status`
- `orders.payment_status`
- `orders.created_at`
- `cash_payments.receipt_number`
- `notifications.recipient_type, notifications.recipient_id, notifications.is_read`

## 6. Quotation PDF Integrity Rules

- `quotation_pdfs.quotation_id` သည် quotation version တစ်ခုနှင့် ချိတ်ရမည်။
- PDF အတွင်း data သည် quotation version snapshot၊ `quotation_version_items` နှင့် stored fee values မှသာ လာရမည်။
- Version အသစ်အတွက် PDF အသစ်ဖန်တီးရမည်; အဟောင်း version PDF ကို overwrite မလုပ်ရ။

## 7. Notification Access Rules

- Notification API သည် authenticated recipient ၏ notification များကိုသာ list/read update လုပ်ရမည်။
- Customer သည် မိမိ `customer_id` နှင့်ဆိုင်သော notification များကိုသာ ရနိုင်ရမည်။
- Admin သည် မိမိ admin recipient notification များကိုသာ ရနိုင်ရမည်။
- React client သည် authenticated state အတွင်း `/api/v1/notifications` ကို 60 seconds တစ်ကြိမ် polling လုပ်ရမည်။
