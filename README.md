# CivicBridge Phase 2

CivicBridge is a community-first civic challenge platform. Residents can explore local challenges, submit ideas, and track progress; administrators and partners get a lightweight dashboard.

## Structure

- `frontend/` React + Vite + JavaScript + Tailwind-style utility CSS
- `backend/` Node.js + Express + Prisma + PostgreSQL REST API

## Run locally

1. Copy `backend/.env.example` to `backend/.env`, set `DATABASE_URL`, and replace `JWT_SECRET` with a long random value (the API can run without a database using clearly-labelled demo fallback data).
2. Install and start the API:
   ```sh
   cd backend && npm install && npm run dev
   ```
3. In another terminal install and start the frontend:
   ```sh
   cd frontend && npm install && npm run dev
   ```
4. Visit the URL printed by Vite (normally http://localhost:5173).

For a real database, run `npm run prisma:generate` and `npm run prisma:migrate` in `backend`.

Challenge categories are: Education, Healthcare, Environment, Public Infrastructure,
Women's Safety, Employment, Accessibility, and Other. Registration requires a password
of at least eight characters; passwords are stored as bcrypt hashes, never plaintext.
The challenge form captures expected impact, supporting information, and proposed solutions.
Challenge statuses are `open`, `in-progress`, and `resolved`; explore supports category,
location, status, search, and sort filters. Phase 2 adds JWT authentication, bcrypt password
hashing, role-safe registration, profiles, personalized dashboards, solution proposals,
collaboration interest, discussions, organizations, and authorization middleware. Public
registration supports Citizen, Student, Researcher, Industry Partner, and Government
Representative; Administrator is never accepted from public registration.

## API

Public endpoints include `GET /api/health`, `GET /api/challenges`, `GET /api/challenges/:id`, and `GET /api/dashboard/stats`. Authentication endpoints are `POST /api/auth/register`, `POST /api/auth/login`, and `POST /api/auth/logout`; registration supports Citizen, Student, Researcher, Industry Partner, and Government Representative. Administrator accounts are never accepted through public registration and must be seeded/provisioned through a protected admin process. Send the returned JWT as `Authorization: Bearer <token>` to use `GET /api/profile`, `GET /api/dashboard`, authenticated challenge creation, solution submission, collaboration, and comments. Demo fallback responses include `demo: true`.

Authenticated requests send `Authorization: Bearer <JWT>`. Protected endpoints include
`GET/PATCH /api/profile`, `GET /api/dashboard`, authenticated `POST /api/challenges`,
`POST /api/solutions`, `GET /api/solutions/:id`, `POST/DELETE /api/challenges/:id/collaborate`,
and `POST /api/comments`. Public `GET /api/organizations` lists configured records. Demo
fallback responses include `demo: true`; they are not persistent database records.

## Database migrations

After configuring PostgreSQL, generate the client and apply a forward-only migration:

```sh
cd backend
npm run prisma:generate
npm run prisma:migrate
```

Do not reset an existing database. Migration execution was not performed in this environment
because no PostgreSQL connection was configured.

## Checks

Run `npm run build` in `frontend` and `npm run check` in `backend`.
