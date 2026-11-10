# CoSupply — Quotation Request မှ Order အထိ Flow (မြန်မာ)

> **ရည်ရွယ်ချက်** — Customer က quotation request တင်ပြီးနောက် Admin ဘက်မှာ ဘာတွေ လုပ်နိုင်တယ်၊ ဘာတွေ ဆက်လုပ်ရတယ်၊ quotation version ကို ဘယ်အချိန်မှာ create လုပ်လို့ရတယ် ဆိုတာကို အဆင့်လိုက် ရှင်းပြထားတဲ့ doc ဖြစ်ပါတယ်။
>
> **အခြေခံ source** — `specification/LogicFlow.md`, `specification/StatusDefinitions.md`, `specification/MoneyAndValidationRules.md`, `tasks/06`–`09`, နှင့် `laravel-api` / `react-app` ရဲ့ လက်ရှိ implementation။
>
> **မှတ်ချက်** — ဒီ doc က လက်ရှိ code ရဲ့ behavior ကို ဖော်ပြတာပါ။ အနာဂတ် ပြောင်းလဲမှုတွေ ရှိရင် doc ကို update လုပ်ဖို့ လိုပါတယ်။

---

## ၁။ အဓိက အယူအဆ ၂ ခု

Quotation လုပ်ငန်းစဉ်မှာ အရေးကြီးတဲ့ အရာ ၂ ခု ကွဲပြားပါတယ်။

| အမျိုးအစား | အဓိပ္ပာယ် | ဥပမာ |
|---|---|---|
| **Quotation Request** | Customer တင်တဲ့ မူရင်း တောင်းဆိုချက်။ ပစ္စည်းစာရင်းနဲ့ ဈေးနှုန်းတွေက `quotation_items` မှာ snapshot အနေနဲ့ သိမ်းတယ်။ Request တစ်ခုမှာ တစ်ခုတည်း။ | `QT-2026-0001` |
| **Quotation Version** | Admin က customer ဆီ ပို့မယ့် Final Quotation ရဲ့ iteration။ Version တစ်ခုချင်းမှာ ကိုယ်ပိုင် items, ဈေးနှုန်း, fee, PDF ရှိတယ်။ | `QT-2026-0001` ရဲ့ v1, v2, v3… |

ဒါကြောင့် status ကို အလွှာ ၂ ခုနဲ့ ကြည့်ရပါတယ်။

- **Request status** = အလုပ်တစ်ခုလုံးရဲ့ အဆင့် (customer ဘက်က ဘယ်အထိ ရောက်နေတယ်)
- **Version status** = စာရွက် (quotation version) တစ်ခုချင်းရဲ့ အဆင့် (draft လား၊ ပို့ပြီးလား၊ လက်ခံပြီးလား)

တစ်ချိန်တည်းမှာ **current version တစ်ခုသာ** ရှိရပါတယ် (`is_current = true`)။ Version အသစ် ပို့တဲ့အခါ အဟောင်း current version က `SUPERSEDED` ဖြစ်ပြီး `is_current = false` ဖြစ်သွားပါတယ်။

---

## ၂။ Flow အကြမ်းဖျင်း

```text
Customer
  │  Cart → Request Quotation
  ▼
Quotation Request (NEW)
  │
  ▼
Admin
  │  ၁။ Assign လုပ်
  │  ၂။ Supplier ကို Viber/Phone/Email ဆက်သွယ် + log တင်
  │  ၃။ Supplier response မှတ်တမ်းတင်
  │  ၄။ Quotation Version (DRAFT) ဖန်တီး/ပြင်
  │  ၅။ PDF ထုတ်
  │  ၆။ Send → Customer ဆီ email + in-app notification
  ▼
Customer
  │  ကြည့် → Accept / Reject / Request Change
  ▼
Accept ဖြစ်ရင်
  │
  ▼
Order (SUPPLIER_CONFIRMATION_REQUIRED)
  │
  ▼
Supplier confirmation → Preparing → Ready to ship → Out for delivery
  → Delivered → Cash collection → Payment confirmed → Completed
```

---

## ၃။ အဆင့်လိုက် အသေးစိတ်

### ၃.၁ Customer က quotation request တင်တယ်

