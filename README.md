# CivicBridge Phase 1

CivicBridge is a community-first civic challenge platform. Residents can explore local challenges, submit ideas, and track progress; administrators and partners get a lightweight dashboard.

## Structure

- `frontend/` React + Vite + JavaScript + Tailwind-style utility CSS
- `backend/` Node.js + Express + Prisma + PostgreSQL REST API

## Run locally

1. Copy `backend/.env.example` to `backend/.env` and set `DATABASE_URL` (the API can run without a database using clearly-labelled demo fallback data).
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
location, status, search, and sort filters. Prisma includes `Solution` and `Organization`
models with challenge relations.

## API

`GET /api/health`, `GET /api/challenges`, `GET /api/challenges/:id`, `POST /api/challenges`, `POST /api/auth/register`, `POST /api/auth/login`, and `GET /api/dashboard/stats`. Dashboard stats include open, in-progress, resolved, and participating-organization counts.

## Checks

Run `npm run build` in `frontend` and `npm run check` in `backend`.
