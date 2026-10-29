# CoSupply

B2B quotation and order platform for `cos.shop` (React SPA) and `api.cos.shop`
(Laravel REST API).

- `laravel-api/` — Laravel 12 API, Sanctum tokens, MySQL, `/api/v1`.
- `react-app/` — React 19 + Vite + Tailwind SPA.
- `specification/` — business, data, status, money and permission rules.
- `tasks/` — implementation task list (01–13).
- `docs/deployment.md` — cPanel production checklist, secrets, HTTPS/CORS,
  storage, backups and rollback.

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

## MVP boundaries

No direct ordering, partial delivery, partial payment, scheduler, queue worker,
WebSocket, or object storage. COD must be collected in full before payment is
confirmed. See `specification/` for the authoritative rules.