1. Customer က cart ထဲက items တွေနဲ့ **Request Quotation** နှိပ်တယ်။
2. Customer account ဝင်ထားဖို့ လိုတယ်။ Guest က request မတင်နိုင်ပါ။
3. System က အောက်ပါအချက်တွေကို စစ်တယ်:
   - Cart ထဲမှာ item အနည်းဆုံး တစ်ခု ရှိရမယ်။
   - Quantity က product ရဲ့ MOQ ထက် မနည်းရ။
   - Product က `PUBLISHED` ဖြစ်ရမယ်၊ `OUT_OF_STOCK` မဖြစ်ရ။
   - Customer name, phone, city, delivery address ပြည့်စုံရမယ်။
4. Request status = `NEW`။
5. `quotation_items` မှာ product, quantity, display price, customer contact/address တွေကို **snapshot** အနေနဲ့ သိမ်းတယ်။
6. Quotation number (ဥပမာ `QT-2026-0001`) ထုတ်ပြီး customer ကို ပြပါတယ်။

> **အရေးကြီး** — Customer ရဲ့ မူရင်း request items တွေကို Admin က နောက်ပိုင်း ပြင်လို့မရပါ။ Final quotation ပြင်တဲ့အခါ version items အသစ်ကိုသာ ပြင်တာပါ။

---

### ၃.၂ Admin က queue မှာ လက်ခံတယ်

Admin က အောက်ပါအရာတွေ လုပ်နိုင်တယ်:

- Quotation queue ကို status, assignee, search နဲ့ စစ်တယ်။
- Request detail ကို ဖွင့်ကြည့်တယ်:
  - Customer အချက်အလက်၊ ဆက်သွယ်ရန် phone/email၊ delivery address
  - Customer note
  - Items တွေကို **supplier အလိုက် group** ခွဲပြထားတယ်
  - Supplier contact log
  - ယခင်က quotation version အားလုံး
- ကိုယ့်ကိုယ် ဒါမှမဟုတ် staff ကို **assign** လုပ်တယ်။

> **မှတ်ချက်** — Assignment က သတိပေးချက်/တာဝန်ခွဲဝေမှု သဘောသာဖြစ်တယ်။ လက်ရှိ MVP မှာ assigned admin မဟုတ်လည်း အခြား admin က action လုပ်နိုင်တယ်။

---

### ၃.၃ Admin က supplier ကို ဆက်သွယ်တယ်

1. Supplier တစ်ခုချင်းအတွက် Viber / Phone / Email နဲ့ ဆက်သွယ်တယ်။
2. ဆက်သွယ်မှုကို log တင်တယ်:
   - ပို့တဲ့ message
   - Supplier response
   - Attachment (ရှိရင်)
   - ဆက်သွယ်ချိန် / response ရချိန်
3. Response မရသေးရင် request status ကို `SUPPLIER_RESPONSE_PENDING` ကို ရွှေ့တယ်။
4. Response ရပြီး ဆက်ဆံနေဆဲဆိုရင် `CONTACTING_SUPPLIER` ကို ရွှေ့တယ်။
5. Supplier က မပေးနိုင်ရင်:
   - Customer ကို quotation ထဲမှာ ရှင်းပြတယ်၊ ဒါမှမဟုတ်
   - Request ကို ပြန်ညှိပြီး ဆက်လုပ်တယ်။

> Supplier response မရသေးဘဲ customer ဆီ quotation မပို့သင့်ပါ။ လက်ရှိ code က supplier response မရှိဘဲ send လုပ်တာကို ပိတ်ထားတာ မဟုတ်ပေမယ့် business rule အရ မလုပ်သင့်ပါ။

---

### ၃.၄ Admin က quotation version ဖန်တီး/ပြင်တယ်

Version တစ်ခု ဖန်တီးတဲ့အခါ:

- Version status = `DRAFT`
- `is_current = false` (customer မမြင်ရသေးဘူး)
- Version နံပါတ် = ယခင် version အားလုံးရဲ့ အမြင့်ဆုံး + 1
- Request status က `PREPARING_QUOTATION` ကို ရွှေ့တယ်

Version ထဲမှာ ထည့်ရတာ:

| အမျိုးအစား | အသေးစိတ် |
|---|---|
| Item တစ်ခုချင်း | Product, quantity, confirmed unit price, line discount, delivery date, warranty note, supplier note |
| Header | Discount, delivery fee, service fee %၊ payment terms, valid_until, admin note |
| Payment | `CASH_ON_DELIVERY` (MVP မှာ fixed) |

