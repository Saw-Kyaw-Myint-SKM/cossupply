# CoSupply MVP Business Requirements

## 1. Product Purpose

CoSupply သည် Customer များကို ရုံးသုံးပစ္စည်းများကို Category နှင့် Supplier အလိုက် ရှာဖွေကြည့်ရှုစေပြီး၊ Login ဝင်ထားသော Customer များက လိုအပ်သောပစ္စည်းစာရင်းကို Quotation အဖြစ် တောင်းနိုင်စေမည့် Platform ဖြစ်သည်။ Admin သည် Supplier များနှင့် Viber ဖြင့် ဆက်သွယ်ကာ ဈေးနှုန်း၊ Stock နှင့် Delivery အချက်အလက်ကို စုစည်းပြီး Customer ထံ Final Quotation ပြန်ပို့မည်။

## 2. MVP Scope

### ပါဝင်မည့်အရာများ

- Public product browsing
- Product category နှင့် subcategory
- Supplier အလိုက် product ပြသခြင်း
- Product name, photo, size, brand, specification, display price နှင့် stock status
- Guest အတွက် shopping cart / အဝယ်စာရင်း
- Customer registration, login နှင့် logout
- Login ဝင်ထားသော Customer မှ Quotation Request တင်ခြင်း
- Customer name, phone, email, company name နှင့် delivery address စုဆောင်းခြင်း
- Customer dashboard မှ မိမိ Quotation နှင့် Order များကြည့်ခြင်း
- Customer မှ မိမိ Final Quotation ကို Accept, Reject သို့မဟုတ် Change Request လုပ်ခြင်း
- Admin မှ Supplier data ထည့်ခြင်း
- Admin မှ Product data ထည့်ခြင်း၊ ပြင်ခြင်း၊ ဖျက်ခြင်း၊ Publish/Hide လုပ်ခြင်း
- Admin မှ Viber ဆက်သွယ်မှုမှတ်တမ်း သိမ်းခြင်း
- Admin မှ Final Quotation version ပြင်ဆင်ခြင်းနှင့် Customer ထံ Email/App notification ဖြင့်ပို့ခြင်း
- Accepted Quotation ကို Order အဖြစ်ပြောင်းခြင်း
- Cash on Delivery only, full payment only
- Delivery status နှင့် cash collection မှတ်တမ်း
- Admin order list နှင့် order detail
- Email notification နှင့် in-app notification (API polling ဖြင့်)
- Order status history / audit trail

### MVP တွင် မပါသေးသောအရာများ

- Supplier registration/login
- Supplier dashboard
- Supplier self-service product upload
- Online payment gateway
- Bank transfer / mobile wallet payment
- Partial payment
- Partial delivery / split order delivery
- Automatic Viber API integration
- Automatic delivery tracking integration
- Automatic supplier settlement
- Multi-level company approval workflow
- Quotation token / phone OTP access flow
- Realtime WebSocket notification
- Queue worker နှင့် scheduler automation

## 3. Customer Requirements

### Guest Customer

Guest Customer သည် Register/Login မလုပ်ဘဲ အောက်ပါတို့ကို လုပ်နိုင်ရမည်။

- Home, Category, Product List, Product Detail ကြည့်နိုင်ခြင်း
- Product search နှင့် filter သုံးနိုင်ခြင်း
- Product ကို Cart ထဲထည့်နိုင်ခြင်း
- Cart ကိုကြည့်ခြင်းနှင့် ပြင်ဆင်ခြင်း

Guest Customer သည် Quotation Request, Quotation Detail, Order Detail သို့မဟုတ် Delivery Detail ကို မလုပ်/မကြည့်နိုင်ရ။ `Request Quotation` ကိုနှိပ်လျှင် Customer Login/Register screen သို့ ပို့ရမည်။

### Authenticated Customer

Customer account register လုပ်ပြီး Login ဝင်ထားသော Customer သာ Cart မှ Quotation Request တင်နိုင်ရမည်။ Quotation Request တင်ရာတွင် အနည်းဆုံး လိုအပ်သောအချက်များမှာ—

- Customer name
- Company name (B2B အတွက် အကြံပြု)
- Phone number
- Email (optional)
- City
- Township
- Full delivery address
- Landmark (optional)
- Required delivery date (optional)
- Additional note

Customer သည် မိမိ account (`customer_id`) နှင့် ဆိုင်သော Quotation နှင့် Order များကိုသာ ကြည့်နိုင်၊ Accept/Reject/Change Request လုပ်နိုင်ရမည်။ Guest quotation token နှင့် phone OTP verification ကို MVP တွင် မသုံးပါ။

