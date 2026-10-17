# CoSupply Status Definitions

## 1. Supplier Status

| Status | အဓိပ္ပာယ် |
|---|---|
| `ACTIVE` | Admin က အသုံးပြုနေသော Supplier ဖြစ်သည်။ Product ပြသနိုင်သည်။ |
| `INACTIVE` | ယာယီအသုံးမပြုပါ။ Product အသစ် Publish မလုပ်ရ။ |
| `SUSPENDED` | Complaint သို့မဟုတ် အခြားအကြောင်းကြောင့် ရပ်ဆိုင်းထားသည်။ |

## 2. Product Status

| Status | အဓိပ္ပာယ် |
|---|---|
| `DRAFT` | Admin က မပြီးသေးသော Product ဖြစ်သည်။ Public မမြင်ရ။ |
| `PUBLISHED` | Customer များမြင်နိုင်ပြီး Cart ထဲထည့်နိုင်သည်။ |
| `HIDDEN` | Public မှာ မပြသပါ။ |
| `OUT_OF_STOCK` | လက်ရှိ မရနိုင်ပါ။ Cart/Quotation အသစ် မခွင့်ပြုရ။ |

## 3. Stock Status

| Status | အဓိပ္ပာယ် |
|---|---|
| `IN_STOCK` | Supplier ထံတွင် ရှိသည်ဟု Admin မှ အတည်ပြုထားသည်။ |
| `LOW_STOCK` | အရေအတွက်နည်းနေသည်။ |
| `OUT_OF_STOCK` | မရှိပါ။ |
| `PRE_ORDER` | ကြိုတင်မှာယူရမည်။ |
| `SUPPLIER_CONFIRMATION_REQUIRED` | Supplier ကို ပြန်မေးပြီးမှ အတည်ပြုရမည်။ |

## 4. Quotation Request Status

| Status | အဓိပ္ပာယ် |
|---|---|
| `NEW` | Authenticated Customer က Request အသစ်တင်ထားသည်။ |
| `CONTACTING_SUPPLIER` | Admin က Supplier ကို Viber ဖြင့် ဆက်သွယ်နေသည်။ |
| `SUPPLIER_RESPONSE_PENDING` | Supplier response စောင့်နေသည်။ |
| `PREPARING_QUOTATION` | Admin က Final Quotation version ပြင်နေသည်။ |
| `QUOTATION_SENT` | Current Final Quotation ကို Customer ထံ ပို့ပြီးသည်။ |
| `CUSTOMER_REVIEWING` | Customer က Current Quotation ကို ကြည့်ရှုနေသည်။ |
| `CHANGE_REQUESTED` | Customer က quotation ပြင်ဆင်ရန် တောင်းထားသည်။ |
| `ACCEPTED` | Customer က Current Quotation ကို လက်ခံပြီး Order ဖန်တီးပြီး/ဖန်တီးနေသည်။ |
| `REJECTED` | Customer က Quotation ငြင်းပယ်ပြီးသည်။ |
| `EXPIRED` | Current quotation ၏ `valid_until` ကျော်သွားသည်။ |
| `CANCELLED` | Request ကို ပယ်ဖျက်ထားသည်။ |

## 5. Quotation Version Status

| Status | အဓိပ္ပာယ် |
|---|---|
| `DRAFT` | Admin ပြင်ဆင်နေသော quotation version ဖြစ်သည်။ Customer မမြင်ရ။ |
| `SENT` | Customer ထံ ပို့ပြီးသော current quotation version ဖြစ်သည်။ |
| `VIEWED` | Customer က quotation version ကို ဖွင့်ကြည့်ပြီးသည်။ |
| `CHANGE_REQUESTED` | Customer က ဤ quotation version အတွက် ပြင်ဆင်ရန် တောင်းထားသည်။ |
| `ACCEPTED` | Customer က ဤ quotation version ကို လက်ခံပြီးသည်။ |
| `REJECTED` | Customer က ဤ quotation version ကို ငြင်းပယ်ပြီးသည်။ |
| `EXPIRED` | `valid_until` ကျော်သွားသော quotation version ဖြစ်သည်။ |
| `SUPERSEDED` | Version အသစ်ပို့ပြီးဖြစ်သောကြောင့် အစားထိုးခံရသော version ဖြစ်သည်။ |
| `CANCELLED` | Admin သို့မဟုတ် Customer cancellation ကြောင့် ပယ်ဖျက်ထားသည်။ |

## 6. Quotation Action

| Action | အဓိပ္ပာယ် |
|---|---|
| `VIEWED` | Authenticated Customer က မိမိ Quotation ကို ဖွင့်ကြည့်သည်။ |
| `ACCEPTED` | Customer က ဈေးနှုန်းနှင့် Terms ကို လက်ခံသည်။ |
| `REJECTED` | Customer က မဝယ်တော့ပါ။ |
| `REQUESTED_CHANGE` | Quantity, product, delivery သို့မဟုတ် price ပြင်ဆင်ရန် တောင်းသည်။ |

## 7. Order Status