**Total တွေကို server ကပဲ တွက်တယ်** — client က ပို့လာတဲ့ total ကို မယုံပါ။

```text
line_total  = (unit_price × quantity) - line_discount
subtotal    = sum(line_total)
service_fee = round(subtotal × service_fee_percentage / 100)
total       = subtotal - discount + delivery_fee + service_fee
```

**Service fee %**

- Default က Master Setting `quotation_service_fee_percentage` ကနေ ယူတယ်။
- Admin က version တစ်ခုချင်းအတွက် override လုပ်နိုင်တယ်။
- Override လုပ်ရင် audit log မှာ prior value, new value, admin ကို မှတ်တယ်။
- Send ပြီးရင် အဲဒီ version ရဲ့ `service_fee_percentage` နဲ့ `service_fee` က snapshot ဖြစ်ပြီး မပြောင်းတော့ဘူး။ Master Setting နောက်မှ ပြောင်းလည်း အဟောင်း version တွေ မပြောင်းဘူး။

**Validity**

- Default က `quotation_validity_days` setting (မူလ 7 ရက်) ကနေ ယူတယ်။
- `valid_until` က ရက်စွဲအနေနဲ့ သိမ်းတာမို့ အဲဒီနေ့ ကုန်ဆုံးအထိ valid ဖြစ်တယ်။

**Draft ပြင်ခြင်း**

- `DRAFT` status ရှိတဲ့ version ကိုသာ ပြင်လို့ရတယ်။
- `SENT`, `VIEWED`, `ACCEPTED`, `REJECTED`, `EXPIRED`, `SUPERSEDED`, `CANCELLED` version တွေကို ပြင်လို့မရပါ။

---

### ၃.၅ Admin က PDF ထုတ်တယ်

- Version တစ်ခုချင်းအတွက် PDF generate/download လုပ်နိုင်တယ်။
- PDF မှာ ပါဝင်တာ:
  - Quotation number နဲ့ version
  - Customer/company အချက်အလက်
  - Item list, unit price, discount
  - Delivery fee
  - Service fee % နဲ့ amount
  - Total amount
  - Validity
  - COD terms
  - Admin note
- Version အသစ်အတွက် PDF အသစ် ထုတ်တယ်။ **အဟောင်း PDF ကို overwrite မလုပ်ဘူး။**
- PDF ကို Viber, Telegram, Email စတဲ့ manual channel နဲ့ ကိုယ်တိုင် share လုပ်နိုင်တယ်။

---

### ၃.၆ Admin က customer ဆီ ပို့တယ် (Send)

`DRAFT` version ကို **Send** လုပ်တဲ့အခါ တစ်ခါတည်း ဖြစ်တာတွေ:

1. Version status `DRAFT → SENT`
2. `is_current = true`၊ `sent_at = now()`
3. အဟောင်း current version ရှိရင် `SUPERSEDED` + `is_current = false`
4. Request status → `QUOTATION_SENT`
5. Version အတွက် PDF အလိုအလျောက် generate
6. Customer ဆီ **email** ပို့
7. Customer အတွက် **in-app notification** ဖန်တီး
8. Audit log မှတ်တမ်းတင်

**Email fail ဖြစ်ရင်**

- Quotation data ကို rollback မလုပ်ပါ။
- Email status/error ကို `email_logs` မှာ သိမ်းတယ်။
- Admin က **Resend** လုပ်နိုင်တယ်။

> Send ပြီးသွားတဲ့ version ကို ပြင်လို့မရပါ။ ပြင်ချင်ရင် version အသစ် ထုတ်ရပါမယ်။

---

### ၃.၇ Customer က quotation ကို ကြည့်တယ်

Customer က My Quotations ကနေ မိမိ quotation ကို ဖွင့်ကြည့်တယ်။

- ပထမဆုံး ဖွင့်ကြည့်တာနဲ့:
  - Version status `SENT → VIEWED`
  - Request status → `CUSTOMER_REVIEWING`
  - `quotation_actions` မှာ `VIEWED` action မှတ်တယ်။
- ထပ်ခါထပ်ခါ ဖွင့်ကြည့်ရင် action အသစ် ထပ်မမှတ်ပါ။

