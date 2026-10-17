# Task 01 — Project Foundation

## Goal

Create the Laravel API and React SPA foundations for local development only.

## Dependencies

None.

## Scope

- Initialize Laravel API project structure.
- Initialize React application with Tailwind CSS and React Router.
- Configure API prefix `/api/v1`.
- Configure local environment variables for API base URL.
- Use localhost development URLs only, for example:

```text
React SPA: http://localhost:5173
Laravel API: http://localhost:8000/api/v1
```

- Configure CORS only for the local React development origin.
- Create shared API response/error conventions.
- Establish frontend public/customer/admin route groups.
- Add a `/api/v1/health` endpoint for local connection checks.

## Out of Scope

- Domain-name configuration
- `cos.shop`, `api.cos.shop`, or any other production URL
- cPanel configuration
- Vercel configuration
- Production deployment configuration
- SSL, DNS, server document-root, cron, queue-worker, or hosting setup

## Acceptance Criteria

- React app running on localhost can call Laravel `/api/v1/health` on localhost.
- CORS permits the configured local frontend origin.
- Frontend uses environment configuration rather than hard-coded API URLs.
- API returns consistent JSON for success, validation failures, unauthorized, and forbidden responses.
- No business modules or production-server configuration are implemented in this task.

## References

- `specification/TechnicalArchitecture.md`
- `specification/ImplementationNotes.md`
