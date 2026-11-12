# HANDOVER — Nyasha & Watson wedding invitation (eGuest)

_Last updated: 11 November 2026. Branch `ccr-b8fe8457-6dpy37`, draft PR #1 on `watsonchins-blip/watty`._

If you are Claude (or a developer) picking this up: read this file first, then
`README.md`, `docs/DEPLOYMENT.md` and `docs/EGUEST_INTEGRATION.md`. Everything
below is the state of the project at handover and what remains.

---

## 1. What this is

A luxury, photograph-free, fully interactive digital wedding invitation built
as a standalone Next.js 16 app, designed to be hosted later under the owner's
**eGuest** subdomain and to grow into the eGuest platform (multi-invitation,
guest codes, QR check-in, RSVP management).

**Confirmed wedding details** (single source of truth: `src/invitations/our-love-story.ts`)

| Field | Value |
| --- | --- |
| Couple | Nyasha Mazuruse & Watson Chin'ombe (Nyasha first, per the owner) |
| Date | Saturday 5 December 2026 (derived weekday; no override) |
| Times | Guests arrive 9:30 AM, seated / ceremony 10:00 AM, calendar end 4:00 PM, Africa/Harare |
| Venue | Colne Valley Nature Reserve Park, 7 Bay Noakes Road, Colne Valley, Chisipite, Harare, Zimbabwe |
| Maps | https://maps.app.goo.gl/aFjWs1ofgq1LSQgJA (owner supplied; not resolvable from the sandbox, verify on a phone) |
| Dress code | Classic • Elegant. Ladies: elegant dresses. Gentlemen: tailored tuxedo suits. Palette: Dusty Mauve #9B7386, Soft Champagne #E7D7B3, Peach #F0B48E, Ivory #F5F0E6 (gown labels: Muted Plum, Soft Champagne, Peach Coral, Ivory) |
| Gifts | Cash contributions appreciated; no physical gifts |
| Guidelines | Arrive 9:30 / seated 10:00; strictly by RSVP & invitation; no children |
| RSVP fallback | 077 277 3973, 077 269 2738 |
| RSVP deadline | none announced (`rsvp.deadline: null`) |
| Default party size | 2 (can be raised per guest with personal codes) |

The owner confirmed all of the above explicitly. Do not revert to the earlier
Canva placeholder names/date.

## 2. Original design references (what the owner gave)

Canva screenshots, 4 pages: (1) cover "Our Love Story" over a dark photo,
(2) DRESSCODE with gold cartouche badge, marble background, green leaves, white
florals, palette swatches and model photos, (3) GIFTS + GUEST GUIDELINES +
DIRECTIONS with Google map, (4) RSVP with QR code and phone numbers. Also three
other couples' invitations (PDF) as style references only. Rules from the owner:
no couple photographs, never use other people's photos, do not copy another
designer's work. All artwork in this project is therefore procedural SVG
(roses, foliage, sprigs, cartouches, flourishes, marble, croquis gowns and
tuxedos) — see `src/components/ornaments/`.

## 3. Current state — done

- Envelope with wax-seal monogram, opening choreography, replay.
- Sections: cover, countdown, details, dress code, gifts, guidelines, directions, RSVP, closing.
- Interactions everywhere: sticky section navigator + progress line, pointer-reactive
  cover glow, gold dust, tappable monogram/signature (petal burst), rolling countdown,
  tappable palette/gowns with hex copy, tap-to-acknowledge guidelines, tilting gifts
  card, copy-address + Waze/Apple Maps, petal celebration on accepted RSVP, toasts.
- Music: generative Web Audio score by default; licensed track via `NEXT_PUBLIC_MUSIC_SRC`.
- Add to calendar (Google + `.ics`), directions, share (native/copy/WhatsApp).
- RSVP backend: `POST /api/rsvp`, zod validation shared with the client, honeypot,
  min form time, per-IP rate limit, origin check, upsert de-dup by normalised name or
  guest code; file store (default) or Postgres; `/admin` + `/api/admin/rsvps` CSV/JSON
  behind `ADMIN_TOKEN`.
- Personal guest codes: `src/invitations/our-love-story.guests.ts` (server-only, empty).
- Routes: `/`, `/invitation/[slug]`, `/rsvp/[slug]`, `/print/[slug]`, `/admin`, `/api/*`.
- Printable A5 PDF: `npm run export:pdf` → `exports/our-love-story-invitation.pdf`
  (QR to maps link on the directions page; QR to the web link on the RSVP page).
- Standalone single-file build: `npm run build:artifact` → `artifact/dist/index.html`
  (used for the claude.ai hosted preview; RSVPs there go to the artifact `db` store).
  Publish it together with the images as supporting files:
  `images/dress-code.jpg`, `images/floral-corner.webp`, `images/floral-garland.webp`
  (from `public/images/`), because the page references them relatively.
