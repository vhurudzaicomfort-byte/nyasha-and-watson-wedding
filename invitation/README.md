# eGuest · Luxury Interactive Wedding Invitation

A photograph-free, fully interactive digital wedding invitation: digital
envelope with wax seal, animated reveal, live countdown, add-to-calendar,
Google Maps directions, share sheet, optional background music and a real,
spam-protected RSVP system with a private export for the couple.

Built as a standalone Next.js app that will later live under an **eGuest**
subdomain (see [docs/EGUEST_INTEGRATION.md](docs/EGUEST_INTEGRATION.md)).

> **Content** lives in one file,
> [`src/invitations/our-love-story.ts`](src/invitations/our-love-story.ts):
> Nyasha Mazuruse & Watson Chin'ombe, Saturday 5 December 2026, 10:00 AM,
> Colne Valley Nature Reserve Park, 7 Bay Noakes Road, Chisipite, Harare.
> Change anything there and the cover, countdown, calendar, map and RSVP follow.

---

## Quick start

```bash
npm install
cp .env.example .env.local      # then set ADMIN_TOKEN (24+ random chars)
npm run dev                     # http://localhost:3000
```

| Script              | Purpose                                   |
| ------------------- | ----------------------------------------- |
| `npm run dev`       | Development server                        |
| `npm run build`     | Production build (type-checked)           |
| `npm start`         | Serve the production build                |
| `npm test`          | Unit tests (validation, RSVP service, time-zone and calendar logic) |
| `npm run typecheck` | TypeScript only                           |

Node 20+ is required.

## Routes

| Route                              | What it serves                                             |
| ---------------------------------- | ---------------------------------------------------------- |
| `/`                                | The default invitation (`DEFAULT_INVITATION_SLUG`)          |
| `/invitation/<slug>`               | Any registered invitation (multi-wedding ready)            |
| `/invitation/<slug>?code=ABCD`     | Personalised: greets the guest by name, applies their seat allowance |
| `/rsvp/<slug>[?code=ABCD]`         | Focused RSVP page – ideal target for a printed QR code     |
| `/admin`                           | Token-gated response viewer + CSV export for the couple    |
| `POST /api/rsvp`                   | RSVP submission (validated, rate-limited, de-duplicated)   |
| `GET /api/admin/rsvps?slug=&format=json\|csv` | Export, `Authorization: Bearer <ADMIN_TOKEN>`    |
| `GET /api/calendar/<slug>`         | `.ics` calendar file                                       |
| `GET /api/health`                  | Liveness probe                                             |

## Project structure

```
src/
  app/                    Next.js App Router pages & API routes
    page.tsx              "/" → default invitation
    invitation/[slug]/    multi-invitation route
    rsvp/[slug]/          standalone RSVP page
    admin/                token-gated responses viewer
    api/rsvp              POST RSVP
    api/admin/rsvps       GET export (Bearer token)
    api/calendar/[slug]   ICS download
  invitations/            ★ CONTENT – one file per wedding + registry
    types.ts              Invitation / Guest data model
    our-love-story.ts     all text, dates, venue, palette for this wedding
    our-love-story.guests.ts  personal invitation codes (server-only)
    index.ts              registry: slug → invitation
  components/
    envelope/             digital envelope + opening choreography
    invitation/           client orchestrator (envelope → sections → music)
    sections/             Hero, Countdown, Details, DressCode, Gifts,
                          Guidelines, Directions, Rsvp, Closing
    ornaments/            procedural SVG florals, sprigs, cartouche, crest, marble
    ui/                   Button, Reveal, popovers, music control, icons
  hooks/useMusic.ts       file-based or generative background music
  lib/
    datetime.ts           time-zone-correct countdown & formatting
    calendar.ts           ICS + Google Calendar links
    maps.ts, share.ts     Google Maps / WhatsApp / Web Share helpers
    rsvp/                 validation (zod), service, stores, rate limit, guards
  config/site.ts          public URL & route helpers (env-driven)
tests/                    vitest unit tests
docs/                     deployment & eGuest integration guides
```

## Configuration

All environment variables are documented in [`.env.example`](.env.example).
The important ones:

| Variable                 | Notes                                                                 |
| ------------------------ | --------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`   | Public origin (e.g. `https://eguest.example.com`). Optional – falls back to the request origin. |
| `DEFAULT_INVITATION_SLUG`| Invitation served at `/`                                              |
| `RSVP_STORE`             | `file` (default, JSON on disk) or `postgres`                          |
| `DATABASE_URL`           | Postgres connection string when `RSVP_STORE=postgres`                 |
| `ADMIN_TOKEN`            | ≥ 24 chars. Required for `/admin` and the export API                  |
| `RSVP_ALLOWED_ORIGINS`   | Extra origins allowed to POST RSVPs (for embedding in eGuest)         |
| `NEXT_PUBLIC_MUSIC_SRC`  | Optional licensed track; otherwise a generative ambient score plays   |

### Editing the wedding content

Everything a guest reads is in `src/invitations/our-love-story.ts`: names,
invitation line, title, tagline, date/time (with time zone), venue, dress code
and palette, gifts message, guest guidelines, RSVP settings and theme colours.

### Dress-code inspiration imagery

The original design used a brand's model photos. Those are not redistributed;
the section shows illustrated croquis gowns in the palette colours and tuxedo
figures instead. If you hold a licence for photos, add them under `public/`
and list them in `dressCode.inspirationImages` – they replace the illustrations.

### Personal guest codes (optional)

Add entries to `src/invitations/our-love-story.guests.ts`:

```ts
MOYO2: { displayName: "Mr & Mrs Moyo", allowance: 2 },
```

Share `https://<host>/invitation/our-love-story?code=MOYO2`. The guest is
greeted by name, the RSVP form is pre-filled, the seat limit is enforced
server-side and the response is de-duplicated by code instead of by name.
Codes are opaque, so no personal data appears in URLs.

## Features

**Experience**
- Digital envelope with monogram wax seal, flap/card opening choreography and dissolve into the invitation; replay button in the footer
- Cover, "The Details", dress code with watercolour palette swatches, gifts, guest guidelines, directions, RSVP and signature footer – all content from the original design
- Scroll-triggered reveals, staggered hero entrance, reduced-motion support
- Procedural SVG botanicals (garden roses, foliage, olive sprigs), gold cartouches, calligraphic flourishes, marble texture – no photographs, no bitmap assets
- Self-hosted typography (Cormorant Garamond, Pinyon Script, Jost)
- Mobile-first, tested at 360, 430, 820 and 1440 px with no horizontal overflow

**Interactive**
- Live, time-zone-correct countdown with "today" and "married" states
- Add to calendar: Google Calendar link and `.ics` download (Apple/Outlook)
- Get directions / open in Google Maps; privacy-friendly click-to-load map embed
- Share: native share sheet, copy link, WhatsApp
- Background music with visible play/pause and mute controls; opt-in toggle on the envelope; generative score when no track is configured

**RSVP**
- Accept / decline, full name, guest count (capped by allowance), phone/email, note
- Client + server validation with the same zod schema; clear field errors, loading, success and failure states
- Duplicate protection: server upserts by normalised name (or guest code); the device remembers its response and offers "Change my response"
- Spam protection: honeypot, minimum form time, per-IP sliding-window rate limit, origin check
- Storage adapters: JSON file (single server) or PostgreSQL (any provider); in-memory for tests
- Private export: `/admin` page and CSV/JSON API protected by a constant-time-compared bearer token; IPs are stored only as salted hashes; no guest data is ever returned to other guests

**Security headers**: nosniff, frame options, referrer policy, permissions policy, `no-store` on API responses; `robots: noindex`.

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for Railway (one-click from
GitHub via the included `railway.json`), Vercel/Node/Docker instructions and
the Postgres setup. In short:

```bash
npm run build && npm start               # any Node host
docker build -t eguest-invitation . && docker run -p 3000:3000 -v eguest-data:/data -e ADMIN_TOKEN=... eguest-invitation
```

## Remaining integrations / open items

- **Choose storage for production**: the file store suits a single VPS/Docker volume; use `RSVP_STORE=postgres` on serverless platforms (Vercel, Netlify) where the filesystem is ephemeral.
- **Optional licensed music track** (`public/audio/`), otherwise the generative score is used.
- **Rate limiting across multiple instances** needs a shared store (Redis/Upstash); the `consume()` contract in `src/lib/rsvp/rate-limit.ts` is ready for it.
- **Notifications** (email/WhatsApp to the couple on each RSVP) are not wired; `submitRsvp()` is the single hook point.
- **QR codes** for printed cards: point them at `/rsvp/our-love-story?code=<GUEST>`; QR generation itself belongs to the eGuest platform.
- The Google Maps embed could not be rendered inside the build sandbox (outbound network was restricted); the links and the click-to-load embed use standard key-less Google Maps URLs and should be verified once deployed.
