# Claude Code notes: the invitation inside the Nyasha & Watson site

This folder is the invitation design from watsonchins-blip/watty PR #1, adapted to
run on the existing wedding site (nyasha-watson.e-guests.com). `HANDOVER.md`,
`README.md` and `docs/` describe the PR's original standalone server mode; that
mode is NOT used here. What applies:

- Built as a **static export** and published into the site root:
  `node node_modules/next/dist/bin/next build && node scripts/publish.mjs`
  (npm's .bin shims break on the "&" in the folder path, so run node directly).
  Typecheck: `node node_modules/typescript/bin/tsc --noEmit`.
- There is no server code here. RSVPs, guest links (`?g=`), approvals and check-in
  go to the site's existing `/api/rsvp` and `/api/checkin` via
  `src/components/invitation/host.ts`. The portal's Blob data is the single source
  of truth; never expose guest data to other guests.
- Content lives only in `src/invitations/our-love-story.ts`. Nyasha is always
  named first, and "&" between the names is the real rings image (`<Rings>`).
- Decorative photos (florals, frame, dress-code models, rings) are in
  `public/images/`, mapped to slots in `decor.slots`; placement is in
  `src/app/decor.css`. They must never cover text, at any width.
- Test locally with the "wedding-site-local" launch config (port 3010, throwaway
  `.data-local/data.json`) at 390, 820 and 1366 px before deploying.
- Deploy a Vercel preview first (previews use an isolated data copy); production
  needs the owner's approval.
