# Runtime Validation Report

**Generated**: 2026-11-02T16:45:00+05:30
**Target**: `/home/ritika/civicBridge`

## Summary

| Step | Status | Exit Code | Details |
|---|---|---:|---|
| Backend startup | PASS | 0 | API started on port 4000 and `/api/health` returned `database: connected` |
| PostgreSQL migration | PASS | 0 | Prisma reported the database schema is up to date |
| API integration tests | PASS | 0 | 3 multi-step suites, 3 passed, 0 failed |
| Frontend build | PASS | 0 | Vite production build completed |
| Browser rendering smoke test | PASS | 0 | Installed Google Chrome rendered the React SPA DOM |
| Automatic runtime script | PASS | 0 | Started stopped services automatically and completed all checks |
| Playwright installation | BLOCKED | 1 | `npx playwright install --with-deps chromium` requires sudo for system dependencies |

## Test Coverage

- Authentication: registration, protected-route rejection, profile update, persistence read-back
- Challenge workflow: invalid input rejection, creation, search read-back, impact report
- Moderation: authentication requirement, report creation, duplicate-report rejection
- Database: real local PostgreSQL through Prisma; test responses returned `demo: false`
- Frontend: Vite build and headless Chrome DOM rendering

## Environment

```text
docker: UNAVAILABLE — docker command/daemon unavailable
node: AVAILABLE — v22.23.1
playwright: BLOCKED — browser dependency installation requires sudo
infra-tier: FALLBACK(local PostgreSQL) — Docker unavailable; PostgreSQL service was available locally
browser-tier: FALLBACK(headless Chrome smoke test) — Playwright system dependency installation blocked
```

## Known Gaps

1. Full Playwright interaction tests were not run because the required browser/system dependency installation needs sudo access. The no-sudo validator uses installed Google Chrome for rendered-page verification.
2. The validation suite covers the highest-risk core workflows, not every possible UI state or every advanced project-management route.
3. Test-created users, challenges, and reports remain in the local development database.

## Verdict

**Overall: PASS WITH DOCUMENTED GAPS**

The core application is database-backed and validated through real registration, authentication, persistence, search, reporting, and moderation flows. It is not a claim of exhaustive production certification.
