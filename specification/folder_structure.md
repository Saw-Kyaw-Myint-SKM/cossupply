# Project Folder Structure

## Architecture

This project uses two independent applications in one repository:

- `laravel-api`: Laravel 12 API backend
- `react-app`: React TypeScript frontend

```text
project/
├── laravel-api/
└── react-app/
```

## Complete Structure

```text
project/
│
├── laravel-api/
│   ├── app/
│   │   ├── Actions/
│   │   │   ├── Auth/
│   │   │   ├── Users/
│   │   │   │   ├── CreateUserAction.php
│   │   │   │   ├── UpdateUserAction.php
│   │   │   │   └── DeleteUserAction.php
│   │   │   └── Orders/
│   │   │
│   │   ├── Contracts/
│   │   │   └── Repositories/
│   │   │       ├── UserRepositoryInterface.php
│   │   │       └── OrderRepositoryInterface.php
│   │   │
│   │   ├── Data/
│   │   │   ├── Auth/
│   │   │   ├── Users/
│   │   │   └── Orders/
│   │   │
│   │   ├── Enums/
│   │   ├── Exceptions/
│   │   │
│   │   ├── Http/
│   │   │   ├── Controllers/
│   │   │   │   └── Api/
│   │   │   │       └── V1/
│   │   │   │           ├── AuthController.php
│   │   │   │           ├── UserController.php
│   │   │   │           └── OrderController.php
│   │   │   ├── Middleware/
│   │   │   ├── Requests/
│   │   │   │   ├── Auth/
│   │   │   │   ├── Users/
│   │   │   │   └── Orders/
│   │   │   └── Resources/
│   │   │       ├── UserResource.php
│   │   │       └── OrderResource.php
│   │   │
│   │   ├── Models/
│   │   │   ├── User.php
│   │   │   └── Order.php
│   │   │
│   │   ├── Policies/
│   │   │   ├── UserPolicy.php
│   │   │   └── OrderPolicy.php
│   │   │
│   │   ├── Repositories/
│   │   │   └── Eloquent/
│   │   │       ├── EloquentUserRepository.php
│   │   │       └── EloquentOrderRepository.php
│   │   │
│   │   ├── Services/
│   │   │   ├── Auth/
│   │   │   └── Payment/
│   │   │
│   │   └── Providers/
│   │       └── RepositoryServiceProvider.php
│   │
│   ├── bootstrap/
│   ├── config/
│   ├── database/
│   │   ├── factories/
│   │   ├── migrations/
│   │   └── seeders/
│   ├── routes/
│   │   ├── api.php
│   │   └── console.php
│   ├── storage/
│   ├── tests/
│   │   ├── Feature/
│   │   ├── Unit/
│   │   └── Integration/
│   ├── .env.example
│   ├── artisan
│   ├── composer.json
│   └── phpunit.xml
│
├── react-app/
│   ├── public/
│   ├── src/
│   │   ├── app/
│   │   │   ├── App.tsx
│   │   │   ├── providers.tsx
│   │   │   └── queryClient.ts
│   │   │
│   │   ├── api/
│   │   │   ├── client.ts
│   │   │   ├── errorHandler.ts
│   │   │   └── types.ts
│   │   │
│   │   ├── routes/
│   │   │   ├── index.tsx
│   │   │   ├── routeConfig.tsx
│   │   │   └── ProtectedRoute.tsx
│   │   │
│   │   ├── features/
│   │   │   ├── auth/
│   │   │   │   ├── api/
│   │   │   │   │   ├── authQueries.ts
│   │   │   │   │   └── authMutations.ts
│   │   │   │   ├── components/
│   │   │   │   ├── hooks/
│   │   │   │   ├── pages/
│   │   │   │   ├── schemas/
│   │   │   │   └── types.ts
│   │   │   │
│   │   │   ├── users/
│   │   │   │   ├── api/
│   │   │   │   │   ├── userQueries.ts
│   │   │   │   │   └── userMutations.ts
│   │   │   │   ├── components/
│   │   │   │   ├── hooks/
│   │   │   │   ├── pages/
│   │   │   │   ├── schemas/
│   │   │   │   └── types.ts
│   │   │   │
│   │   │   ├── orders/
│   │   │   │   ├── api/
│   │   │   │   ├── components/
│   │   │   │   ├── hooks/
│   │   │   │   ├── pages/
│   │   │   │   ├── schemas/
│   │   │   │   └── types.ts
│   │   │   │
│   │   │   └── dashboard/
│   │   │       ├── api/
│   │   │       ├── components/
│   │   │       ├── pages/
│   │   │       └── types.ts
│   │   │
│   │   ├── components/
│   │   │   ├── ui/
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Input.tsx
│   │   │   │   ├── Modal.tsx
│   │   │   │   └── Table.tsx
│   │   │   ├── layout/
│   │   │   │   ├── AppLayout.tsx
│   │   │   │   ├── Header.tsx
│   │   │   │   └── Sidebar.tsx
│   │   │   └── feedback/
│   │   │       ├── ErrorMessage.tsx
│   │   │       ├── LoadingState.tsx
│   │   │       └── EmptyState.tsx
│   │   │
│   │   ├── hooks/
│   │   ├── lib/
│   │   │   ├── date.ts
│   │   │   ├── permissions.ts
│   │   │   └── storage.ts
│   │   ├── stores/
│   │   │   └── uiStore.ts
│   │   ├── types/
│   │   ├── styles/
│   │   │   └── index.css
│   │   ├── main.tsx
│   │   └── vite-env.d.ts
│   │
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── README.md
├── .gitignore
└── docker-compose.yml
```

