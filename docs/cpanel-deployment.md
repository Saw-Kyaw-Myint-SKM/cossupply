# CoSupply — cPanel Deployment Guide

Step-by-step deployment for the production cPanel account. The generic
checklist lives in [`deployment.md`](./deployment.md); this file records the
real host, paths, domains, and the failures we have already hit.

## Production reference

| Item | Value |
| --- | --- |
| Frontend (SPA) | `https://cosupplymm.com` |
| API | `https://api.cosupplymm.com` |
| cPanel account | `zufpszw2` |
| Laravel project (served) | `/home/zufpszw2/cosupply/laravel-api` |
| Git clone on server | `/home/zufpszw2/cosupply/cossupply-repo` (branch `main`) |
| Backend deploy script | `/home/zufpszw2/cosupply/deploy-laravel.sh` |
| API document root | `/home/zufpszw2/public_html/api.cosupplymm.com` (fixed — this host does not allow changing it) |
| Public storage | `/home/zufpszw2/public_html/api.cosupplymm.com/storage` → `/home/zufpszw2/cosupply/laravel-api/storage/app/public` |
| Frontend document root | `/home/zufpszw2/public_html/cosupplymm.com` |
| Frontend build | local `react-app/dist/` → ZIP → cPanel |
| cPanel Node/npm | not installed; build locally |
| Web server | LiteSpeed |
| PHP | 8.3 |
| Database | MySQL 8 / MariaDB 10.4+ |
| Auth | Laravel Sanctum **Bearer tokens** (no SPA cookies/CSRF) |
| Queue / scheduler | none (`QUEUE_CONNECTION=sync`) |

> The SPA stores its token in `localStorage` and sends
> `Authorization: Bearer <token>`. It does **not** use Sanctum's cookie/CSRF
> flow. Keep `SANCTUM_STATEFUL_DOMAINS` empty and never re-enable
> `$middleware->statefulApi()`.

## Server directory layout

```text
/home/zufpszw2/
│
├── cosupply/
│   ├── cossupply-repo/          # git clone, branch main
│   │   ├── laravel-api/
│   │   └── react-app/           # source only; never served
│   ├── laravel-api/             # served backend release
│   │   ├── app/
│   │   ├── bootstrap/
│   │   ├── config/
│   │   ├── database/
│   │   ├── public/
│   │   ├── routes/
│   │   ├── storage/
│   │   ├── vendor/
│   │   ├── .env
│   │   └── artisan
│   └── deploy-laravel.sh        # pull + sync + migrate + cache
│
└── public_html/
    ├── api.cosupplymm.com/
    │   ├── index.php
    │   ├── .htaccess
    │   ├── php.ini
    │   ├── .user.ini
    │   └── storage -> /home/zufpszw2/cosupply/laravel-api/storage/app/public
    │
    └── cosupplymm.com/          # frontend build output
        ├── index.html
        ├── assets/
        ├── .htaccess
        └── favicon / apple-touch-icon files
```

The Laravel application stays outside the web root. Only the API entry point
and the public assets are reachable through `public_html/api.cosupplymm.com`.

## Deployment workflow

Backend and frontend deploy separately. Neither deploy touches the other.

```text
BACKEND (Git-based)
local code → git push origin main
           → cPanel: git pull in ~/cosupply/cossupply-repo
           → bash ~/cosupply/deploy-laravel.sh
           → clear/rebuild cache → health check

FRONTEND (local ZIP)
local code → npm run build
           → ZIP the contents of react-app/dist/
           → upload to cPanel → backup existing frontend
           → extract into ~/public_html/cosupplymm.com/
           → test routes + API connection
```

## Deployment boundaries

- Deploy the backend and frontend independently.
- A frontend deploy must not modify `~/cosupply/laravel-api` or the API
  document root.
- A backend deploy must not modify `~/public_html/cosupplymm.com`.
- Never upload React source, `node_modules`, or the `dist/` wrapper folder into
  the public document root.
- Preserve the frontend `.htaccess` — SPA deep links depend on it.
- Back up the current frontend before extracting a new build.
- Back up the database and `storage/app` before backend migrations.

