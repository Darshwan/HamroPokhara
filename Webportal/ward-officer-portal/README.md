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
- `hls.js` for browser playback of live m3u8 streams

## Run Locally

1. Install dependencies:

```bash
npm install
```

1. Configure environment:

Create a file named `.env.local` and copy values from `.env.example`.

1. Set backend URL in `.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
NEXT_PUBLIC_HLS_STREAM_URL=http://192.168.100.55/hls/stream.m3u8
HLS_PROXY_TARGET=http://192.168.100.55
```

The app rewrites `/hls/*` to `HLS_PROXY_TARGET/hls/*` so playlist and segment requests stay same-origin in the browser.

1. Start the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Backend Endpoints Expected

- `POST /officer/login`
- `GET /officer/queue`
- `POST /officer/approve`
- `POST /officer/reject`
- `GET /officer/news`
- `POST /officer/news`
- `GET /citizen/notices/:wardCode`
- `GET /ministry/stats`
- `GET /verify/:dtid`
- `GET /ministry/integrity`

The UI will still run in demo mode if these endpoints are not yet reachable.
