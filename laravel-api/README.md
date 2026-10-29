# CoSupply Backend (`laravel-api`)

Laravel 12 REST API for the CoSupply B2B quotation/order platform. APIs use the
`/api/v1` prefix, Sanctum token authentication, a consistent JSON envelope, and
integer Myanmar Kyat (MMK) money values.

- API contract reference: [`api_doc.md`](api_doc.md)
- Domain/data model: [`../specification/DatabaseFlow.md`](../specification/DatabaseFlow.md)

## Requirements

- PHP 8.2+
- Composer
- MySQL (the default local connection is `mysql`, database `cos`)

## Setup

```bash
composer install
cp .env.example .env          # only if .env is missing
php artisan key:generate
php artisan migrate
php artisan storage:link      # required so public image URLs resolve
```

## Seeding

`DatabaseSeeder` always seeds the default admin and the 15 master settings. In
the `local` and `testing` environments it additionally runs `DemoDataSeeder`.

```bash
# Full reset + seed (recommended, one command)
php artisan migrate:fresh --seed

# Re-seed the demo dataset onto an existing database
php artisan db:seed --class=DemoDataSeeder
```

### Destructive warning

`DemoDataSeeder` **truncates and rebuilds** the 22 mutable domain tables
(customers, catalog, quotations, orders, deliveries, payments, notifications,
logs, ...) on every run. It never touches `admins` or `settings`, so the default
admin and master settings survive, but **any other data in those 22 tables is
permanently erased**.

It refuses to run when `APP_ENV=production` (both the `DatabaseSeeder` guard and
a guard inside `DemoDataSeeder` itself, because `db:seed --class=DemoDataSeeder`
bypasses `DatabaseSeeder`). Only run it against a disposable **local dev**
database.

### Demo credentials

The password for every seeded account is `password`.

| Role     | Login identifier    | Password   | Notes                                   |
| -------- | ------------------- | ---------- | --------------------------------------- |
| Admin    | `admin@cos.local`   | `password` | Default super admin (never truncated).  |
| Admin    | `admin.demo@cos.local` | `password` | Extra demo admin.                    |
| Admin    | `ops.demo@cos.local`   | `password` | Extra demo admin.                    |
| Customer | `customer1@cos.local` / phone `09100000001` | `password` | Individual customer. |
| Customer | `customer2@cos.local` / phone `09100000002` | `password` | Business customer (`Su Su Trading Co., Ltd.`). |
| Customer | `customer3@cos.local` / phone `09100000003` | `password` | Individual customer. |
| Customer | `customer4@cos.local` / phone `09100000004` | `password` | Individual customer. |
| Customer | `customer5@cos.local` / phone `09100000005` | `password` | Individual customer. |

### What the demo dataset contains

- 2 demo admins (plus the default super admin), 4 parent + 8 child categories.
- 8 suppliers (mixed `verified`, 1 inactive), ~48 products (40 published,
  3 draft, 3 hidden, 2 out of stock; 4 published products have no photo to
  exercise the UI empty state).
- One price and one stock row per product covering every `StockStatus`.
- 5 customers, 6 addresses (2 defaults), 12 quotation requests covering all
  11 `QuotationRequestStatus` cases.
- Quotation versions covering DRAFT/SENT/VIEWED/CHANGE_REQUESTED/ACCEPTED/
  REJECTED/EXPIRED/SUPERSEDED, including one request with v1 `SUPERSEDED` and
  v2 `SENT`.
- Orders built only from accepted quotations, with deliveries, a confirmed COD
  cash payment, status history, in-app notifications, email logs and audit logs.

The dataset is deterministic: `fake()->seed()` is fixed and tables are truncated
first, so ids (1, 2, 3, ...) and re-run row counts are stable.

Placeholder product images and supplier logos are written to the `public` disk
(`storage/app/public/products` and `storage/app/public/suppliers`). The seeder
embeds a small base64 PNG and needs neither GD nor Intervention Image.

## Testing and formatting

```bash
php artisan test
vendor/bin/pint --test
```

## Deployment

Production (cPanel) setup, environment/secret handling, HTTPS/CORS, storage
permissions, migrations and backups: [`../docs/deployment.md`](../docs/deployment.md).

No scheduler or long-running queue worker is required. `QUEUE_CONNECTION=sync`
keeps email delivery synchronous, and in-app notifications are polled by the SPA.

## About Laravel

Laravel is accessible, powerful, and provides tools required for large, robust
applications. See the [Laravel documentation](https://laravel.com/docs) for
framework details.