## Pre-deploy verification

Run these locally before the first upload:

- [ ] `react-app/.env.production` has
      `VITE_API_URL=https://api.cosupplymm.com/api/v1` (no trailing slash).
- [ ] `react-app/vite.config.ts` keeps `base` at the default `/`; the SPA is
      served from the domain root, not a sub-path.
- [ ] `npm run build` succeeds and `react-app/dist/index.html` references the
      current hashed files in `assets/`.
- [ ] The zip contains `index.html` at its root (not `dist/index.html`).
- [ ] `git status` is clean on `main` and the release is pushed to GitHub.
- [ ] `laravel-api/.env` exists on the server and is **not** in the repo.

## First deploy at a glance

First backend deploy only (after the files and `.env` exist, sections 4–8):

```bash
cd /home/zufpszw2/cosupply/laravel-api
php artisan key:generate --force
composer install --no-dev --optimize-autoloader   # skip if vendor/ uploaded
php artisan migrate --force
php artisan storage:link
php artisan db:seed --class=AdminSeeder --force   # replace its password afterwards
php artisan optimize:clear
php artisan config:cache && php artisan route:cache && php artisan view:cache
curl -I https://api.cosupplymm.com/up
```

Every later backend release:

```bash
cd /home/zufpszw2/cosupply/cossupply-repo
git pull origin main
bash /home/zufpszw2/cosupply/deploy-laravel.sh
curl -I https://api.cosupplymm.com/up
```

Every frontend release:

```bash
cd react-app
npm ci
npm run build
# ZIP the CONTENTS of dist/ (not the dist folder itself), then follow section 10.
```

The rest of this document explains each step and the failure modes.

---

## 1. What gets deployed

| Artifact | Source | Destination |
| --- | --- | --- |
| Backend source | GitHub `main` | `/home/zufpszw2/cosupply/cossupply-repo` |
| Backend release | `deploy-laravel.sh` | `/home/zufpszw2/cosupply/laravel-api` |
| API public files | `laravel-api/public/` | `/home/zufpszw2/public_html/api.cosupplymm.com` |
| SPA build | `react-app/dist/` | `/home/zufpszw2/public_html/cosupplymm.com` |
| SPA package | ZIP of `dist/` contents | same, unzipped |

Never upload the Laravel project root as the API document root. Only the
contents of `laravel-api/public` may be web-accessible.

Packaging rules:

- The backend uses **Git**, not a zip. Pull into `cossupply-repo`, then let
  `deploy-laravel.sh` update `laravel-api`.
- If you fall back to a manual backend upload, never include `.env`, `.git`,
  `node_modules`, `tests`, `.phpunit.result.cache`, or `storage/logs/*`.
- The frontend zip contains the **contents** of `react-app/dist/`, not the
  `dist/` folder itself, and never `react-app/src` or `node_modules`.
- Rebuild the frontend zip after every change. Never deploy a stale archive —
  check that `index.html` references the current `assets/*` hashes.

---

## 2. Build the SPA locally

`react-app/.env.production` must point at the production API:

```dotenv
VITE_API_URL=https://api.cosupplymm.com/api/v1
```

cPanel has **no Node.js or npm**, so the build must run locally:

```bash
cd react-app
npm ci
npm run build
```

The output is `react-app/dist/`. Create the upload zip from its **contents**,
so `index.html` is at the zip root:

```bash
# Git Bash / WSL, from the repo root
cd react-app/dist && zip -r ../../deploy/react-app-dist.zip .
```

```powershell
# PowerShell, from the repo root
Compress-Archive -Path react-app\dist\* -DestinationPath deploy\react-app-dist.zip -Force
```

The zip must contain `index.html`, `assets/`, `favicon.ico`,
`favicon-*.png`, `apple-touch-icon.png`, `.htaccess`, and `icons.svg` — not a
top-level `dist/` folder.

Upload the zip and extract it into `/home/zufpszw2/public_html/cosupplymm.com`
(section 10).

---

## 3. Create the database

cPanel → **MySQL Databases**:

