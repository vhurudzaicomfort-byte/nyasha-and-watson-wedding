# Nyasha & Watson — Wedding Invitation

A static, mobile-first digital wedding invitation for Nyasha Mazuruse & Watson Chin'ombe — Saturday, 5 December 2026, Colne Valley Nature Reserve Park, Harare, Zimbabwe.

The guest-facing site (`index.html`) is plain, static HTML/CSS/JS — no build step. RSVPs go
straight to WhatsApp; nothing about it needs a server. A separate private admin app
(`/admin`) is a real backend: Vercel Serverless Functions + Vercel Blob storage, for the couple
to manage the guest list, tables and door check-in. Self-hosted fonts (Bodoni Moda, Poppins,
Great Vibes) and vendored QR/scanning libraries — nothing loads from a third-party CDN at runtime.

## Structure

```
index.html               Guest-facing site: cover, hero/countdown, our day, venue+map,
                          programme, attire/colours, invitation card, RSVP, calendar
assets/css/style.css      Design system + all styles for the guest site
assets/js/main.js         Countdown, RSVP wizard, calendar links, invitation card canvas
assets/js/qrcode.min.js   Vendored QR code generator (davidshimjs/qrcodejs, MIT)
assets/js/jsQR.min.js     Vendored QR scanning/decoding library (cozmo/jsQR, Apache-2.0)
assets/fonts/             Self-hosted Bodoni Moda, Poppins, Great Vibes (SIL OFL)
assets/img/               Floral artwork (Pixabay Content License) + social preview image

admin/login.html          Admin sign-in page
admin/index.html          Admin app shell (dashboard, guest list, tables, check-in, reports)
admin/app.js              Admin app logic — calls the API below
api/admin/*.js            Serverless functions: login/logout/session, guests, tables, CSV export
lib/auth.js               Signed session cookie (HMAC-SHA256), used by every api/admin/* route
lib/blob-store.js         Reads/writes the single guests+tables JSON document on Vercel Blob
middleware.js             Edge Middleware — gates every /admin/* page behind the session cookie
```

## Before sending this to guests

Still open — accommodation details and a contact person/number for questions. These appear
as `tbc` badges in the "Our Day" section of `index.html` and can be edited directly once known.

Everything else (RSVP WhatsApp number, ceremony/reception times, dress code, parking, RSVP-by
date, programme) is already filled in.

## Local development

No build step — any static file server works:

```bash
npx serve .
```

## Deploy to Vercel

This is a zero-config static site.

```bash
npx vercel        # first deploy, links the project
npx vercel --prod # production deploy
```

Or connect the GitHub repository at [vercel.com/new](https://vercel.com/new) for automatic
deploys on every push to `main`.

## The invitation card

The "Invitation Card" section renders a 1080×1350 keepsake card live in the browser (`<canvas>`),
with a QR code that always points at the page's own live URL. Guests can download it as a PNG.
Because it's generated client-side, the QR code is automatically correct for whatever domain
the site is deployed to — nothing to hardcode.

## Guest &amp; table management — the admin app

`/admin` (linked from nowhere on the public site) is a real, password-protected app for the
couple: dashboard, guest list, table/seating assignment with overbooking prevention, printable
QR guest badges, camera-based QR check-in, and CSV exports.

- **Sign in**: `https://<your-domain>/admin/index.html` — you'll be redirected to
  `/admin/login.html` if you aren't signed in. The password is the `ADMIN_PASSWORD` environment
  variable (set on Vercel — Project Settings → Environment Variables). Change it any time with:
  ```bash
  vercel env rm ADMIN_PASSWORD production
  vercel env add ADMIN_PASSWORD production --value "your-new-password"
  ```
  then redeploy (`vercel --prod`) for it to take effect.
- **Data storage**: a single JSON document on Vercel Blob (private access, read/written only by
  the server-side API — never exposed to the browser). Fine for a guest list of a few hundred
  people; not built for heavy concurrent writes, which this app never sees in practice.
- **Sessions**: a signed, HttpOnly cookie (`ADMIN_SESSION_SECRET`), checked by `middleware.js` on
  every `/admin/*` page load and by every `api/admin/*` function on every request.
- **RSVPs are still manual**: guests RSVP via WhatsApp on the public site (no live sync), so log
  each response into the Guest List tab yourself as it comes in.