Customer လုပ်နိုင်တဲ့ action ၃ မျိုး:

| Action | ဖြစ်ပျက်တာ |
|---|---|
| **Accept** | Version `ACCEPTED`၊ request `ACCEPTED`၊ order အလိုအလျောက် ဖန်တီး |
| **Reject** | Version `REJECTED`၊ request `REJECTED` |
| **Request Change** | Note မဖြစ်မနေ ထည့်ရတယ်။ Version `CHANGE_REQUESTED`၊ request `CHANGE_REQUESTED` |

**ကန့်သတ်ချက်**

- မိမိ `customer_id` နဲ့ ဆိုင်တဲ့ quotation ကိုသာ ကြည့်/လုပ်နိုင်တယ်။
- `is_current = true` ဖြစ်တဲ့ version ကိုသာ action လုပ်နိုင်တယ်။
- Version status က `SENT` ဒါမှမဟုတ် `VIEWED` ဖြစ်ရမယ်။
- `valid_until` ကျော်သွားရင် accept/reject/change လုပ်လို့မရပါ။
- Expired, superseded, rejected, cancelled version တွေကို accept လုပ်လို့မရပါ။

---

### ၃.၈ Admin က customer တုံ့ပြန်မှုအလိုက် ဆက်လုပ်တယ်

| Customer ရဲ့ တုံ့ပြန်မှု | Admin ဆက်လုပ်ရမှာ |
|---|---|
| **Request Change** | Customer note ဖတ် → version အသစ် (v2) ဖန်တီး → ပြင် → send → v1 `SUPERSEDED` |
| **Accept** | Quotation flow ပြီးဆုံး။ Orders ဘက်မှာ supplier confirmation ဆက်လုပ် |
| **Reject** | Terminal။ ဒီ request အတွက် နောက်ထပ် quotation မလုပ်တော့ဘူး |
| **မတုံ့ပြန်ဘဲ Expire** | Version အသစ် ထုတ်ပြီး ပြန် send နိုင်တယ် (customer စိတ်ဝင်စားသေးရင်) |
| **Email fail** | Sent version ကို resend လုပ်နိုင်တယ် |

---

### ၃.၉ Accept ပြီးနောက် Order ဘက်က ဆက်လုပ်ရမယ့် flow

Customer accept လုပ်တာနဲ့ **database transaction တစ်ခုအတွင်း** အောက်ပါအရာတွေ ဖြစ်တယ်:

1. Quotation version ကို lock လုပ်ပြီး စစ်တယ်။
2. Version `ACCEPTED`၊ request `ACCEPTED` လုပ်တယ်။
3. Order ဖန်တီးတယ်။
4. `quotation_version_items` ကနေ `order_items` ကို copy လုပ်တယ်။
5. Delivery record ဖန်တီးတယ်။
6. Cash payment record (COD) ဖန်တီးတယ်။
7. Order status history မှတ်တယ်။

Order status က `SUPPLIER_CONFIRMATION_REQUIRED` ကနေ စတယ်။ ပြီးရင် Admin က:

```text
SUPPLIER_CONFIRMATION_REQUIRED
  → ORDER_CONFIRMED
  → PREPARING
  → READY_TO_SHIP
  → OUT_FOR_DELIVERY
  → DELIVERED
  → (cash collection + payment confirmed)
  → COMPLETED
```

အခြား လမ်းကြောင်းတွေ:

- Supplier မပေးနိုင်ရင် → `SUPPLIER_UNAVAILABLE`
- Delivery မအောင်မြင်ရင် → `DELIVERY_FAILED` → ပြန် re-delivery လုပ်နိုင်တယ်
- ပြန်ပို့ရင် → `RETURNED`
- ပယ်ဖျက်ရင် → `CANCELLED` (အခြေအနေပေါ်မူတည်ပြီး Admin approval လိုတယ်)

**Cash on Delivery (MVP)**

- Payment method = `CASH_ON_DELIVERY` တစ်ခုတည်း။
- Partial payment မခွင့်ပြုဘူး။
- `amount_collected = amount_due` ဖြစ်ရမယ်။
- Receipt number မရှိဘဲ `CASH_COLLECTED` မပြောင်းရဘူး။
- Delivery `DELIVERED` ဖြစ်ပြီး payment `PAYMENT_CONFIRMED` ဖြစ်မှ order ကို `COMPLETED` ပြောင်းရတယ်။