## 4. Supplier Data Requirements

Supplier ကို Admin ကသာ Create/Edit လုပ်မည်။

- Shop name
- Company name
- Contact person
- Phone
- Viber phone
- Email
- Logo
- Address, city, township
- Business description
- Delivery area
- Delivery time
- Warranty policy
- Return policy
- Active/Inactive/Suspended status
- Created by admin

## 5. Product Requirements

- Product name in Myanmar and English
- Category and subcategory
- Supplier
- Photo and optional additional photos
- Brand
- Model / SKU
- Size
- Color
- Unit and package size
- Description and specification
- Display price
- Minimum order quantity
- Stock status
- Product status

Product price သည် အချိန်နှင့်အမျှ ပြောင်းနိုင်သောကြောင့် `last updated` နှင့် `price valid until` ကို ထည့်သင့်သည်။ Display price သည် Final Quotation price မဟုတ်ကြောင်း Customer ကို ပြရမည်။

## 6. Quotation Requirements

Quotation Request ကို authenticated Customer က Admin သို့တင်ပြီးနောက် Admin သည် Supplier ကို Viber ဖြင့် ဆက်သွယ်မည်။ Admin သည် Supplier ထံမှ အောက်ပါတို့ကို ရယူရမည်။

- Confirmed unit price
- Available stock
- Delivery fee
- Delivery date
- Warranty / return terms
- Price validity
- Supplier note

Customer ကို ပို့သော Final Quotation တွင်—

- Quotation number နှင့် version
- Product list နှင့် supplier
- Quantity
- Confirmed unit price
- Discount
- Service fee percentage
- Service fee amount
- Total amount
- Delivery date
- Payment terms: Cash on Delivery
- Valid until
- Admin note

ပါရမည်။ Admin သည် Quotation version တစ်ခုချင်းအလိုက် service fee percentage ကို Master Setting default မှယူပြီး လိုအပ်လျှင် override လုပ်နိုင်ရမည်။ Version အသစ် ပို့သောအခါ ယခင် active quotation ကို `SUPERSEDED` အဖြစ် သိမ်းရမည်။ Latest valid quotation version တစ်ခုတည်းသာ Accept လုပ်နိုင်ရမည်။ Admin သည် Quotation detail ကို PDF အဖြစ်ထုတ်ပြီး Viber, Telegram, Email သို့မဟုတ် အခြား manual channel ဖြင့် ပို့နိုင်ရမည်။

## 7. Order and Payment Requirements

Customer က valid Final Quotation ကို Accept လုပ်မှ Order ဖြစ်ရမည်။ Quotation မရှိဘဲ Direct Order မတင်ရ။

Payment method:

```text
CASH_ON_DELIVERY
```

- Currency သည် MMK ဖြစ်ပြီး decimal မပါသော integer amount ကိုသာ အသုံးပြုရမည်။
- Full payment only ဖြစ်သည်။ `amount_collected` သည် `amount_due` နှင့် တိတိကျကျတူမှ Payment Confirmed နှင့် Order Completed လုပ်နိုင်ရမည်။
- Partial payment နှင့် partial delivery ကို MVP တွင် မခွင့်ပြုရ။
- Customer သည် ပစ္စည်းရောက်ရှိချိန်တွင် သတ်မှတ်ထားသော စုစုပေါင်းငွေကို Cash ဖြင့် ပေးချေရမည်။ Delivery ပြီးသည်နှင့် Cash collection record နှင့် receipt number သိမ်းရမည်။

## 8. Non-functional Requirements

- Mobile-first responsive UI
- Burmese text ဖတ်ရလွယ်ကူခြင်း
- Product image များကို compress/lazy-load လုပ်ခြင်း
- Laravel local file storage ကို MVP တွင် အသုံးပြုခြင်း
- Public media နှင့် sensitive file များကို ခွဲသိမ်းခြင်း
- Admin action များအတွက် audit log ရှိခြင်း
- Price နှင့် Order item များကို snapshot အဖြစ် သိမ်းခြင်း
- Authenticated Customer သည် မိမိ quotation/order ကို dashboard မှ ပြန်ရှာနိုင်ခြင်း
- Admin သည် Customer phone၊ quotation number နှင့် order number ဖြင့် ရှာနိုင်ခြင်း
- Sensitive customer data ကို access control ဖြင့် ကာကွယ်ခြင်း
- Email နှင့် database-backed in-app notification ကို support လုပ်ခြင်း; authenticated React application သည် notification API ကို 60 seconds တစ်ကြိမ် polling လုပ်ခြင်း; realtime WebSocket notification ကို MVP တွင် မထည့်ခြင်း
