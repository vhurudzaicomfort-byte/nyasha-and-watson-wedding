# Nyasha & Watson — Wedding Invitation

A static, mobile-first digital wedding invitation for Nyasha Mazuruse & Watson Chin'ombe — Saturday, 5 December 2026, Colne Valley Nature Reserve Park, Harare, Zimbabwe.

Plain HTML/CSS/JS, no build step, no backend. Self-hosted fonts (Bodoni Moda, Poppins, Great Vibes) and a vendored QR library — nothing loads from a third-party CDN at runtime.

## Structure

```
index.html            Full guest experience: cover, hero/countdown, our day, venue+map,
                       programme, attire/colours, invitation card, RSVP, calendar
assets/css/style.css   Design system + all styles
assets/js/main.js      Countdown, RSVP wizard, calendar links, invitation card canvas
assets/js/qrcode.min.js  Vendored QR code generator (davidshimjs/qrcodejs, MIT)
assets/fonts/          Self-hosted Bodoni Moda, Poppins, Great Vibes (SIL OFL)
assets/img/            Floral artwork (Pixabay Content License) + social preview image
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

## Guest & table management

This repository intentionally has **no backend** — RSVPs are sent straight to WhatsApp, and
there's no guest database here. A separate, private companion tool for managing the guest list,
table seating, dietary requirements and door check-in was built for the couple's own use; it
isn't part of this repository since it depends on a hosted, authenticated database.