---

## ၄။ Quotation Version ကို ဘယ်အချိန်မှာ create လုပ်လို့ရလဲ

### ၄.၁ Create လုပ်လို့ရတဲ့ request status များ

လက်ရှိ code အရ အောက်ပါ status တွေမှာ version create လုပ်လို့ရပါတယ်:

| Request status | Version create လုပ်လို့ရလား |
|---|---|
| `NEW` | ✅ ရ |
| `CONTACTING_SUPPLIER` | ✅ ရ |
| `SUPPLIER_RESPONSE_PENDING` | ✅ ရ |
| `PREPARING_QUOTATION` | ✅ ရ |
| `QUOTATION_SENT` | ✅ ရ |
| `CUSTOMER_REVIEWING` | ✅ ရ |
| `CHANGE_REQUESTED` | ✅ ရ |
| `EXPIRED` | ✅ ရ |
| `ACCEPTED` | ❌ မရ (terminal) |
| `REJECTED` | ❌ မရ (terminal) |
| `CANCELLED` | ❌ မရ (terminal) |

### ၄.၂ Create လုပ်တဲ့အခါ ဖြစ်တာ

- Version နံပါတ် = `max(version) + 1`
- Status = `DRAFT`
- `is_current = false`
- Request status → `PREPARING_QUOTATION`
- Customer က ဒီ version ကို မမြင်ရသေးဘူး

### ၄.၃ သတိထားရမယ့် အချက်များ

1. **Supplier ကို မဆက်သွယ်ရသေးတဲ့ `NEW` အချိန်တောင်မှာ draft ဆွဲထားလို့ရတယ်။** ဒါပေမယ့် customer ဆီ မပို့မီ supplier data ရှိဖို့ လိုပါတယ်။
2. **DRAFT version အများအပြား တစ်ချိန်တည်း ရှိနိုင်တယ်။** လက်ရှိ code က တစ်ခုတည်းသာ ကန့်သတ်ထားတာ မဟုတ်ပါ။
3. **လက်ရှိ SENT/VIEWED version သက်တမ်းမကုန်သေးချိန်မှာလည်း version အသစ် ထုတ်လို့ရတယ်။** Send လုပ်ရင် အဟောင်း `SUPERSEDED` ဖြစ်တယ်။
4. **Request status ကို တိုက်ရိုက် ခုန်စေတယ်။** ဥပမာ `QUOTATION_SENT` မှာ version အသစ် create လုပ်ရင် request status က `PREPARING_QUOTATION` ကို ရောက်သွားတယ်။ ဒါပေမယ့် အဟောင်း current version က သက်တမ်းမကုန်သေးရင် customer က အဲဒါကို ဆက်ပြီး accept လုပ်နိုင်တယ်။
5. **`ACCEPTED`/`REJECTED`/`CANCELLED` ဖြစ်သွားရင် version အသစ် ထပ်မဖန်တီးနိုင်တော့ဘူး။** လိုအပ်ရင် quotation request အသစ် ဖန်တီးရပါမယ်။

---

## ၅။ Status ဖွင့်ဆိုချက်များ

### ၅.၁ Quotation Request Status

| Status | အဓိပ္ပာယ် |
|---|---|
| `NEW` | Customer က request အသစ် တင်ထားတယ် |
| `CONTACTING_SUPPLIER` | Admin က supplier ကို ဆက်သွယ်နေတယ် |
| `SUPPLIER_RESPONSE_PENDING` | Supplier response စောင့်နေတယ် |
| `PREPARING_QUOTATION` | Admin က final quotation version ပြင်နေတယ် |
| `QUOTATION_SENT` | Current final quotation ကို customer ဆီ ပို့ပြီးတယ် |
| `CUSTOMER_REVIEWING` | Customer က current quotation ကို ကြည့်ရှုနေတယ် |
| `CHANGE_REQUESTED` | Customer က quotation ပြင်ဆင်ရန် တောင်းထားတယ် |
| `ACCEPTED` | Customer က current quotation ကို လက်ခံပြီး order ဖန်တီးပြီး/ဖန်တီးနေတယ် |
| `REJECTED` | Customer က quotation ကို ငြင်းပယ်ပြီးတယ် |
| `EXPIRED` | Current quotation ရဲ့ `valid_until` ကျော်သွားတယ် |
| `CANCELLED` | Request ကို ပယ်ဖျက်ထားတယ် |

