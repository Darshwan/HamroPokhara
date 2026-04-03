# PRATIBIMBA Deployment Runbook

## 1. Production Prerequisites

- Docker + Docker Compose installed on target server
- DNS configured to point your domain to the server
- Firewall opened for `80` (and `443` if TLS is terminated on server)
- `.env` file present in the `Backend` directory

## 2. Required Environment Variables

Create or update `Backend/.env` with at least:

```env
# Database
POSTGRES_USER=postgres
POSTGRES_PASSWORD=change-this-strong-password
POSTGRES_DB=pratibimba

# Backend
DATABASE_URL=postgresql://postgres:change-this-strong-password@db:5432/pratibimba?sslmode=disable
PORT=8080
JWT_SECRET=replace-with-a-long-random-secret
OPENAI_API_KEY=replace-with-your-openai-key
OPENAI_TRANSCRIBE_MODEL=whisper-1
ENV=production
APP_NAME=PRATIBIMBA
APP_VERSION=1.0.0

# CORS (comma-separated allowlist)
CORS_ALLOW_ORIGINS=https://ward.example.com,https://citizen.example.com
```

Notes:
- `JWT_SECRET` must be long and random.
- Do not use `*` for `CORS_ALLOW_ORIGINS` in production.

## 3. Backend Production Deployment

From `Backend/`:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Check status:

```bash
docker compose -f docker-compose.prod.yml ps
```

Check logs:

```bash
docker compose -f docker-compose.prod.yml logs -f backend
```

Health check:

```bash
curl http://<server-ip-or-domain>/health
```

## 4. Reverse Proxy Details

- Reverse proxy config is in `Backend/deploy/nginx.prod.conf`.
- It forwards all incoming traffic on port `80` to backend `:8080`.
- To serve TLS on the same host, place Nginx TLS cert config in this file (or terminate TLS in cloud load balancer).

## 5. Ward Portal Deployment (Next.js)

The ward portal is located at:

- `webportal/ward-officer-portal`

### Option A: Vercel (recommended)

1. Import `webportal/ward-officer-portal` as project.
2. Set environment variables:

```env
NEXT_PUBLIC_API_BASE_URL=https://api.example.com
NEXT_PUBLIC_HLS_STREAM_URL=https://stream.example.com/hls/stream.m3u8
```

3. Deploy.

### Option B: Self-hosted Node

```bash
cd webportal/ward-officer-portal
npm ci
npm run build
npm run start
```

Then reverse-proxy it from your web server as needed.

## 6. Post-Deploy Smoke Tests

Run these checks after deployment:

1. `GET /health` returns operational status.
2. Officer login works via `POST /officer/login`.
3. `GET /officer/queue` returns data with valid JWT.
4. `GET /officer/news` returns data with valid JWT.
5. Verification works without PDF:
   - public `GET /verify/:dtid`
   - officer `GET /officer/verify/:dtid` (JWT)
6. PDF routes still work for preview/download where needed.

## 7. Upgrade / Rollback

### Upgrade

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d --build
```

### Rollback

If you use tagged images, redeploy previous tag with same compose file.
For local build rollback, keep previous image ID and restart services with it.

## 8. Operational Notes

- PDF artifacts are persisted in volume `generated_pdfs_prod`.
- PostgreSQL data is persisted in volume `pgdata_prod`.
- Monitor backend logs for repeated `401` responses (usually stale frontend token/session).
