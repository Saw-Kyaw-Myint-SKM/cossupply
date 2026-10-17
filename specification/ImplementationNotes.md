# CoSupply Implementation Notes

## 1. Current Implementation Boundary

လက်ရှိ MVP တွင် Supplier သည် System user မဟုတ်ပါ။ Supplier data ကို Admin က ထည့်ပြီး Product နှင့် Quotation workflow ကို Admin က စီမံမည်။

Guest သည် Public catalog နှင့် Cart ကိုသာ သုံးနိုင်သည်။ Quotation Request တင်ရန် Customer register/login ဝင်ထားရမည်။ Customer quotation/order access ကို authenticated account ၏ `customer_id` ownership ဖြင့် ကာကွယ်မည်။

## 2. Technical Architecture

```text
React SPA (Tailwind CSS + React Router)
  - Localhost development only
  - Public pages, Customer pages, Admin pages
  ↓ REST API /api/v1
Laravel API
  - Localhost development only
  ↓
MySQL/MariaDB
```

- Backend: Laravel REST API
- Frontend: React + Tailwind CSS + React Router
- Architecture: API + Frontend separation; future mobile app သည် `/api/v1` API ကို ပြန်သုံးနိုင်ရမည်
- Database: MySQL/MariaDB
- Authentication: Laravel Sanctum သို့မဟုတ် equivalent authenticated API mechanism
- Development: localhost only; production domain, cPanel, Vercel, hosting, DNS နှင့် server configuration မသတ်မှတ်ရသေးပါ
- CORS: local React development origin ကိုသာ allow လုပ်ရမည်

## 3. MVP Infrastructure Decisions

### Local Laravel File Storage

MVP တွင် Laravel local filesystem ကို အသုံးပြုမည်။

```text
Public files:
storage/app/public/products/
storage/app/public/products/gallery/
storage/app/public/suppliers/logos/
storage/app/public/categories/

Private files:
storage/app/private/receipts/
storage/app/private/cash-payments/
storage/app/private/supplier-communications/
storage/app/private/signatures/
```

- Public media ကို `php artisan storage:link` ဖြင့် serve လုပ်နိုင်သည်။
- Receipt, cash payment proof, signature နှင့် supplier attachment များကို public URL မပေးရ။ Permission စစ်သော API endpoint ဖြင့်သာ stream/download ပေးရမည်။
- Upload file type/size limit နှင့် image compression ထည့်ရမည်။ Local development disk usage ကို စစ်ရမည်။

### Queue and Scheduler

- Queue worker နှင့် Laravel scheduler ကို MVP တွင် မသုံးပါ။
- `QUEUE_CONNECTION=sync` ကို အသုံးပြုနိုင်သည်။
- Email fail ဖြစ်လျှင် quotation/order business record ကို rollback မလုပ်ဘဲ email status/error ကို သိမ်းပြီး Admin Resend action ပေးရမည်။
- Quotation expiry ကို background update မလုပ်သေးပါ။ API request အချိန်တွင် `now() > valid_until` ကို စစ်ပြီး Accept action ကိုပိတ်ရမည်။

### Notifications

- Channels: Email + database-backed in-app notification
- Laravel သည် notification records ကို database တွင်သိမ်းရမည်။
- Login ဝင်ထားသော React application သည် authenticated notification endpoint ကို 60 seconds တစ်ကြိမ် polling လုပ်ရမည်။
- Polling သည် app root provider/service တစ်ခုတည်းတွင်ရှိရမည်; logout ဖြစ်လျှင် stop လုပ်ပြီး browser tab hidden ဖြစ်လျှင် pause လုပ်သင့်သည်။
- Realtime WebSocket နှင့် mobile push notification ကို MVP တွင် မသုံးပါ။
- Email fail ဖြစ်လျှင် business record ကို rollback မလုပ်ဘဲ failure status နှင့် Admin resend action ပေးရမည်။

## 4. Recommended Build Order