### ၅.၂ Quotation Version Status

| Status | အဓိပ္ပာယ် |
|---|---|
| `DRAFT` | Admin ပြင်ဆင်နေတဲ့ version။ Customer မမြင်ရ |
| `SENT` | Customer ဆီ ပို့ပြီးတဲ့ current version |
| `VIEWED` | Customer က version ကို ဖွင့်ကြည့်ပြီး |
| `CHANGE_REQUESTED` | Customer က ဒီ version အတွက် ပြင်ဆင်ရန် တောင်းထားတယ် |
| `ACCEPTED` | Customer က ဒီ version ကို လက်ခံပြီး |
| `REJECTED` | Customer က ဒီ version ကို ငြင်းပယ်ပြီး |
| `EXPIRED` | `valid_until` ကျော်သွားတဲ့ version |
| `SUPERSEDED` | Version အသစ် ပို့ပြီးဖြစ်လို့ အစားထိုးခံရတဲ့ version |
| `CANCELLED` | Admin သို့မဟုတ် customer cancellation ကြောင့် ပယ်ဖျက်ထားတဲ့ version |

### ၅.၃ Valid transitions

**Quotation Request**

```text
NEW
  → CONTACTING_SUPPLIER
  → CANCELLED

CONTACTING_SUPPLIER
  → SUPPLIER_RESPONSE_PENDING
  → PREPARING_QUOTATION
  → CANCELLED

SUPPLIER_RESPONSE_PENDING
  → CONTACTING_SUPPLIER
  → PREPARING_QUOTATION
  → CANCELLED

PREPARING_QUOTATION
  → QUOTATION_SENT
  → CANCELLED

QUOTATION_SENT
  → CUSTOMER_REVIEWING
  → CHANGE_REQUESTED
  → ACCEPTED
  → REJECTED
  → EXPIRED
  → CANCELLED

CUSTOMER_REVIEWING
  → CHANGE_REQUESTED
  → ACCEPTED
  → REJECTED
  → EXPIRED
  → CANCELLED

CHANGE_REQUESTED
  → PREPARING_QUOTATION
  → CANCELLED

EXPIRED
  → PREPARING_QUOTATION

ACCEPTED / REJECTED / CANCELLED
  → terminal
```

**Quotation Version**

```text
DRAFT
  → SENT
  → CANCELLED

SENT
  → VIEWED
  → CHANGE_REQUESTED
  → ACCEPTED
  → REJECTED
  → EXPIRED
  → SUPERSEDED
  → CANCELLED

VIEWED
  → CHANGE_REQUESTED
  → ACCEPTED
  → REJECTED
  → EXPIRED
  → SUPERSEDED
  → CANCELLED

CHANGE_REQUESTED
  → SUPERSEDED
  → CANCELLED

EXPIRED
  → SUPERSEDED (version အသစ် ပို့တဲ့အခါ)

ACCEPTED / REJECTED / SUPERSEDED / CANCELLED
  → terminal
```

> **မှတ်ချက်** — Code မှာ admin က manual ရွှေ့နိုင်တဲ့ request status က `CONTACTING_SUPPLIER`, `SUPPLIER_RESPONSE_PENDING`, `PREPARING_QUOTATION`, `CANCELLED` လေးခုသာ ဖြစ်တယ်။ ကျန် status တွေကို customer action ဒါမှမဟုတ် system (send, expiry, order conversion) က ကိုင်တွယ်တယ်။

---

## ၆။ Admin ရဲ့ State-by-State လုပ်ရမယ့် အလုပ်

