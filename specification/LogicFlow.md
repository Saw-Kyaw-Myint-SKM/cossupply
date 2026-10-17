# CoSupply Logic Flow

## 1. MVP Principles

1. Guest သည် Public Website ကို Browse နှင့် Cart သုံးနိုင်သော်လည်း Quotation Request တင်ရန် Customer account ဖြင့် Login ဝင်ထားရမည်။
2. Supplier သည် Website တွင် Login မဝင်သေးပါ။ Admin က Supplier ကို Viber ဖြင့် ဆက်သွယ်မည်။
3. Customer သည် Direct Order မတင်ရ။ Accepted Quotation မှသာ Order ဖန်တီးရမည်။
4. Customer က latest valid Final Quotation ကို Accept လုပ်မှ Order ဖန်တီးရမည်။
5. Payment Method သည် Cash on Delivery တစ်ခုတည်းဖြစ်ပြီး full payment only ဖြစ်သည်။ MMK ကို decimal မပါသော integer amount ဖြင့် သိမ်းရမည်။
6. Product, Quotation နှင့် Order price များကို snapshot အဖြစ် သိမ်းရမည်။
7. Customer သည် မိမိ `customer_id` နှင့် ဆိုင်သော Quotation/Order များကိုသာ access လုပ်နိုင်ရမည်။ Guest token နှင့် phone OTP verification ကို MVP တွင် မသုံးပါ။
8. Partial payment နှင့် partial delivery ကို MVP တွင် မခွင့်ပြုရ။
9. Queue worker နှင့် scheduler မသုံးသေးပါ။ Expiry ကို API request အချိန်တွင် `valid_until` ဖြင့် စစ်ရမည်။

## 2. Admin Creates Supplier

```text
Admin login
  ↓
Supplier Management > Create Supplier
  ↓
Validate shop name, contact person, phone
  ↓
Save supplier with status ACTIVE
  ↓
Supplier becomes selectable for products
```

Rules:

- Shop name နှင့် Phone မရှိဘဲ Save မလုပ်ရ။
- Supplier status `INACTIVE` သို့မဟုတ် `SUSPENDED` ဖြစ်လျှင် Product အသစ် မ Publish ရ။
- Viber phone မရှိပါက Admin သည် Viber contact မလုပ်နိုင်သောကြောင့် warning ပြရမည်။

## 3. Admin Creates Product

```text
Admin selects supplier and category
  ↓
Enters product name, photo, specification, price, MOQ
  ↓
System validates required fields
  ↓
Save as DRAFT or PUBLISHED
```

Rules:

- Supplier နှင့် Category မဖြစ်မနေရွေးရမည်။
- Price သည် 0 ထက်ကြီးရမည်။
- Minimum Order Quantity သည် 1 နှင့်အထက်ဖြစ်ရမည်။
- Supplier inactive ဖြစ်ပါက Product ကို Publish မလုပ်ရ။
- Out-of-stock product ကို Cart ထဲထည့်ခွင့် မပြုရ။

## 4. Customer Browsing and Cart

```text
Guest or Customer opens website
  ↓
Search/filter category, supplier, product
  ↓
Opens product detail
  ↓
Adds quantity to cart
  ↓
Clicks Request Quotation
  ↓
If not logged in: redirect to Customer Login/Register
  ↓
If logged in: open quotation request form
```

Rules:

- Guest သည် Browse နှင့် Cart သုံးနိုင်ရမည်၊ သို့သော် Quotation Request မတင်နိုင်ရ။
- Quantity သည် MOQ ထက် မနည်းရ။
- Stock status `SUPPLIER_CONFIRMATION_REQUIRED` ဖြစ်လျှင် Cart မှာ “Price/Stock will be confirmed” ပြရမည်။
- Product price သည် Display Price ဖြစ်ပြီး Final Price မဟုတ်ကြောင်း ပြရမည်။

## 5. Submit Quotation Request

```text
Authenticated Customer opens cart
  ↓
Clicks Request Quotation
  ↓
System verifies Customer login
  ↓
Customer enters/confirms name, phone, company, and delivery address
  ↓
System validates contact and delivery fields
  ↓
Creates quotation_request and quotation_items linked to customer_id
  ↓
Shows quotation number
```

Required:

- Authenticated Customer account
- Customer name
- Valid phone number
- Delivery address
- At least one cart item

Rules:

- Guest request ကို မဖန်တီးရ။ `customer_id` သည် မဖြစ်မနေရှိရမည်။
- Customer profile data ကို form တွင် prefill လုပ်နိုင်သော်လည်း request အချိန်၏ contact/delivery data ကို snapshot အဖြစ် သိမ်းရမည်။
- Cart ကို request တင်ပြီးနောက် clear လုပ်နိုင်သော်လည်း request snapshot data မပျောက်ရ။

On success:

```text
Quotation Request ID: QT-YYYY-XXXX
Status: NEW
```

## 6. Admin Processes Quotation Request

```text
Admin opens NEW request
  ↓
Assigns self or staff
  ↓
System groups items by supplier
  ↓
Admin copies Viber message template
  ↓
Admin opens Viber manually
  ↓
Admin records supplier response
  ↓
Admin enters confirmed price, stock, delivery and notes
  ↓
Admin prepares quotation version
```

Rules:

- Supplier တစ်ဦးချင်းစီအလိုက် Contact Log ထားရမည်။
- Supplier response မရသေးလျှင် item status ကို `SUPPLIER_RESPONSE_PENDING` ထားရမည်။
- Supplier unavailable ဖြစ်လျှင် Customer ကို quotation ထဲမှာ ရှင်းပြရမည် သို့မဟုတ် request ကို `SUPPLIER_UNAVAILABLE` handling ဖြင့် ပြန်လည်ပြင်ဆင်ရမည်။
- Admin သည် Customer ကို ပို့မည့် Final Quotation မတိုင်မီ subtotal, discount, delivery fee, total နှင့် validity စစ်ရမည်။

## 7. Create and Send Quotation Version

```text
Admin creates quotation version
  ↓
Adds quotation_version_items
  ↓
Sets subtotal, discount, delivery fee, service fee percentage, service fee, total, validity and COD terms
  ↓
Admin may use Master Setting percentage or override it for this quotation version
  ↓
Generates a quotation PDF for download/manual sharing through Viber, Telegram, Email, or another channel
  ↓
If an older current quotation exists: mark it SUPERSEDED
  ↓
Clicks Send Quotation
  ↓
New quotation status becomes SENT and is_current becomes true
  ↓
Request status becomes QUOTATION_SENT
  ↓
System sends quotation email to Customer
```

Rules:

- `quotation_items` သည် Customer ၏ original request snapshot ဖြစ်သည်။
- `quotation_version_items` သည် Final Quotation version snapshot ဖြစ်သည်။
- `total_amount = subtotal - discount + delivery_fee + service_fee` ဖြစ်ရမည်။ MMK integer amount ကိုသာ အသုံးပြုရမည်။
- Previous sent quotation ကို `SUPERSEDED` လုပ်ပြီး `is_current = false` ထားရမည်။
- Email ပို့မှု fail ဖြစ်လျှင် quotation data ကို rollback မလုပ်ရ။ Email status/error ကို သိမ်းပြီး Admin က resend လုပ်နိုင်ရမည်။

Quotation must show:

- Quotation number and version
- Product name and supplier
- Quantity and confirmed unit price
- Discount and delivery fee
- Total amount
- Delivery date
- Valid until
- Cash on Delivery payment terms

## 8. Customer Reviews Quotation

```text
Authenticated Customer opens My Quotations
  ↓
System verifies quotation.customer_id equals authenticated customer_id
  ↓
Customer opens current quotation
  ↓
Quotation becomes VIEWED; request becomes CUSTOMER_REVIEWING
  ↓
Customer accepts, rejects, or requests a change
```

Actions:

- `ACCEPTED` — latest valid quotation version becomes eligible for order conversion.
- `REQUESTED_CHANGE` — customer note goes to Admin; request status becomes `CHANGE_REQUESTED`.
- `REJECTED` — quotation/request is closed as rejected.

Rules:

- Customer သည် မိမိ `customer_id` နှင့်မကိုက်သော quotation ကို မကြည့်/မပြင်နိုင်ရ။
- Expired quotation ကို Accept မလုပ်ရ။ `now() > valid_until` ဖြစ်လျှင် API က expired အဖြစ်ပြပြီး Accept ကိုပိတ်ရမည်။
- Latest quotation version, `is_current = true` နှင့် status `SENT`/`VIEWED` ဖြစ်သော quotation တစ်ခုတည်းကိုသာ Accept လုပ်နိုင်ရမည်။
- Customer က Change Request တင်လျှင် quotation status ကို `CHANGE_REQUESTED`၊ request status ကို `CHANGE_REQUESTED` ပြောင်းရမည်။ Admin က version အသစ်ပြင်ရန် request ကို `PREPARING_QUOTATION` သို့ ပြန်ပြောင်းရမည်။
- Guest token, email verification နှင့် phone OTP ကို MVP တွင် မသုံးရ။