1. Create a database, e.g. `zufpszw2_cos`.
2. Create a dedicated user with a strong password.
3. Add the user to the database with **All Privileges** on that database only.
4. Record the full names (`zufpszw2_cos`, `zufpszw2_cosuser`) — cPanel prefixes
   them with the account name.

Do not reuse the cPanel account password for MySQL.

---

## 4. Clone the Laravel API

The project lives **outside** `public_html`. Clone the repository once, then
let `deploy-laravel.sh` maintain the served release:

```bash
cd /home/zufpszw2/cosupply
git clone <repo-url> cossupply-repo
cd cossupply-repo
git checkout main
```

The served release directory is:

```text
/home/zufpszw2/cosupply/laravel-api/
├── app/
├── bootstrap/
├── config/
├── database/
├── public/
├── routes/
├── storage/
├── vendor/
├── artisan
├── composer.json
└── .env            ← created on the server, never committed
```

If `deploy-laravel.sh` does not exist yet, create `laravel-api` from the clone
once and install dependencies:

```bash
cp -a /home/zufpszw2/cosupply/cossupply-repo/laravel-api/. /home/zufpszw2/cosupply/laravel-api/
cd /home/zufpszw2/cosupply/laravel-api
composer install --no-dev --optimize-autoloader
```

If the server has no Composer 2, upload a `vendor/` directory built from a
trusted machine instead. Never commit `vendor/` to the repository.

### API document root

This host does **not** allow changing the document root away from
`public_html`, so the API subdomain uses:

```text
/home/zufpszw2/public_html/api.cosupplymm.com
```

That folder is a copy of `laravel-api/public` plus a custom `index.php` that
boots the project from `../../cosupply/laravel-api`.

Copy `laravel-api/public/.htaccess` and `laravel-api/public/index.php` there,
then replace `index.php` with:

```php
<?php

use Illuminate\Foundation\Application;
use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

if (file_exists($maintenance = __DIR__.'/../../cosupply/laravel-api/storage/framework/maintenance.php')) {
    require $maintenance;
}

require __DIR__.'/../../cosupply/laravel-api/vendor/autoload.php';

$app = require_once __DIR__.'/../../cosupply/laravel-api/bootstrap/app.php';

$app->handleRequest(Request::capture());
```

Verify the two relative paths resolve:

```bash
cd /home/zufpszw2/public_html/api.cosupplymm.com
ls -l ../../cosupply/laravel-api/vendor/autoload.php
ls -l ../../cosupply/laravel-api/bootstrap/app.php
```

Rules:

- When Laravel's `public/index.php` changes upstream, re-apply these relative
  paths; do not overwrite the custom entry point blindly.
- Preserve `php.ini`, `.user.ini`, and the `storage` symlink in this folder.
  Uploading a fresh copy of `public/` must not delete them.
- The API document root must contain `.htaccess` from `laravel-api/public`.

---

## 5. Create `.env`

Create `/home/zufpszw2/cosupply/laravel-api/.env` from `.env.example`:

```dotenv
APP_NAME=CoSupply
APP_ENV=production
APP_DEBUG=false
APP_KEY=
APP_URL=https://api.cosupplymm.com

FRONTEND_URL=https://cosupplymm.com
# Token auth only — keep this empty.
SANCTUM_STATEFUL_DOMAINS=
# Bearer-token lifetime in minutes (default 604800 = 7 days; 0 disables).
SANCTUM_EXPIRATION_MINUTES=10080

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=zufpszw2_cos
DB_USERNAME=zufpszw2_cosuser
DB_PASSWORD=<strong_database_password>

SESSION_DRIVER=database
SESSION_LIFETIME=120
SESSION_DOMAIN=null
SESSION_SECURE_COOKIE=true
SESSION_SAME_SITE=lax

FILESYSTEM_DISK=local
QUEUE_CONNECTION=sync

MAIL_MAILER=smtp
MAIL_HOST=<smtp_host>
MAIL_PORT=587
MAIL_SCHEME=null
MAIL_USERNAME=<smtp_user>
MAIL_PASSWORD=<smtp_password>
MAIL_FROM_ADDRESS=no-reply@cosupplymm.com
MAIL_FROM_NAME="CoSupply"
```

Rules:

- `.env` stays on the server only. Never commit it or put it in a public zip.
- `chmod 600 .env`.
- `SANCTUM_STATEFUL_DOMAINS=` must be empty (see troubleshooting).
- `SANCTUM_EXPIRATION_MINUTES` sets the Bearer-token lifetime (default `10080`
  = 7 days). `0` disables expiry; keep a finite value on public sites.
- `SESSION_DOMAIN=null` prevents a `.cosupplymm.com` cookie from being shared
  across the API and SPA.

---

## 6. Generate `APP_KEY`

`php artisan key:generate` writes into `.env`, so `.env` must exist first:

```bash
cd /home/zufpszw2/cosupply/laravel-api
php artisan key:generate --force
```

If `.env` is not writable, print a key and paste it in manually:

```bash
php artisan key:generate --show
# or without Artisan:
php -r "echo 'base64:'.base64_encode(random_bytes(32)), PHP_EOL;"
```

Then set:

```dotenv
APP_KEY=base64:...
```

Verify:

```bash
php artisan about
php artisan tinker --execute="var_dump(strlen(config('app.key')));"
# 51 = "base64:" + 44 characters
```

Each environment gets its own key. Do not copy the local development key.

---

## 7. Permissions and storage link

```bash
cd /home/zufpszw2/cosupply/laravel-api
chmod -R ug+rwX storage bootstrap/cache
chmod 600 .env
php artisan storage:link
```

`php artisan storage:link` creates `laravel-api/public/storage`, but the served
document root is `public_html/api.cosupplymm.com`, so create the link that the
web server actually uses:

```bash
cd /home/zufpszw2/public_html/api.cosupplymm.com
# Remove an empty/old directory first; never delete real files.
ln -s /home/zufpszw2/cosupply/laravel-api/storage/app/public storage
ls -l storage
```

- Directories `775`, files `664`; never `777`.
- Expected symlink:
  `storage -> /home/zufpszw2/cosupply/laravel-api/storage/app/public`.
- When uploading a new copy of `public/`, preserve this `storage` symlink,
  `php.ini`, and `.user.ini`.
- If the host blocks `symlink()`, ask the host to enable it or serve public
  files through an application route. Do not copy files manually on every
  upload.

Verify a public image:

```bash
curl -I https://api.cosupplymm.com/storage/products/<file>.png
```

---

## 8. Migrate and create the admin

```bash
cd /home/zufpszw2/cosupply/laravel-api
php artisan migrate --force
php artisan migrate:status
```

Do **not** run `DemoDataSeeder` in production — it truncates domain tables.

### Admin account

`AdminSeeder` creates `admin@cos.local` with the password `password`. That
default must not survive on production. Seed once, then replace the password
immediately:

```bash
php artisan db:seed --class=AdminSeeder --force
php -r "echo password_hash('REPLACE_WITH_STRONG_PASSWORD', PASSWORD_BCRYPT, ['cost'=>12]), PHP_EOL;"
```

```sql
UPDATE admins
SET email      = 'admin@cosupplymm.com',
    name       = 'Super Admin',
    phone      = '09xxxxxxxxx',
    password   = '<bcrypt_hash_from_above>',
    role       = 'super_admin',
    status     = 'active',
    updated_at = NOW()
WHERE email = 'admin@cos.local';
```

Or create/update it through Tinker (the model hashes `password` automatically):

```bash
php artisan tinker --execute="App\Models\Admin::updateOrCreate(
  ['email' => 'admin@cosupplymm.com'],
  ['name' => 'Super Admin', 'phone' => '09xxxxxxxxx', 'password' => 'REPLACE_WITH_STRONG_PASSWORD', 'role' => 'super_admin', 'status' => 'active']
);"
```

Use a password manager for the password. There is currently no
change-password endpoint for admins.

---

## 9. Build caches

