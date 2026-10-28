# CivicBridge Phase 3

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

## Database migrations

The Phase 3 schema adds progress updates, notifications, recommendations, indexes, and relations while preserving existing models.

After configuring PostgreSQL:

```sh
cd backend
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
