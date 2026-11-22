# CoSupply

B2B quotation and order platform for `cosupplymm.com` (React SPA) and
`api.cosupplymm.com` (Laravel REST API).

- `laravel-api/` — Laravel 12 API, Sanctum tokens, MySQL, `/api/v1`.
- `react-app/` — React 19 + Vite + Tailwind SPA.
- `specification/` — business, data, status, money and permission rules.
- `tasks/` — implementation task list (01–13).
- `docs/deployment.md` — production checklist, secrets, HTTPS/CORS, storage,
  backups and rollback.
- `docs/cpanel-deployment.md` — step-by-step cPanel deployment for the real
  host, paths, domains, and production troubleshooting.

## Local development

```bash
# API
cd laravel-api
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed
php artisan storage:link
php artisan serve

# SPA (separate terminal)
cd react-app
npm ci
cp .env.example .env
npm run dev
```

See `laravel-api/README.md` for demo credentials and the seeded dataset.

## Verification

```bash
cd laravel-api && php artisan test && vendor/bin/pint --test
cd react-app && npm test && npx tsc --noEmit && npm run build
```

## Deployment

Backend and frontend deploy independently:

- **API** — push `main`, then on the server: `git pull` in
  `~/cosupply/cossupply-repo` and run `bash ~/cosupply/deploy-laravel.sh`.
- **SPA** — build locally (`npm run build`), ZIP the **contents** of
  `react-app/dist/`, back up the current frontend, then extract into
  `~/public_html/cosupplymm.com`.

cPanel has no Node/npm, so the SPA is never built on the server. Never upload
`react-app/src` or `node_modules` to the public folder. Full steps:
[`docs/cpanel-deployment.md`](docs/cpanel-deployment.md).

## MVP boundaries

No direct ordering, partial delivery, partial payment, scheduler, queue worker,
WebSocket, or object storage. COD must be collected in full before payment is
confirmed. See `specification/` for the authoritative rules.
