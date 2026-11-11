# Deployment

The app is a standard Next.js 16 project. It needs Node 20+ (or any platform
that runs Next.js) and – for RSVPs – either a writable disk or a Postgres
database.

## 1. Environment

Copy `.env.example` and set at least:

```
ADMIN_TOKEN=<openssl rand -base64 32>
NEXT_PUBLIC_SITE_URL=https://your-public-host
RSVP_STORE=file            # or postgres
```

## 2a. Node server (VPS, Render, Railway, Fly.io…)

```bash
npm ci
npm run build
npm start          # listens on $PORT (default 3000)
```

With `RSVP_STORE=file`, make sure `RSVP_FILE_PATH` (default `./data/rsvps.json`)
points to persistent storage and back it up.

## 2b. Docker

```bash
docker build -t eguest-invitation .
docker run -d -p 3000:3000 \
  -e ADMIN_TOKEN=... -e NEXT_PUBLIC_SITE_URL=https://... \
  -v eguest-data:/data eguest-invitation
```

The image uses Next's standalone output, runs as a non-root user and stores
the JSON RSVP file in the `/data` volume.

## 2b-ii. Railway (recommended quick path)

The repo ships a `railway.json` that tells Railway to build the Dockerfile
and health-check `/api/health`.

1. Sign in at railway.com → **New Project → Deploy from GitHub repo** → pick
   `watsonchins-blip/watty` (branch `main` after merging the PR, or the PR
   branch to preview).
2. In the service → **Variables**, add:
   - `ADMIN_TOKEN` = a long random string (`openssl rand -base64 32`)
   - `RSVP_STORE` = `file`
   - `RSVP_FILE_PATH` = `/data/rsvps.json`
3. Service → **Settings → Volumes → Add volume**, mount path `/data`
   (this keeps RSVPs across redeploys).
4. Service → **Settings → Networking → Generate domain**. Copy the
   `*.up.railway.app` URL and add a variable `NEXT_PUBLIC_SITE_URL` with that
   value (include `https://`), then redeploy once so share links use it.
5. Open the URL on your phone; `/admin` shows responses with your token.

To attach the eGuest subdomain later: Settings → Networking → Custom domain,
and point a CNAME at the target Railway shows.

Alternative with the CLI: `npm i -g @railway/cli && railway login && railway init && railway up`.

## 2c. Vercel / Netlify (serverless)

Serverless filesystems are ephemeral, so use Postgres:

```
RSVP_STORE=postgres
DATABASE_URL=postgres://user:pass@host/db
DATABASE_SSL=true          # if your provider requires it
```

The `rsvps` table is created automatically on first use
(`src/lib/rsvp/postgres-store.ts`). Neon, Supabase, Railway Postgres and RDS
all work. Note the in-memory rate limiter is per instance on serverless; swap
it for Redis/Upstash in `src/lib/rsvp/rate-limit.ts` if abuse becomes a concern.

## 3. HTTPS and the subdomain

Nothing in the app assumes a host. Put it behind HTTPS (platform TLS or a
reverse proxy) and set `NEXT_PUBLIC_SITE_URL` to the final origin so share
links and calendar files carry the right URL. The app honours
`x-forwarded-host` / `x-forwarded-proto` behind proxies.

## 4. Checks after deploying

- `GET /api/health` returns `{ ok: true }`
- Open `/` on a phone: envelope → opening → invitation, music controls visible
- Submit a test RSVP, then open `/admin` with the token and export CSV
- `GET /api/calendar/our-love-story` downloads an `.ics`
- Verify the "Get directions" button and the click-to-load map