```bash
cd /home/zufpszw2/cosupply/laravel-api
php artisan optimize:clear
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

Re-run `optimize:clear` and rebuild after **any** `.env` or config change.
`bootstrap/cache/config.php` overrides `.env` while it exists.

---

## 10. Upload the SPA (local ZIP)

The frontend document root is:

```text
/home/zufpszw2/public_html/cosupplymm.com
```

1. **Back up the current frontend** before touching it:

   ```bash
   mkdir -p /home/zufpszw2/backups
   cd /home/zufpszw2/public_html
   tar -czf /home/zufpszw2/backups/cosupplymm-frontend-$(date +%F_%H%M).tar.gz cosupplymm.com
   ```

2. Upload `deploy/react-app-dist.zip` with cPanel **File Manager** to
   `/home/zufpszw2/backups/` or another temporary folder (not into the document
   root).

3. Extract the zip into `/home/zufpszw2/public_html/cosupplymm.com/`. The zip
   root must contain `index.html`; do not extract it as a nested `dist/` or
   `react-app/` folder. Old hashed files in `assets/` are harmless but can be
   removed after the new build is verified.

4. Keep the SPA `.htaccess` in place — it rewrites deep links such as
   `/admin/orders` to `/index.html`:

   ```apache
   RewriteEngine On
   RewriteBase /
   RewriteRule ^index\.html$ - [L]
   RewriteCond %{REQUEST_FILENAME} !-f
   RewriteCond %{REQUEST_FILENAME} !-d
   RewriteRule . /index.html [L]
   ```

5. Verify the extracted layout:

   ```bash
   cd /home/zufpszw2/public_html/cosupplymm.com
   ls -l index.html .htaccess assets | head
   ```

6. Test `https://cosupplymm.com`, a hard refresh on `/admin/orders`, and a
   login. API calls must go to `https://api.cosupplymm.com/api/v1`. If the API
   host changes, update `react-app/.env.production`, rebuild, and re-zip.

---

## 11. HTTPS and CORS

- Force HTTPS for both domains in cPanel (AutoSSL / Force HTTPS Redirect).
- `APP_URL=https://api.cosupplymm.com`
- `FRONTEND_URL=https://cosupplymm.com`
- CORS allows exactly the `FRONTEND_URL` origin (`config/cors.php` reads that
  env value). Do not use `*`.
- `supports_credentials` is `false` because the SPA sends a Bearer token and
  `credentials: 'omit'`. Turn it on only if cookie auth is added later.

Preflight check:

```bash
curl -i -X OPTIONS https://api.cosupplymm.com/api/v1/products \
  -H "Origin: https://cosupplymm.com" \
  -H "Access-Control-Request-Method: GET"
```

Expected:

```text
Access-Control-Allow-Origin: https://cosupplymm.com
```

`Access-Control-Allow-Credentials` should be absent while credentials are
disabled.

Login check (no cookie should be set):

```bash
curl -i -X POST https://api.cosupplymm.com/api/v1/admin/login \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -H "Origin: https://cosupplymm.com" \
  -d '{"email":"admin@cosupplymm.com","password":"<password>"}'
```

Expected: `HTTP/2 200`, a JSON `token`, and **no** `set-cookie` header.

---

## 12. Post-deploy smoke test

1. `GET https://api.cosupplymm.com/up` → `200`.
2. `GET https://api.cosupplymm.com/api/v1/health` → `success: true`.
3. `https://cosupplymm.com` loads the catalog; images resolve from
   `https://api.cosupplymm.com/storage/...`.
4. Admin login succeeds and the dashboard loads.
5. Register a test customer, submit a quotation request, send a quotation,
   accept it, complete delivery and full COD collection, download the receipt.
6. A second customer gets `404` for the first customer's quotation, order,
   receipt, and notifications.
7. A missing route with `APP_DEBUG=false` returns the JSON error envelope, with
   no stack trace or SQL.
8. Logout revokes the token and protected pages redirect to login.

---

## 13. Updating a release

### Backend — Git pull + deploy script

1. Back up the database and `storage/app`:

   ```bash
   cd /home/zufpszw2/cosupply/laravel-api
   mysqldump --single-transaction --quick --routines \
     -h "$DB_HOST" -u "$DB_USERNAME" -p "$DB_DATABASE" \
     | gzip > "backups/cos-$(date +%F_%H%M).sql.gz"
   tar -czf "backups/storage-$(date +%F_%H%M).tar.gz" storage/app
   ```