| Request status | Admin လုပ်နိုင်တာ / ဆက်လုပ်ရမှာ |
|---|---|
| `NEW` | Assign လုပ်၊ supplier ဆက်သွယ်၊ communication log တင်၊ draft ဆွဲနိုင် |
| `CONTACTING_SUPPLIER` | Supplier response စောင့်/မှတ်တမ်းတင်၊ `SUPPLIER_RESPONSE_PENDING` ဒါမှမဟုတ် `PREPARING_QUOTATION` ရွှေ့ |
| `SUPPLIER_RESPONSE_PENDING` | Follow-up လုပ်၊ response ရရင် `PREPARING_QUOTATION` ရွှေ့၊ draft ဆွဲ |
| `PREPARING_QUOTATION` | Draft ပြင်၊ total/fee/validity စစ်၊ PDF ထုတ်၊ send |
| `QUOTATION_SENT` | Customer စောင့်၊ email fail ရင် resend၊ လိုရင် cancel |
| `CUSTOMER_REVIEWING` | Customer ဆုံးဖြတ်ချက် စောင့်၊ change request ရရင် ပြန် revise |
| `CHANGE_REQUESTED` | Customer note ဖတ်၊ version အသစ်ဆွဲ၊ send |
| `EXPIRED` | Version အသစ်ဆွဲ၊ ပြန် send |
| `ACCEPTED` | Quotation ပြီး။ Orders ဘက်မှာ supplier confirmation ဆက်လုပ် |
| `REJECTED` | Terminal။ နောက်ထပ် quotation action မရှိ |
| `CANCELLED` | Terminal။ နောက်ထပ် action မရှိ |

---

## ၇။ ငွေကြေးတွက်ချက်မှု (အနှစ်ချုပ်)

```text
line_total  = (unit_price × quantity) - line_discount
subtotal    = sum(line_total)
service_fee = round(subtotal × service_fee_percentage / 100)
total       = subtotal - discount + delivery_fee + service_fee
```

စည်းမျဉ်းများ:

- အားလုံးက MMK integer ဖြစ်ရမယ်။
- `unit_price >= 0`၊ `quantity >= 1`။
- Line discount က အဲဒီ line ရဲ့ gross value ထက် မကြီးရ။
- Header discount က subtotal ထက် မကြီးရ။
- `service_fee_percentage` က 0–100 အတွင်း။
- `total` က အနုတ်မဖြစ်ရ။
- Client က ပို့လာတဲ့ total ကို မယုံရ။ Server ကပဲ တွက်ရ။

---

## ၈။ နမူနာ Timeline — v1 → Change → v2 → Accept

| အဆင့် | ဘယ်သူ | Request status | Version status |
|---|---|---|---|
| Customer request တင် | Customer | `NEW` | — |
| Supplier ဆက်သွယ်/log တင် | Admin | `CONTACTING_SUPPLIER` သို့မဟုတ် `SUPPLIER_RESPONSE_PENDING` | — |
| v1 draft ဖန်တီး | Admin | `PREPARING_QUOTATION` | v1 `DRAFT` |
| v1 send | Admin | `QUOTATION_SENT` | v1 `SENT` (current) |
| Customer ဖွင့်ကြည့် | Customer | `CUSTOMER_REVIEWING` | v1 `VIEWED` |
| Customer change request | Customer | `CHANGE_REQUESTED` | v1 `CHANGE_REQUESTED` |
| v2 draft ဖန်တီး | Admin | `PREPARING_QUOTATION` | v2 `DRAFT` (v1 still current) |
| v2 send | Admin | `QUOTATION_SENT` | v2 `SENT` (current), v1 `SUPERSEDED` |
| Customer accept v2 | Customer | `ACCEPTED` | v2 `ACCEPTED` |
| Order ဖန်တီး | System | `ACCEPTED` | v2 `ACCEPTED` |
| Order ကို supplier confirm | Admin | `ACCEPTED` | v2 `ACCEPTED` |

---

## ၉။ လက်ရှိ ကွာဟချက် / သတိထားရမယ့် အချက်များ

ဒီအချက်တွေက လက်ရှိ implementation မှာ တွေ့ရတဲ့ behavior တွေပါ။ နောက်ပိုင်း ပြင်ချင်ရင် သီးခြား ဆုံးဖြတ်ရပါမယ်။

