# CivicBridge Phase 5

CivicBridge is a community-first civic challenge platform for reporting societal challenges and coordinating transparent, evidence-based collaboration.

## Structure

- `frontend/`: React, Vite, JavaScript, and Tailwind-compatible styling
- `backend/`: Node.js, Express, Prisma, PostgreSQL REST API

## Run locally

1. Copy `backend/.env.example` to `backend/.env`.
2. Set `DATABASE_URL` and replace `JWT_SECRET` with a long random value.
3. Start the API:

   ```sh
   cd backend
   npm install
   npm run dev
   ```

4. In another terminal, start the frontend:

   ```sh
   cd frontend
   npm install
   npm run dev
   ```

The API uses clearly labelled in-memory demo fallback data when PostgreSQL is unavailable. Demo data is not persistent.

## Phase 3 capabilities

- Transparent keyword-based category suggestions with manual override
- Similar-challenge detection using normalized token overlap
- Explainable recommendations based on categories and locations from user activity
- Challenge progress updates and chronological timelines
- Evidence-aware expected impact versus reported progress updates
- Recipient-scoped in-app notifications with unread counts and read actions
- Administrator-only analytics for status/category totals, solutions, and collaborations
- Search across title, description, and location
- Category, status, and location filters
- Newest, oldest, relevant, and popular sorting
- Bounded pagination

Supported challenge categories are Education, Healthcare, Environment, Public Infrastructure, Women's Safety, Employment, Accessibility, and Other.

## API

Public endpoints:

- `GET /api/health`
- `GET /api/challenges`
- `GET /api/challenges/:id`
- `GET /api/challenges/suggest-category`
- `GET /api/challenges/duplicates`
- `GET /api/dashboard/stats`
- `GET /api/organizations`

Authentication endpoints:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`

Send the returned JWT in `Authorization: Bearer <JWT>` for protected endpoints.

Phase 2 protected endpoints include profile, personalized dashboard, authenticated challenge and solution creation, collaboration, and discussion routes.

Phase 3 endpoints include:

- `POST /api/challenges/preview`
- `GET /api/recommendations`
- `GET /api/challenges/:id/timeline`
- `POST /api/challenges/:id/progress`
- `PATCH /api/challenges/:id/status`
- `GET /api/notifications`
- `PATCH /api/notifications/:id/read`
- `GET /api/admin/analytics` (administrator only)

Phase 4 collaboration endpoints include organization profiles (including type and
expertise) and membership requests, projects linked optionally to challenges or
solutions, and team requests (`/api/projects`, `/api/projects/:projectId/team-requests`),
milestones and tasks, five-criteria solution evaluations, URL-validated deliverables,
paginated project activity (`/api/projects/:id/activity`), and project dashboard
aggregates (`/api/projects/:id/dashboard`). Mutating endpoints require a bearer
token; organization/project management checks role and membership, duplicate requests
and evaluations return `409`, invalid IDs return `400/404`, and invalid state
transitions are rejected. The frontend includes organization, project workspace,
team, task, milestone, deliverable, evaluation, activity, and dashboard views.

## Database migrations

The Phase 4 schema adds explicit organization membership and request records,
projects, team membership/requests, milestones, tasks, evaluations, deliverables,
and activity records with composite uniqueness constraints and query indexes while
preserving all Phase 1-3 models and APIs. Generate and migrate without resetting:

After configuring PostgreSQL:

```sh
cd backend
DATABASE_URL=... npx prisma validate
npm run prisma:generate
npm run prisma:migrate
```

Do not reset an existing database. A live migration was not run in this environment because no PostgreSQL connection was configured.

## Validation

```sh
npm --prefix frontend run build
npm --prefix backend run check
npm --prefix backend run prisma:generate
```

Production deployments must configure `JWT_SECRET`, `DATABASE_URL`, `CLIENT_URL`, and `PORT` through environment variables. No external AI, email, SMS, or paid service is required.

## Phase 1-4 audit

The Phase 5 baseline audit was run against the current source, build, API, and Prisma
schema. Core discovery, authentication, challenge submission, solutions, comments,
collaboration, recommendations, notifications, organizations, projects, milestones,
tasks, evaluations, deliverables, and activity feeds are implemented and build-valid
(PASS). PostgreSQL-backed persistence and migrations are BLOCKED in this environment
because no live `DATABASE_URL` is configured; the documented demo fallback is
intentionally in-memory. Browser-level end-to-end coverage and real multi-user
organization approval flows are PARTIAL because no browser runner or database was
available. No earlier-phase feature was removed.

## Phase 5 capabilities

- Admin-only advanced insights calculated from recorded challenges, solutions, and collaborations:
  category and geographic distributions, status distribution, monthly trends, active
  contributors, and low-engagement challenges.
- Unified public search across challenge titles, descriptions, categories, locations,
  and solution proposals with category/status filters and bounded pagination.
- Challenge impact reports showing current status, expected impact, solution count,
  contributor participation, progress history, and recorded outcomes. Recorded
  outcomes are explicitly self-reported and are not presented as verified impact.
- Authenticated content reporting and administrator-only moderation review/status
  updates, with duplicate-report protection and audit fields.
- Analytics UI with responsive metric cards, accessible progress visualizations,
  loading/error/empty states, and a unified search page.
- Accessibility improvements including a skip link, visible keyboard focus states,
  semantic labels, screen-reader status/error announcements, and responsive layouts.

Phase 5 endpoints:

- `GET /api/admin/insights` (administrator only)
- `GET /api/search?q=...&category=...&status=...&page=...&limit=...`
- `GET /api/challenges/:id/impact-report`
- `POST /api/reports` (authenticated users; exactly one challenge or solution)
- `GET /api/admin/reports` (administrator only)
- `PATCH /api/admin/reports/:id` (administrator only; `reviewed`, `dismissed`, or `actioned`)

Analytics are calculated from database records using counts, distinct recorded
contributors, category/location/status groupings, and `YYYY-MM` creation-date buckets.
The demo fallback uses only the existing labelled demo records. No synthetic scores,
benefits, outcomes, or AI recommendations are generated.

## Phase 5 validation evidence

| Test ID | Feature | Scenario | Expected/actual result | Status |
|---|---|---|---|---|
| P5-001 | Build | Build frontend and check backend syntax | Both completed successfully | PASS |
| P5-002 | Schema | Validate and generate Prisma client | Valid schema and generated client | PASS |
| P5-003 | Unified search | Search `park` | Returned the recorded Central Park challenge in demo mode | PASS |
| P5-004 | Impact report | Request `demo-1` report | Returned recorded challenge, expected impact, and timeline fields | PASS |
| P5-005 | Authorization | Anonymous/admin-insights request | Anonymous received 401; non-admin received 403 | PASS |
| P5-006 | Moderation | Authenticated challenge report | Created pending report in demo mode | PASS |
| P5-007 | PostgreSQL migration | Run against live database | No configured database was available | BLOCKED |

Run the checks locally with:

```sh
npm --prefix frontend run build
npm --prefix backend run check
DATABASE_URL=... npm --prefix backend run prisma:validate
```
