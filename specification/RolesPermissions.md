# CoSupply Roles and Permissions

## 1. Current MVP Roles

### Guest

Website ဝင်ပြီး Product ကြည့်သူ။ Account မရှိသေးပါ။

ခွင့်ပြုချက်များ:

- Home, Category, Product List ကြည့်နိုင်
- Product Search/Filter လုပ်နိုင်
- Product Detail ကြည့်နိုင်
- Cart ထဲထည့်နိုင်၊ Cart ပြင်နိုင်
- `Request Quotation` နှိပ်လျှင် Customer Login/Register page သို့သွားနိုင်

မလုပ်နိုင်သောအရာများ:

- Quotation Request တင်ခြင်း
- Quotation, Order, Delivery detail ကြည့်ခြင်း
- Quotation Accept/Reject/Change Request လုပ်ခြင်း
- Direct Order တင်ခြင်း
- Admin pages ဝင်ခြင်း

### Customer / Buyer

Register လုပ်ပြီး Login ဝင်ထားသော Customer ဖြစ်သည်။

- Product browse/search/filter နှင့် Cart သုံးနိုင်
- Quotation Request တင်နိုင်
- မိမိ `customer_id` နှင့် ဆိုင်သော Quotation များသာ ကြည့်နိုင်
- မိမိ current valid quotation ကို Accept/Reject/Change Request လုပ်နိုင်
- မိမိ Order များသာ ကြည့်နိုင်
- Delivery address ပြင်နိုင်
- Order status နှင့် Delivery status ကြည့်နိုင်
- Cash on Delivery terms အတည်ပြုနိုင်
- မိမိ receipt ကို ကြည့်/ဒေါင်းလုဒ်နိုင်
- မိမိ in-app notification များကို ကြည့်/read လုပ်နိုင်

### Admin

Supplier, Product, Quotation, Order, Delivery နှင့် Cash Collection အားလုံးကို စီမံသူ။

- Supplier Create/Edit/Deactivate
- Category Create/Edit
- Product Create/Edit/Publish/Hide
- Customer ကြည့်ရှုခြင်း
- Quotation Request assign လုပ်ခြင်း
- Supplier ကို Viber/Phone/Email ဆက်သွယ်မှတ်တမ်းတင်ခြင်း
- Final Quotation version ပြင်ဆင်/ပို့ခြင်း/resend email လုပ်ခြင်း
- Order status၊ Delivery status နှင့် Payment status ပြောင်းခြင်း
- Delivery စီမံခြင်း
- Cash collection မှတ်တမ်းတင်/အတည်ပြုခြင်း
- Invoice/Receipt ထုတ်ခြင်း
- Master setting စီမံခြင်း
- Report နှင့် Audit Log ကြည့်ခြင်း

### Supplier (Future Phase)

လက်ရှိ MVP တွင် Login မရှိပါ။ အနာဂတ်တွင် ထည့်နိုင်မည့် permission များ:

- Supplier login
- Own profile edit
- Own product create/edit
- Own stock update
- Own order accept/reject
- Delivery update
- Sales report ကြည့်ခြင်း

## 2. Permission Matrix

| Feature | Guest | Customer | Admin | Supplier (Future) |
|---|---:|---:|---:|---:|
| View published products | Yes | Yes | Yes | Yes |
| Add to cart | Yes | Yes | No | No |
| Submit quotation request | No | Yes | No | No |
| View own quotation | No | Yes, authenticated ownership only | Yes | No |
| Accept/reject/request quotation change | No | Own current quotation only | On behalf with audit log | No |
| View own orders | No | Yes, authenticated ownership only | Yes | Future own only |
| Create supplier | No | No | Yes | No |
| Create product | No | No | Yes | Future own only |
| Approve/publish product | No | No | Yes | No |
| Contact supplier | No | No | Yes | No |
| Create final quotation | No | No | Yes | No |
| Update order/delivery/payment status | No | Request only | Yes | Future limited |
| Record cash collection | No | No | Yes | Future limited |
| View notifications | No | Own only | Own/admin only | Future own only |
| View audit logs | No | No | Yes | No |

## 3. Security Rules

- Quotation Request တင်ရန် Customer authentication မဖြစ်မနေလိုအပ်သည်။
- Customer သည် authenticated account ၏ `customer_id` နှင့် ဆိုင်သော Quotation, Order, Delivery, Receipt နှင့် Notification များကိုသာ access လုပ်ရမည်။
- API သည် client ပို့လာသော `customer_id` ကို မယုံရ။ Authenticated token/session မှ customer identity ကိုယူပြီး ownership ကို server-side မှ စစ်ရမည်။
- Guest token, quotation link token, email verification နှင့် phone OTP verification ကို MVP တွင် အသုံးမပြုရ။
- Admin actions အားလုံး audit log ထားရမည်။
- Password ကို plaintext မသိမ်းရ။ Strong password hashing သုံးရမည်။
- Supplier phone/Viber information ကို Public Product page တွင် လိုအပ်သလောက်သာ ပြရမည်။
- Cash collection amount နှင့် order total ကို Customer က ပြင်ခွင့်မရှိရ။
- Sensitive receipt, payment proof, signature နှင့် communication attachment များကို private Laravel storage တွင် သိမ်းပြီး permission စစ်ပြီးမှ download/stream ပေးရမည်။