- Photographic decor supplied by the owner (`invitation.decor` + `dressCode.inspirationImages`):
  `public/images/floral-corner.webp` (ivory/peach roses), `public/images/floral-garland.webp`
  (burgundy/ivory garland), `public/images/dress-code.jpg` (gowns + tuxedos). Cutouts were made
  from white-background JPGs with PIL + scipy (flood fill + enclosed-white removal). SVG florals
  remain as the fallback when `decor` is absent.
- Dockerfile (standalone output) and `railway.json` (Dockerfile builder, health check).
- Tests: `npm test` (19 vitest tests), Playwright QA scripts were run ad hoc (not committed).
- Security headers, noindex, IP hashing, no guest data exposed to guests.

## 4. Links

- Repo / PR: https://github.com/watsonchins-blip/watty/pull/1 (draft, branch `ccr-b8fe8457-6dpy37`)
- Hosted preview (claude.ai Artifact, private to the owner until shared):
  https://claude.ai/artifact/PXj5iUviqhpbUsLoWQHttn
  - capabilities: `db` rules `rsvps` read admin / write owner, `rsvps/{self}` read+write interact; `user`.
  - To republish from a new session: rebuild with `npm run build:artifact`, then publish
    `artifact/dist/index.html` with that URL as `url` (read it first).
- Railway: NOT deployed. The owner's "MFI" cloud environment holds a Railway API token for
  `backboard.railway.com`, but the session could not be switched to it (approval card was
  declined/failed on the owner's phone). Deploy either by approving that switch from a
  desktop browser, or manually via the Railway dashboard (steps in `docs/DEPLOYMENT.md`).

## 5. How to run

```bash
npm install
cp .env.example .env.local          # set ADMIN_TOKEN (24+ chars)
npm run dev                         # http://localhost:3000
npm test && npm run build           # must both pass before pushing
npm run export:pdf -- http://localhost:3000 our-love-story https://PUBLIC_URL   # needs a running server + Playwright
npm run build:artifact              # single-file build for static hosts
```

Node 20+. Playwright is used only by scripts (not a dependency); in the original
sandbox it was pre-installed globally.

## 6. Architecture notes (for continuing work)

- All content/theme: `src/invitations/our-love-story.ts`; registry in `src/invitations/index.ts`.
- Client orchestration: `src/components/invitation/Invitation.tsx` (envelope → sections, music, nav, petals, toasts).
- Host adaptation: `src/components/invitation/env.tsx` — `submitRsvp` transport, `allowEmbeds`, `allowDownloads`.
  The Next app uses `/api/rsvp`; the artifact build (`artifact/entry.tsx`) uses the artifact db.
- RSVP domain logic: `src/lib/rsvp/service.ts` (`submitRsvp`) — single hook point for notifications later.
- Storage interface: `src/lib/rsvp/repository.ts` (`file` | `postgres` | `memory`).
- Time zone math: `src/lib/datetime.ts` (never use `new Date("YYYY-MM-DD")` directly).
- CSS: plain CSS modules + tokens in `src/app/globals.css`; no Tailwind.
- Fonts: self-hosted via @fontsource in Next; Google Fonts link in the artifact build.
- Styling conventions: luxury stationery, dusty mauve / deep plum / soft gold / peach / botanical green,
  Cormorant Garamond (display), Pinyon Script (calligraphy), Jost (labels). Keep animations tasteful,
  respect `prefers-reduced-motion`, mobile-first (tested 360/430/820/1440).

## 7. Remaining / next steps

1. **Public hosting** (Railway recommended; config present). Then set `NEXT_PUBLIC_SITE_URL`,
   regenerate the PDF with the public URL so the RSVP QR points at it, and update the artifact
   share text if still used.
2. **Guest list / personal codes**: fill `our-love-story.guests.ts` (or move to DB) and send
   `?code=XXXX` links; this enables per-guest allowances and name greetings.
3. **Notifications** on RSVP (email/WhatsApp) — add in `submitRsvp()`.
4. **Postgres** for serverless hosts (`RSVP_STORE=postgres`); shared rate limiter if multi-instance.
5. **Verify on device**: Google Maps short link, map embed, Web Share, music on iOS.
6. **eGuest platform**: follow `docs/EGUEST_INTEGRATION.md` seams (registry → DB, guest lookup,
   repository, admin auth, QR check-in).
7. Optional: licensed background track in `public/audio/`; licensed dress-code photos via
   `dressCode.inspirationImages`.

## 8. Owner preferences observed

- Wants everything interactive, luxurious, not generic; approves of the current look.
- Prefers receiving tangible outputs: links, PDF files, cards to approve.
- Uses a phone for most interaction (approval cards may not render well there).