1. **DRAFT အများအပြား** — request တစ်ခုမှာ `DRAFT` version အများအပြား တစ်ချိန်တည်း ရှိနိုင်တယ်။
2. **Cancel cascade မရှိ** — request ကို `CANCELLED` လုပ်ရင် လက်ရှိ `SENT`/`VIEWED` version နဲ့ `DRAFT` version တွေ အလိုအလျောက် `CANCELLED` မဖြစ်ဘူး။
3. **Admin-side expiry** — `valid_until` ကျော်နေတဲ့ version ကို customer ဖွင့်/action လုပ်မှသာ `EXPIRED` ဖြစ်တယ်။ Admin list/detail ဖွင့်ရုံနဲ့ auto-expire မဖြစ်ဘူး။
4. **Frontend/backend status button မကိုက်ခြင်း** — Frontend က `QUOTATION_SENT`/`CUSTOMER_REVIEWING` အချိန်မှာ "Customer reviewing", "Mark accepted", "Mark rejected", "Mark expired" button တွေ ပြတယ်။ ဒါပေမယ့် backend က အဲဒီ manual status တွေကို လက်မခံဘူး။
5. **v2 draft ရှိနေချိန် v1 accept** — v2 draft ဆွဲထားချိန်မှာ customer က v1 (current) ကို accept လုပ်နိုင်တယ်။ ဒါဖြစ်ရင် request `ACCEPTED` ဖြစ်သွားပြီး v2 ကို send လုပ်လို့မရတော့ဘူး။
6. **Assignment informational** — assigned admin မဟုတ်လည်း အခြား admin က action လုပ်နိုင်တယ်။
7. **Supplier response မရှိဘဲ send** — code က ပိတ်ထားတာ မဟုတ်ဘူး။ Business rule အရ မလုပ်သင့်ပါ။

---

## ၁၀။ Admin Quick Checklist

### Request အသစ် ရလာရင်
- [ ] Request detail ဖွင့်ပြီး customer အချက်အလက် စစ်
- [ ] ကိုယ့်ကိုယ် ဒါမှမဟုတ် staff ကို assign လုပ်
- [ ] Supplier group တွေ ခွဲပြီး ဆက်သွယ်မယ့် supplier တွေ သတ်မှတ်
- [ ] Viber/Phone/Email ဆက်သွယ်မှု log တင်
- [ ] Supplier response မှတ်တမ်းတင်

### Quotation ပြင်ဆင်တဲ့အခါ
- [ ] Confirmed unit price, quantity, discount ထည့်
- [ ] Delivery fee, service fee %, valid_until စစ်
- [ ] Total ကို server တွက်ထားတာ အတည်ပြု
- [ ] PDF ထုတ်ပြီး စစ်
- [ ] Send မလုပ်ခင် customer ဆီ ပို့မယ့် အချက်အလက် အားလုံး မှန်/မှန် စစ်

### Send ပြီးနောက်
- [ ] Email status စစ် (fail ရင် resend)
- [ ] Customer ရဲ့ accept/reject/change request စောင့်
- [ ] Change request ရရင် version အသစ် ဆွဲ
- [ ] Accept ရင် Orders ဘက်မှာ supplier confirmation ဆက်လုပ်

### ပိတ်တဲ့အခါ
- [ ] Reject/Cancel ဖြစ်ရင် request ကို terminal ထား
- [ ] လိုအပ်ရင် quotation request အသစ် ဖန်တီး
- [ ] Audit log နဲ့ email log စစ်

---

## ၁၁။ ဆက်စပ် ဖိုင်များ

| ဖိုင် | အကြောင်းအရာ |
|---|---|
| `specification/LogicFlow.md` | အဆင့်လိုက် business flow |
| `specification/StatusDefinitions.md` | Status အားလုံးနဲ့ valid transitions |
| `specification/MoneyAndValidationRules.md` | ငွေကြေးတွက်ချက်မှုနဲ့ validation |
| `specification/RolesPermissions.md` | Customer/Admin permission |
| `tasks/06-customer-quotation-request.md` | Customer request တင်ခြင်း |
| `tasks/07-admin-quotation-workflow.md` | Admin quotation workflow |
| `tasks/08-customer-quotation-actions.md` | Customer accept/reject/change |
| `tasks/09-order-and-supplier-confirmation.md` | Accept → Order conversion |
| `laravel-api/app/Services/Quotation/QuotationWorkflowService.php` | Admin version create/edit/send/resend |
| `laravel-api/app/Services/Quotation/CustomerQuotationService.php` | Customer view/accept/reject/change |
| `laravel-api/app/Services/Quotation/QuotationTotalsCalculator.php` | Total တွက်ချက်မှု |
| `react-app/src/features/admin/pages/QuotationRequestDetailPage.tsx` | Admin quotation detail UI |
| `react-app/src/features/admin/pages/QuotationVersionFormPage.tsx` | Version create/edit UI |
