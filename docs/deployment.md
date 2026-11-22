# CoSupply Deployment Checklist (cPanel)

Production layout:

| Piece | Domain | Document root |
| --- | --- | --- |
| React SPA | `https://cosupplymm.com` | cPanel public HTML folder for `cosupplymm.com` (static build output) |
| Laravel API | `https://api.cosupplymm.com` | `laravel-api/public` — **never** the project root. On the current Z.com cPanel the document root is fixed at `public_html/api.cosupplymm.com` with a custom `index.php`; see [`cpanel-deployment.md`](./cpanel-deployment.md#api-document-root). |

The API is a Laravel 12 application on PHP 8.2+, MySQL, and local file storage.
There is **no scheduler, queue worker, or WebSocket process** in the MVP.

For the concrete cPanel account, real paths, upload steps, and the failures we
have already hit in production, use
[`cpanel-deployment.md`](./cpanel-deployment.md). This file is the generic
checklist.

---

## 1. Server requirements

- PHP 8.2+ with `pdo_mysql`, `mbstring`, `openssl`, `fileinfo`, `tokenizer`,
  `xml`, `ctype`, `json`, `bcmath`, `curl`.
- MySQL 8.0+ or MariaDB 10.4+.
- Apache with `mod_rewrite` (the shipped `public/.htaccess` handles the front
  controller and the `Authorization` header).
- Composer 2 on the server (or upload `vendor/` from a trusted build).
- Node 22 only for building the SPA; it is not needed at runtime.

## 2. Build the SPA before upload

```bash
cd react-app
# .env.production (or the shell environment):
# VITE_API_URL=https://api.cosupplymm.com/api/v1
npm ci
npm run build
```

Package the **contents** of `react-app/dist/` (so `index.html` is at the zip
root, not inside a `dist/` folder), back up the current frontend, then extract
the zip into the `cosupplymm.com` document root. The build is static; no Node
process runs in production, and cPanel has no Node/npm.

Keep the frontend `.htaccess` in place so deep links such as `/admin/orders`
still rewrite to `/index.html`.

## 3. Environment configuration

Create `laravel-api/.env` from `.env.example` and set at minimum:

```dotenv
APP_NAME=CoSupply
APP_ENV=production
APP_DEBUG=false
APP_KEY=base64:...              # php artisan key:generate --show
APP_URL=https://api.cosupplymm.com

FRONTEND_URL=https://cosupplymm.com
# Token auth only (Authorization: Bearer ...). Keep this empty: listing the
# SPA domain makes Sanctum run its cookie/CSRF middleware and Bearer-token
# requests then fail with HTTP 419 "CSRF token mismatch".
SANCTUM_STATEFUL_DOMAINS=

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=<cpanel_database>
DB_USERNAME=<cpanel_database_user>
DB_PASSWORD=<strong_password>

SESSION_DRIVER=database
SESSION_SECURE_COOKIE=true
SESSION_DOMAIN=null

FILESYSTEM_DISK=local
QUEUE_CONNECTION=sync

MAIL_MAILER=smtp
MAIL_HOST=<smtp_host>
MAIL_PORT=587
MAIL_SCHEME=null                 # STARTTLS on 587; use "smtps" for implicit TLS
MAIL_USERNAME=<smtp_user>
MAIL_PASSWORD=<smtp_password>
MAIL_FROM_ADDRESS=no-reply@cosupplymm.com
MAIL_FROM_NAME="CoSupply"
```

Secret handling:

- Never commit `.env`; it is already excluded from the repository.
- Restrict it to the account and web user: `chmod 600 .env`.
- Use a dedicated MySQL user with rights only on the CoSupply database.
- Rotate `APP_KEY` only with a planned re-encryption/re-login step; changing it
  invalidates encrypted sessions.
- Keep SMTP and database passwords in the hosting panel's secret store when
  available, not in tickets or chat.

## 4. Deploy the API (Git-based)

The API is deployed from the `main` branch, not from a zip. On the server:

```bash
cd ~/cosupply/cossupply-repo
git pull origin main
bash ~/cosupply/deploy-laravel.sh
```

The deploy script updates `~/cosupply/laravel-api` (the served release), keeps
`.env` and `storage/app`, runs `composer install --no-dev --optimize-autoloader`,
runs `php artisan migrate --force`, and rebuilds the caches. See
[`cpanel-deployment.md`](./cpanel-deployment.md#13-updating-a-release) for the
full sequence and the manual fallback.

First install only:

```bash
# from the uploaded project directory (outside the web root)
composer install --no-dev --optimize-autoloader
php artisan key:generate --force      # only on the first deploy, if APP_KEY is empty
php artisan migrate --force
php artisan storage:link
```

Create `.env` first (section 3): `key:generate` writes the key into that file.
If `.env` is not writable, use `php artisan key:generate --show` and paste the
value manually.

## 5. Storage and writable directories

The public catalog images and supplier logos live on the `public` disk and are
served through `public/storage` (created by `storage:link`). Private files
(receipts, quotation PDFs, cash-proof attachments) stay under
`storage/app/private` and are only streamed through authenticated endpoints.

```bash
chmod -R ug+rwX storage bootstrap/cache
# Directories 775, files 664; do not use 777.
```

If the document root is a copy of `public/` (the current Z.com cPanel setup),
`php artisan storage:link` is not enough — create the symlink in the served
folder as well:

```bash
cd /home/zufpszw2/public_html/api.cosupplymm.com
ln -s /home/zufpszw2/cosupply/laravel-api/storage/app/public storage
```

If the host blocks symlinks, create the `public/storage` link from the cPanel
File Manager or a one-off PHP script that calls `symlink()`. Verify with:

```bash
curl -I https://api.cosupplymm.com/storage/products/<file>.png
```

## 6. Database

```bash
php artisan migrate --force
php artisan migrate:status
```

- Do **not** run `DemoDataSeeder` in production; it truncates domain tables.
- `DatabaseSeeder` only seeds the default admin and master settings when run
  explicitly; migrations alone do not seed.
- Back up the database immediately before every migration.
- For the first deploy, create the default admin through the documented seeding
  path, then **replace its password immediately**. There is no admin
  change-password endpoint yet, so update the bcrypt hash in the database (see
  [`cpanel-deployment.md`](./cpanel-deployment.md#admin-account)).
- Never leave `admin@cos.local` / `password` active on a public site.

## 7. Cache and optimization

```bash
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

Whenever `.env` or config changes, run `php artisan optimize:clear` and rebuild
the caches. Keep `APP_DEBUG=false` so stack traces are never returned by the
API; errors use the `{"success": false, "message": "..."}` envelope.

`bootstrap/cache/config.php` overrides `.env` while it exists. If a changed
value has no effect, delete that file or run `php artisan optimize:clear`
before rebuilding the cache.

## 8. HTTPS and CORS

- Force HTTPS at the cPanel/Apache level for both domains; set `APP_URL` and
  `FRONTEND_URL` to `https://`.
- Authentication is Bearer-token only. Do **not** set
  `SANCTUM_STATEFUL_DOMAINS` to the SPA domain and do not enable
  `$middleware->statefulApi()`; both put the API into Sanctum's cookie/CSRF
  flow and make login fail with HTTP 419.
- Enable `SESSION_SECURE_COOKIE=true` for any `web` routes; the API itself does
  not start a session.
- CORS allows exactly the `FRONTEND_URL` origin (`config/cors.php`). Do not use
  `*`. `supports_credentials` is `false` for Bearer-token auth; enable it only
  if cookie auth is added.
- Verify preflight:

```bash
curl -i -X OPTIONS https://api.cosupplymm.com/api/v1/products \
  -H "Origin: https://cosupplymm.com" \
  -H "Access-Control-Request-Method: GET"
```

Expect `Access-Control-Allow-Origin: https://cosupplymm.com`. With
`supports_credentials = false`, `Access-Control-Allow-Credentials` should be
absent.

## 9. No scheduler or long-running process

- `QUEUE_CONNECTION=sync`: quotation/order emails are sent synchronously and
  recorded in `email_logs`; failures do not roll back business records.
- Notifications are database-backed and polled by the SPA every 60 seconds.
- **Do not add** `schedule:run` cron entries, `queue:work`, Horizon, or
  WebSocket/Reverb processes for core MVP behavior.
- An infrastructure cron job for database/file backups is still recommended
  (see below); it is not part of the application runtime.

## 10. Backups

Back up both the database and local files before launch and on a schedule.

```bash
# Database (run from the project directory)
mysqldump --single-transaction --quick --routines \
  -h "$DB_HOST" -u "$DB_USERNAME" -p "$DB_DATABASE" \
  | gzip > "backups/cos-$(date +%F_%H%M).sql.gz"

# Files: public images plus private receipts/PDFs/attachments
tar -czf "backups/storage-$(date +%F_%H%M).tar.gz" storage/app
```

- Include `storage/app/public` (catalog images) and `storage/app/private`
  (receipts, quotation PDFs, attachments).
- Keep at least 7 daily and 4 weekly copies, with one copy off the cPanel
  account (remote object storage or a downloaded archive).
- Store `.env` separately in a password manager; it is required to restore.
- Test a restore into a staging database at least once before launch. A backup
  that has never been restored is not a verified backup.

## 11. Post-deploy smoke test

1. `GET https://api.cosupplymm.com/api/v1/health` returns `success: true`.
2. `https://cosupplymm.com` loads the catalog; product images resolve from
   `https://api.cosupplymm.com/storage/...`.
3. Register a test customer, submit a quotation request, log in as Admin and
   send a quotation; confirm the customer receives the in-app notification.
4. Accept the quotation, complete delivery and full COD collection, and
   download the receipt as the owner.
5. Confirm a second customer receives `404` for the first customer's
   quotation, order, receipt, and notification.
6. Request a missing route with `APP_DEBUG=false` and confirm no stack trace or
   SQL is exposed.
7. Log out; confirm the token is revoked and protected pages redirect to login.

## 12. Rollback

- Keep the previous release directory and database dump until smoke tests pass.
- Enable maintenance mode during a rollback: `php artisan down`, restore code
  and dump, `php artisan migrate:rollback --force` only when the release added
  migrations, then `php artisan up`.
- Rebuild caches (`php artisan optimize:clear && php artisan config:cache`).
- Never roll back by deleting `storage/app`; it contains private receipts.

## 13. Troubleshooting

The recurring production failures and their fixes are documented in
[`cpanel-deployment.md`](./cpanel-deployment.md#14-troubleshooting):

- `MissingAppKeyException` — `.env` missing/empty or stale config cache.
- `419` on `/api/v1/admin/login` — `SANCTUM_STATEFUL_DOMAINS` or
  `statefulApi()` still enabled.
- Browser "CORS error" hiding a 419/500 response.
- `500` — check `storage/logs/laravel.log`, permissions, DB credentials.
- `404` on API routes — wrong document root or missing `.htaccess`.

---

## Repeatable checklist

- [ ] PHP extensions and MySQL version verified
- [ ] SPA built locally with `VITE_API_URL=https://api.cosupplymm.com/api/v1`
- [ ] SPA zip contains the contents of `dist/` (no nested folder, no source, no `node_modules`)
- [ ] API document root points at `laravel-api/public`, or at the maintained `public_html/api.cosupplymm.com` copy with its custom `index.php`
- [ ] Backend pulled with `git pull origin main` in `~/cosupply/cossupply-repo`
- [ ] `deploy-laravel.sh` completed and `https://api.cosupplymm.com/up` returns `200`
- [ ] `.env` created, `APP_KEY` set, `APP_DEBUG=false`, `APP_ENV=production`
- [ ] `FRONTEND_URL` set to the SPA origin; `SANCTUM_STATEFUL_DOMAINS` left empty (token auth)
- [ ] `composer install --no-dev --optimize-autoloader`
- [ ] Database backed up, then `php artisan migrate --force`
- [ ] `php artisan storage:link` plus the served doc-root symlink, and image URL verified
- [ ] `storage` and `bootstrap/cache` writable (775/664, never 777)
- [ ] Config/route/view caches rebuilt
- [ ] HTTPS forced; secure cookies enabled
- [ ] CORS preflight returns only `https://cosupplymm.com` (no credentials header)
- [ ] No queue worker or scheduler registered
- [ ] Backup and restore procedure documented and tested
- [ ] All eight end-to-end scenarios pass in staging
- [ ] `php artisan test` and `vendor/bin/pint --test` pass