| Status | အဓိပ္ပာယ် |
|---|---|
| `SUPPLIER_CONFIRMATION_REQUIRED` | Accepted quotation မှ order ဖန်တီးပြီးနောက် Supplier ထံ Stock/Delivery ပြန်စစ်ရန်လိုသည်။ |
| `ORDER_CONFIRMED` | Supplier availability နှင့် order terms ကို Admin က အတည်ပြုပြီးသည်။ |
| `PREPARING` | ပစ္စည်းပြင်ဆင်နေသည်။ |
| `READY_TO_SHIP` | ပို့ရန်အဆင်သင့်ဖြစ်သည်။ |
| `OUT_FOR_DELIVERY` | ပစ္စည်းပို့ဆောင်နေသည်။ |
| `DELIVERED` | Customer ထံ ပစ္စည်းအပြည့်အစုံ ရောက်ပြီးသည်။ |
| `COMPLETED` | ပစ္စည်းရောက်ပြီး Cash လက်ခံအတည်ပြုပြီးသည်။ |
| `SUPPLIER_UNAVAILABLE` | Supplier မှ မပေးနိုင်ကြောင်း အတည်ပြုသည်။ |
| `DELIVERY_FAILED` | Delivery မအောင်မြင်ပါ။ |
| `RETURNED` | ပစ္စည်း Supplier ထံ ပြန်ရောက်သည်။ |
| `CANCELLED` | Order ပယ်ဖျက်ပြီးသည်။ |

## 8. Payment Status — Cash on Delivery

| Status | အဓိပ္ပာယ် |
|---|---|
| `NOT_PAID` | Order မပို့ရသေး၊ ငွေမရသေး။ |
| `CASH_COLLECTION_PENDING` | Order ပို့နေ/ပို့ပြီးပြီး Cash ကောက်ခံရန် စောင့်နေသည်။ |
| `CASH_COLLECTED` | Delivery အချိန်တွင် full cash amount နှင့် receipt number ကို မှတ်တမ်းတင်ပြီးသည်။ |
| `PAYMENT_CONFIRMED` | Admin က Receipt/Collection record နှင့် full amount ကို စစ်ပြီး အတည်ပြုသည်။ |
| `PAYMENT_FAILED` | Cash collection process မအောင်မြင်ပါ။ |
| `CUSTOMER_REFUSED_TO_PAY` | Customer က Cash မချေဘဲ ငြင်းပယ်သည်။ |

> MVP တွင် partial payment မခွင့်ပြုသောကြောင့် `PARTIAL_PAYMENT` status မသုံးရ။ `amount_collected` သည် `amount_due` နှင့် တိတိကျကျတူရမည်။

## 9. Delivery Status

| Status | အဓိပ္ပာယ် |
|---|---|
| `NOT_ASSIGNED` | Delivery မစီစဉ်ရသေး။ |
| `PREPARING` | ပစ္စည်းထုပ်ပိုး/ပို့ရန် ပြင်ဆင်နေသည်။ |
| `OUT_FOR_DELIVERY` | Delivery ထွက်လာပြီ။ |
| `DELIVERED` | Customer က ပစ္စည်းအပြည့်အစုံ လက်ခံပြီးပြီ။ |
| `DELIVERY_FAILED` | လိပ်စာ၊ Customer မရှိခြင်း သို့မဟုတ် Cash မပြင်ဆင်ထားခြင်းကြောင့် မပို့နိုင်။ |
| `RETURNED` | ပစ္စည်း Supplier ထံ ပြန်ရောက်သည်။ |

> MVP တွင် partial delivery မခွင့်ပြုရ။

## 10. Valid State Transitions

### Quotation Request

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
  → PREPARING_QUOTATION (Admin creates a new quotation version)

ACCEPTED / REJECTED / CANCELLED
  → terminal
```

### Quotation Version

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
  → SUPERSEDED (when a new version is sent)

ACCEPTED / REJECTED / SUPERSEDED / CANCELLED
  → terminal
```

### Order

```text
SUPPLIER_CONFIRMATION_REQUIRED
  → ORDER_CONFIRMED
  → SUPPLIER_UNAVAILABLE
  → CANCELLED

ORDER_CONFIRMED
  → PREPARING
  → CANCELLED

PREPARING
  → READY_TO_SHIP
  → CANCELLED (Admin approval)

READY_TO_SHIP
  → OUT_FOR_DELIVERY
  → CANCELLED (Admin approval)

OUT_FOR_DELIVERY
  → DELIVERED
  → DELIVERY_FAILED
  → RETURNED

DELIVERY_FAILED
  → READY_TO_SHIP (re-delivery approved)
  → RETURNED
  → CANCELLED

DELIVERED
  → COMPLETED (only after PAYMENT_CONFIRMED)
  → RETURNED (approved return)

SUPPLIER_UNAVAILABLE / RETURNED / CANCELLED / COMPLETED
  → terminal
```

### Cash Payment

```text
NOT_PAID
  → CASH_COLLECTION_PENDING

CASH_COLLECTION_PENDING
  → CASH_COLLECTED
  → CUSTOMER_REFUSED_TO_PAY
  → PAYMENT_FAILED

CASH_COLLECTED
  → PAYMENT_CONFIRMED

PAYMENT_CONFIRMED / CUSTOMER_REFUSED_TO_PAY / PAYMENT_FAILED
  → terminal
```