1. Project foundation: Laravel API, React SPA, environment, CORS, API versioning
2. Admin authentication and authorization
3. Customer registration, login, logout and authenticated ownership middleware
4. Master settings and audit-log foundation
5. Category management
6. Supplier management
7. Product management, images and pricing/stock
8. Public product browsing, search/filter and guest cart
9. Authenticated Customer quotation request
10. Admin quotation queue and supplier Viber contact log
11. Final quotation version builder, service-fee override, PDF export and Email/App notifications
12. Customer dashboard: quotation view and accept/change/reject
13. Transactional quotation-to-order conversion
14. Supplier confirmation, order status and delivery flow
15. Full COD cash collection and receipt
16. Email delivery, in-app notification polling and resend management
17. Order history, audit log and access-control verification

## 5. Important Implementation Decisions

- Direct order endpoint မပြုလုပ်ရ။ Customer accepted current valid quotation ဖြစ်မှ Order create လုပ်ရမည်။
- Quotation Request endpoint သည် Customer authentication မရှိဘဲ မခေါ်နိုင်ရ။ `customer_id` ကို authenticated identity မှယူရမည်။
- Quotation accept conversion သည် database transaction နှင့် row lock သုံးရမည်။
- `orders.quotation_id` unique constraint ဖြင့် quotation version တစ်ခုကို order တစ်ကြိမ်သာဖြစ်စေရမည်။
- `quotation_items` = customer original request snapshot, `quotation_version_items` = final quotation version snapshot, `order_items` = accepted quotation version snapshot ဖြစ်ရမည်။
- Order item တွင် product name, SKU, specification, unit price ကို snapshot သိမ်းရမည်။
- Viber contact ကို ပထမအဆင့် manual link/copy message နှင့် communication log ဖြင့်လုပ်ရမည်။
- Customer detail access ကို authenticated customer account + server-side `customer_id` ownership ဖြင့် ကာကွယ်ရမည်။ Token/OTP/email-link access မသုံးရ။
- Money amount များကို MMK integer ဖြင့်သိမ်းရမည်။ `service_fee_percentage` ကို Master Setting မှ default ယူပြီး quotation version တစ်ခုချင်းအလိုက် Admin override လုပ်နိုင်ရမည်။ `service_fee = round(subtotal × service_fee_percentage / 100)` နှင့် `total_amount = subtotal - discount + delivery_fee + service_fee` ဖြစ်ရမည်။
- Quotation version PDF ကို Admin က generate/download လုပ်ပြီး Viber, Telegram, Email သို့မဟုတ် အခြား manual channel ဖြင့် share လုပ်နိုင်ရမည်။
- Full payment only: `amount_collected = amount_due` ဖြစ်မှ payment confirm နှင့် order complete လုပ်ရမည်။
- Partial payment နှင့် partial delivery ကို MVP တွင် မခွင့်ပြုရ။
- Delivery ပြီးသော်လည်း cash မရသေးပါက Order `DELIVERED` နှင့် Payment `CASH_COLLECTION_PENDING` ဖြစ်နိုင်သည်။
- Cash payment confirmed ဖြစ်မှ Order `COMPLETED` ပြောင်းရမည်။

## 6. Minimum Admin Screens

- Admin Login
- Dashboard
- Master Settings
- Supplier List / Create / Edit
- Category List / Create / Edit
- Product List / Create / Edit
- Quotation Request List
- Quotation Request Detail
- Supplier Communication Log
- Create/Edit/Send Quotation Version
- Order List
- Order Detail
- Delivery Detail
- Cash Collection Record
- Customer List
- Notification List
- Email Delivery / Resend Log
- Audit Log

## 7. Minimum Customer Screens

- Register
- Login / Logout
- Home
- Category/Product List
- Product Detail
- Cart
- Request Quotation Form
- Quotation Request Success
- Customer Dashboard
- My Quotations
- View Quotation
- Accept/Change/Reject Quotation
- My Orders
- Order Detail / Track Order
- Receipt View/Download
- Notification Center

## 8. Future Phase

- Supplier login/dashboard
- Supplier self-service catalog
- Automatic Viber or messaging integration
- Online payment options
- Partial payment and partial delivery/split order module
- Queue worker and scheduler automation
- Quotation expiry scheduled updates
- S3/R2 object storage migration
- Realtime WebSocket notification
- Supplier commission and settlement
- Company approval workflow
- Delivery partner integration
- Reviews and ratings