## Backend Request Flow

```text
React Page
    ↓
React Feature Hook
    ↓
API Client
    ↓
Laravel API Route
    ↓
Controller
    ↓
Form Request
    ↓
Action or Service
    ↓
Repository Interface
    ↓
Eloquent Repository
    ↓
Eloquent Model
    ↓
Database
```

## Architecture Rules

### Laravel

- Controllers should remain thin.
- Form Requests handle validation.
- Policies handle authorization.
- Actions handle business use cases.
- Services handle cross-feature operations.
- Repository interfaces belong in `app/Contracts/Repositories`.
- Eloquent implementations belong in `app/Repositories/Eloquent`.
- Repositories should handle persistence and queries, not business rules.
- API routes should be versioned, for example `/api/v1/users`.
- API responses should use Laravel Resources.
- Use Feature tests for complete API workflows.
- Use Unit tests for Actions and repository behavior.

### React

- Use TypeScript.
- Use Vite for the frontend build.
- Use React Router for frontend navigation.
- Use TanStack Query for server/API state.
- Use React Hook Form for forms.
- Use Zod for client-side form schemas.
- Use Zustand only for client-only global state.
- Keep API requests out of page components.
- Place feature-specific code inside `features/{feature}`.
- Place reusable UI components inside `components/ui`.
- Keep API infrastructure in `src/api`.
- Avoid one large global API file.
- Avoid one global state store containing all server data.

## Recommended API and Frontend URLs

```text
Frontend:
https://app.example.com

API:
https://api.example.com/api/v1
```

## Recommended Environment Variables

### Laravel API

```env
APP_URL=http://localhost:8000
FRONTEND_URL=http://localhost:5173
DB_CONNECTION=mysql
DB_HOST=mysql
DB_PORT=3306
DB_DATABASE=application
DB_USERNAME=root
DB_PASSWORD=
```

### React App

```env
VITE_API_URL=http://localhost:8000/api/v1
```

## Main Technology Decisions

| Area | Decision |
|---|---|
| Backend | Laravel 12 |
| Frontend | React with TypeScript |
| Frontend build tool | Vite |
| Backend architecture | API |
| Persistence abstraction | Repository Pattern |
| Repository implementation | Eloquent |
| API authentication | Laravel Sanctum |
| Frontend routing | React Router |
| Server state | TanStack Query |
| Form handling | React Hook Form |
| Form schemas | Zod |
| Client global state | Zustand when needed |
| API versioning | `/api/v1` |
| Frontend organization | Feature-based |
| Deployment | Separate frontend and API deployments |