## 9. Convert Accepted Quotation to Order

```text
Authenticated Customer clicks Accept
  ↓
System validates ownership, quotation status, is_current, and validity
  ↓
Database transaction starts and locks quotation row
  ↓
System creates order and copies accepted quotation_version_items to order_items
  ↓
Creates delivery record and COD cash payment record
  ↓
Creates order status history
  ↓
Order starts at SUPPLIER_CONFIRMATION_REQUIRED
  ↓
Transaction commits
```

Rules:

- Same quotation version ကို Order နှစ်ကြိမ်မဖြစ်စေရ။ `orders.quotation_id` unique constraint နှင့် transaction lock သုံးရမည်။
- `orders.customer_id` သည် accepted quotation request ၏ authenticated customer ကို မဖြစ်မနေ link လုပ်ရမည်။
- Order တင်ချိန်တွင် Customer name, phone, address နှင့် accepted quotation value များကို snapshot သိမ်းရမည်။
- `quotation_version_items` မှသာ `order_items` သို့ copy လုပ်ရမည်။
- Payment method ကို `CASH_ON_DELIVERY` အဖြစ် fixed သတ်မှတ်ရမည်။
- `amount_due = total_amount`, `amount_collected = 0`, `amount_remaining = total_amount` ဖြင့် စတင်ရမည်။
- တစ်ခုခု fail လျှင် transaction အားလုံး rollback လုပ်ရမည်။

## 10. Supplier Confirmation by Admin

```text
Admin opens order
  ↓
Contacts supplier via Viber
  ↓
Confirms product, quantity and delivery date
  ↓
If confirmed: order moves to ORDER_CONFIRMED, then PREPARING
  ↓
If unavailable: order moves to SUPPLIER_UNAVAILABLE
```

Supplier မရနိုင်ပါက:

```text
Order → SUPPLIER_UNAVAILABLE
Admin contacts customer
Customer accepts a revised quotation or cancellation
```

Rules:

- Revised product/price/delivery term လိုအပ်လျှင် existing order ကို overwrite မလုပ်ရ။ Admin က quotation workflow ကို version အသစ် သို့မဟုတ် quotation အသစ်ဖြင့် ပြန်လုပ်ရမည်။
- Order cancellation အတည်ပြုလျှင် order status ကို `CANCELLED` ပြောင်းရမည်။

## 11. Delivery Flow

```text
Supplier prepares products
  ↓
Admin updates PREPARING
  ↓
Admin updates READY_TO_SHIP
  ↓
Delivery starts
  ↓
Admin updates OUT_FOR_DELIVERY
  ↓
Customer receives all products
  ↓
Admin updates DELIVERED
```

Rules:

- Partial delivery ကို MVP တွင် မခွင့်ပြုရ။ Order item အားလုံးကို delivery တစ်ကြိမ်တည်းဖြင့် အပြည့်ပို့ရမည်။
- Delivery မအောင်မြင်လျှင် `DELIVERY_FAILED` ဖြစ်ရမည်။ Admin က re-delivery ခွင့်ပြုလျှင် `READY_TO_SHIP` သို့ ပြန်သွားနိုင်သည်။
- Return လိုအပ်လျှင် delivery status ကို `RETURNED` နှင့် order status ကို `RETURNED` ပြောင်းနိုင်သည်။

## 12. Cash Collection Flow

```text
Order is OUT_FOR_DELIVERY
  ↓
Payment status becomes CASH_COLLECTION_PENDING
  ↓
Delivery arrives and customer receives all products
  ↓
Admin/receiver records full cash amount and receipt number
  ↓
Payment status becomes CASH_COLLECTED
  ↓
Admin verifies receipt and amount
  ↓
Payment status becomes PAYMENT_CONFIRMED
  ↓
Order becomes COMPLETED
```

Rules:

- ပစ္စည်းမရောက်မီ `CASH_COLLECTED` မပြောင်းရ။
- `amount_collected` သည် `amount_due` နှင့် တိတိကျကျတူရမည်။ Partial payment မခွင့်ပြုရ။
- Receipt number မရှိဘဲ `CASH_COLLECTED` မပြောင်းရ။
- Customer refuses payment ဖြစ်လျှင် payment status ကို `CUSTOMER_REFUSED_TO_PAY`၊ delivery status ကို `DELIVERY_FAILED` သို့မဟုတ် `RETURNED`၊ order status ကို `DELIVERY_FAILED` သို့မဟုတ် `RETURNED` အဖြစ် Admin က record လုပ်ရမည်။
- `PAYMENT_CONFIRMED` ဖြစ်မှ Order ကို `COMPLETED` ပြောင်းရမည်။

## 13. Cancellation Logic

Customer cancellation ကို Quotation stage တွင် ခွင့်ပြုနိုင်သည်။ Order ဖြစ်ပြီး Supplier ပြင်ဆင်နေချိန် သို့မဟုတ် Delivery ထွက်ပြီးနောက် Admin approval လိုအပ်သည်။

```text
Customer requests cancel
  ↓
Admin reviews status
  ↓
If not shipped: approve cancellation → CANCELLED
  ↓
If shipped: contact supplier, review return cost and set RETURNED / DELIVERY_FAILED / CANCELLED as applicable
```

## 14. Notification Logic

### Customer Notifications

- Quotation request received — App notification
- Quotation sent or changed — App notification + Email
- Quotation accepted/rejected/change requested — App notification
- Order confirmed — App notification + Email
- Order out for delivery — App notification + Email
- Order delivered / cash pending — App notification
- Payment confirmed — App notification + Email
- Order cancelled — App notification + Email

### Admin Notifications

- New quotation request
- Customer requested change
- Customer accepted/rejected quotation
- Supplier confirmation required
- Cash collection recorded

Rules:

- MVP တွင် realtime notification မသုံးရ။ React application က notification API ကို login ဝင်ထားစဉ် 60 seconds တစ်ကြိမ် polling လုပ်ရမည်။
- Queue မသုံးသေးသောကြောင့် email send ကို synchronous လုပ်နိုင်သည်။ Email fail လျှင် business record ကို rollback မလုပ်ဘဲ failure status နှင့် resend action ပေးရမည်။

## 15. Audit Logic

Admin သည် အောက်ပါတို့ကို ပြောင်းတိုင်း `audit_logs` နှင့် လိုအပ်သလို `order_status_histories` ထဲ မှတ်တမ်းတင်ရမည်။

- Product price
- Product status
- Supplier status
- Quotation total, status, validity သို့မဟုတ် version
- Order status
- Payment status
- Delivery status
- Cash collected amount
- Master setting values

## 16. Transaction Boundaries

Quotation Accept → Order creation သည် Database transaction တစ်ခုအတွင်း လုပ်ရမည်။ အောက်ပါအရာများ အားလုံးအောင်မြင်မှ Commit လုပ်ရမည်။

1. Lock and validate accepted quotation version
2. Quotation accepted action and quotation/request status update
3. Order created
4. Order items created from `quotation_version_items`
5. Delivery created
6. Cash payment created
7. Status history created

တစ်ခုခု fail လျှင် အားလုံး Rollback လုပ်ရမည်။

## 17. Quotation Service Fee and PDF Rules

- Master Setting `quotation_service_fee_percentage` သည် quotation draft အသစ်အတွက် default service fee percentage ကို သတ်မှတ်ရမည်။
- Admin သည် quotation version တစ်ခုချင်းစီအလိုက် default percentage ကို ပြင်နိုင်ရမည်။
- Formula: `service_fee = round(subtotal × service_fee_percentage / 100)` နှင့် `total_amount = subtotal - discount + delivery_fee + service_fee` ဖြစ်ရမည်။
- Sent quotation version တစ်ခုတွင် `service_fee_percentage` နှင့် `service_fee` ကို snapshot အဖြစ်သိမ်းရမည်။ Master Setting နောက်မှပြောင်းလဲလျှင် အဟောင်း quotation မပြောင်းရ။
- Admin သည် quotation version PDF ကို generate/download လုပ်နိုင်ရမည်။ PDF သည် quotation number, version, customer details, items, discount, delivery fee, service fee percentage/amount, total, validity, COD terms နှင့် admin note ကိုပြရမည်။
- Generated PDF ကို Admin က Viber, Telegram, Email သို့မဟုတ် အခြား manual channel မှ share လုပ်နိုင်ရမည်။ Version အသစ်အတွက် PDF အသစ်ထုတ်ရမည်; အဟောင်း PDF ကို overwrite မလုပ်ရ။
