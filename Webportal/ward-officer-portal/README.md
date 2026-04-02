# Pratibimba Ward Officer Portal

Modern, dynamic G2C ward portal built with Next.js (App Router) for digital governance workflows.

## What This Includes

- Officer login flow with local session persistence.
- Dashboard stats and recent documents view.
- Request queue with filtering, search, approve/reject actions.
- Document verification module (DTID based).
- Ledger integrity scan module.
- Typed API layer with graceful demo fallback when backend is unavailable.

## Tech Stack

- Next.js 16 + React + TypeScript
- Tailwind CSS 4 (utility layer)
- `src/lib/portal-api.ts` for backend integration
- `src/types/portal.ts` for domain types

## Run Locally

1. Install dependencies:

```bash
npm install
```

2. Configure environment:

Create a file named `.env.local` and copy values from `.env.example`.

3. Set backend URL in `.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
```

4. Start the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Backend Endpoints Expected

- `POST /officer/login`
- `GET /officer/queue`
- `POST /officer/approve`
- `POST /officer/reject`
- `GET /ministry/stats`
- `GET /verify/:dtid`
- `GET /ministry/integrity`

The UI will still run in demo mode if these endpoints are not yet reachable.
