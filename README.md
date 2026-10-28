# CivicBridge Phase 4

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