2. Pull the release:

   ```bash
   cd /home/zufpszw2/cosupply/cossupply-repo
   git status                 # expect a clean working tree
   git pull origin main
   ```

3. Run the deploy wrapper:

   ```bash
   bash /home/zufpszw2/cosupply/deploy-laravel.sh
   ```

   The script should sync the release into
   `/home/zufpszw2/cosupply/laravel-api`, run
   `composer install --no-dev --optimize-autoloader`, run
   `php artisan migrate --force`, preserve `.env` and `storage/app`, and rebuild
   config/route/view caches. Confirm those steps before relying on it.

4. If `laravel-api/public/index.php` changed upstream, re-apply the custom
   relative paths from section 4 in
   `public_html/api.cosupplymm.com/index.php`. Never overwrite that file with
   the stock Laravel entry point.

5. Verify:

   ```bash
   curl -I https://api.cosupplymm.com/up
   ```

   Then log in as admin and check the dashboard.

Manual fallback if the script is unavailable:

```bash
cd /home/zufpszw2/cosupply/laravel-api
php artisan migrate --force        # only when migrations changed
php artisan optimize:clear
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

### Frontend — local build + ZIP

1. Build locally:

   ```bash
   cd react-app
   npm ci
   npm run build
   ```

2. ZIP the contents of `dist/` (section 2).

3. Back up the current frontend (section 10).

4. Upload and extract the zip into
   `/home/zufpszw2/public_html/cosupplymm.com/`.

5. Hard-refresh the browser and test a deep link such as `/admin/orders`.

### Common single-file updates

| Change | Upload |
| --- | --- |
| API middleware / routes / PHP code | commit → `git pull` in `cossupply-repo` → `deploy-laravel.sh` |
| API public files | `laravel-api/public/*` → `public_html/api.cosupplymm.com/` (keep the custom `index.php`, `php.ini`, `.user.ini`, `storage` link) |
| SPA code | new `react-app/dist/index.html` + `assets/` via ZIP |
| Favicon / app icons | `favicon.ico`, `favicon-*.png`, `apple-touch-icon.png` via ZIP |
| `.env` | edit on the server, then rebuild config cache |

---

## 14. Troubleshooting

### `MissingAppKeyException` — "No application encryption key has been specified"

Cause: `.env` missing, `APP_KEY=` empty, or a cached config built before the
key existed.

```bash
cd /home/zufpszw2/cosupply/laravel-api
grep '^APP_KEY=' .env
php artisan optimize:clear
php artisan config:cache
```

If `.env` does not exist, copy `.env.example` first, then generate the key
(section 6).

### `419` on `POST /api/v1/admin/login`

Cause: Sanctum is treating the request as a stateful SPA request and enforcing
CSRF, but the SPA only sends a Bearer token.

Check all three:

1. `.env` has `SANCTUM_STATEFUL_DOMAINS=` (empty).
2. `laravel-api/bootstrap/app.php` does **not** call
   `$middleware->statefulApi()`.
3. Config cache was rebuilt after the change:

   ```bash
   php artisan optimize:clear && php artisan config:cache
   ```

Then clear cookies for `.cosupplymm.com` and log in again. The response must
not set `cosupply-session` or `XSRF-TOKEN`.

### Browser shows "CORS error" but the real status is 419/500

Laravel can render some exceptions before the CORS middleware adds headers, so
the browser hides the real status. Fix the underlying 419/500 first. Also
confirm:

- `FRONTEND_URL=https://cosupplymm.com` (exact origin, no trailing slash).
- `config/cors.php` does not use `*`.
- The preflight `OPTIONS` request returns `200/204` with the origin echoed.

### `500` on every request

```bash
tail -n 100 storage/logs/laravel.log
```

Usual causes: wrong `DB_*` credentials, missing `APP_KEY`, unwritable
`storage/` or `bootstrap/cache/`, missing PHP extensions.

### `404` on `/api/v1/...`

- The subdomain points at the wrong folder. It must serve
  `/home/zufpszw2/public_html/api.cosupplymm.com`.
- `.htaccess` from `laravel-api/public` is missing, or `mod_rewrite` is
  disabled.
- `index.php` is the stock Laravel file, so its `__DIR__` paths do not resolve.
  Use the custom entry point from section 4 and verify the two `ls -l` paths.
- The request is hitting the SPA instead of the API — check the subdomain in
  cPanel → **Domains**.

### `500` after uploading `public/`

The upload probably replaced the custom `index.php` or removed `php.ini`,
`.user.ini`, or the `storage` symlink. Restore the entry point from section 4
and recreate the symlink from section 7.

### Images return `404`

The **served** doc root has no `storage` link. `php artisan storage:link` only
creates `laravel-api/public/storage`, which this host does not serve:

```bash
cd /home/zufpszw2/public_html/api.cosupplymm.com
ln -s /home/zufpszw2/cosupply/laravel-api/storage/app/public storage
```

If symlinks are blocked, ask the host to enable them or serve public files via
a route.

### `503 Service Unavailable`

The app is in maintenance mode:

```bash
php artisan up
```

### `SQLSTATE[42S02] ... sessions`

`SESSION_DRIVER=database` needs the `sessions` table. Run
`php artisan migrate --force`, or set `SESSION_DRIVER=file` for a token-only
API.

---

## 15. Backups

```bash
cd /home/zufpszw2/cosupply/laravel-api
mysqldump --single-transaction --quick --routines \
  -h "$DB_HOST" -u "$DB_USERNAME" -p "$DB_DATABASE" \
  | gzip > "backups/cos-$(date +%F_%H%M).sql.gz"

tar -czf "backups/storage-$(date +%F_%H%M).tar.gz" storage/app
```

- Include `storage/app/public` (catalog images) and `storage/app/private`
  (receipts, quotation PDFs, attachments).
- Keep at least 7 daily and 4 weekly copies, with one copy off the account.
- Store `.env` in a password manager — it is required to restore.
- Test a restore into staging at least once.

---

## 16. Deployment checklist

- [ ] Database and dedicated MySQL user created
- [ ] Repo cloned to `~/cosupply/cossupply-repo` on branch `main`
- [ ] `~/cosupply/deploy-laravel.sh` reviewed (sync + composer + migrate + cache)
- [ ] Laravel project installed outside `public_html`
- [ ] `public_html/api.cosupplymm.com` has the custom `index.php`, `.htaccess`, `php.ini`, `.user.ini`
- [ ] Served `storage` symlink points at `laravel-api/storage/app/public`
- [ ] `.env` created: `APP_ENV=production`, `APP_DEBUG=false`, `APP_KEY` set
- [ ] `APP_URL=https://api.cosupplymm.com`, `FRONTEND_URL=https://cosupplymm.com`
- [ ] `SANCTUM_STATEFUL_DOMAINS=` empty
- [ ] `SANCTUM_EXPIRATION_MINUTES=10080` (7-day token lifetime) or an intentional value
- [ ] `composer install --no-dev --optimize-autoloader`
- [ ] `php artisan key:generate --force`
- [ ] `php artisan migrate --force`
- [ ] `php artisan storage:link` **and** the doc-root symlink from section 7
- [ ] `storage` and `bootstrap/cache` writable (775/664, never 777)
- [ ] `.env` is `600` and not web-accessible
- [ ] Default admin password replaced with a strong one
- [ ] `php artisan optimize:clear && php artisan config:cache`
- [ ] SPA built locally with `VITE_API_URL=https://api.cosupplymm.com/api/v1`
- [ ] SPA zip contains the contents of `dist/` (no nested folder, no source, no `node_modules`)
- [ ] Current frontend backed up before extraction
- [ ] SPA extracted into `~/public_html/cosupplymm.com`, including `.htaccess` and icons
- [ ] Deep link `/admin/orders` survives a hard refresh
- [ ] HTTPS forced on both domains
- [ ] CORS preflight returns only `https://cosupplymm.com` (no credentials header)
- [ ] Login returns `200` with a token and no `set-cookie`
- [ ] Smoke tests (section 12) pass
- [ ] Backups configured and restore tested
- [ ] No queue worker or scheduler registered
