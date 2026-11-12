# Connecting to the eGuest platform

The invitation was built so it can be lifted into the eGuest platform without
a rewrite. This note explains the seams.

## URL structure (already supported)

```
eguest.<domain>/                                → default invitation
eguest.<domain>/invitation/<slug>               → any invitation
eguest.<domain>/invitation/<slug>?code=<GUEST>  → personalised invitation
eguest.<domain>/rsvp/<slug>[?code=<GUEST>]      → RSVP-only page (QR target)
```

Point the subdomain at this deployment (or mount the app under the platform's
router) and set `NEXT_PUBLIC_SITE_URL=https://eguest.<domain>`.

## Data seams

| Concern                 | Today                                          | eGuest later                                   |
| ----------------------- | ---------------------------------------------- | ---------------------------------------------- |
| Invitation content      | `src/invitations/index.ts` static registry     | Replace `getInvitation(slug)` with a DB/API call returning the same `Invitation` shape |
| Guest identification    | `our-love-story.guests.ts` (code → name, allowance) | Replace `lookupGuest(code)` with a guest-table lookup; keep `GuestContext` |
| RSVP storage            | `RsvpRepository` (file / postgres / memory)    | Point `RSVP_STORE=postgres` at the platform DB, or implement the 2-method interface over the platform API |
| RSVP business rules     | `src/lib/rsvp/service.ts#submitRsvp`           | Call the same function from platform endpoints; add notifications/webhooks here |
| Admin / reporting       | `/admin` + `/api/admin/rsvps` (bearer token)   | Platform auth (sessions/roles) replaces the token guard in `request.ts#isAdminAuthorised` |
| Theming per wedding     | `invitation.theme` → CSS variables              | Stored per invitation in the DB                 |

All UI components receive data as props (`Invitation`, `GuestContext`), so
none of them change when the data source moves.

## Future capabilities and where they plug in

1. **Multiple invitations** – add objects to the registry (or DB rows); routes already key by slug.
2. **Unique invitation URLs** – slugs can be random IDs; nothing assumes human-readable slugs.
3. **Guest-specific access** – `?code=` is resolved server-side; to make access *mandatory*, return `notFound()` in the page when `lookupGuest` yields null.
4. **Individual guest identification** – `GuestContext.code` is stored with each RSVP and used as the de-dupe key.
5. **Centralised RSVP management** – all writes go through `RsvpRepository.upsert`; swap the store.
6. **Attendance tracking / check-in** – add a `checkedInAt` column; the RSVP record already carries the guest code to scan.
7. **QR-code invitations** – generate QR codes for `/rsvp/<slug>?code=<GUEST>` or `/invitation/<slug>?code=<GUEST>`.
8. **QR check-in** – a platform route reading `code` and marking attendance; no change to the invitation.
9. **Guest list management** – replace the guests file with a table; keep `{ displayName, allowance }`.
10. **Analytics** – add a lightweight event in `InvitationExperience` on open/RSVP, or platform-level request logging.

## Embedding instead of hosting standalone

If the platform shell renders the invitation in an iframe or proxies it,
add the shell origin to `RSVP_ALLOWED_ORIGINS` so RSVP POSTs pass the origin
check, and relax `X-Frame-Options` in `next.config.ts` for that origin.

## Security notes to keep when integrating

- Never return other guests' records from a public endpoint; only the admin
  endpoint lists responses.
- Keep guest identifiers opaque (codes), never names or phone numbers in URLs.
- Keep server-side validation (`rsvpSchema`) as the source of truth.
- Keep `ADMIN_TOKEN`/DB credentials in environment variables only.
