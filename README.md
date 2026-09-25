# Cahyana Dashboard

The owner's dashboard for [Cahyana Ubud Experience](https://cahyanaubudexperience.com), a
Bali tour operator. It shows the bookings as they stand and lets the owner change a price
without a deploy.

**Live demo:** _(add the Vercel URL here)_ — sign in as `demo` / `demo`.
The demo is filled with sample bookings and never touches the production API.

---

## What it does

- **Bookings, grouped the way a booking actually exists.** The database stores one row per
  day, so a three-day trip is three rows sharing a `booking_ref`. They are grouped into four
  buckets: **Needs attention**, **Upcoming**, **Past** and **No date**.
- **Needs attention** is the point of the screen: a payment that started over an hour ago and
  never finished, or money that arrived at the wrong amount. Each one carries the reason.
- **Prices.** Type a new rupiah price, save, and the next guest is quoted it. No deploy, no
  redeploy of the public site, and a one-tap reset back to the number that shipped.

## How it is built

Next.js (App Router) on Vercel, talking to an Express/Postgres API on Railway. Tailwind v4
with the public site's own design tokens.

### The token never reaches the browser

Signing in does not hand the browser a token. It sets an **`httpOnly` cookie** that no
JavaScript on the page can read — not this app's, not an injected dependency's, not a browser
extension's. Every request from the page goes to this app's own `/api` routes, and those
routes attach the token and call the upstream API server-to-server.

```
browser ──(same-origin, cookie)──► /api/bookings ──(Bearer token)──► cahyana-api
```

Two things fall out of that, and both of them were the point:

- **No CORS.** The only cross-origin hop happens on the server, and CORS is a browser rule.
- **A stolen page cannot become a stolen session.** There is no token in `localStorage` for a
  script to lift.

### The gate is the data, not the page

`proxy.js` redirects a visitor with no cookie to `/login`. That is routing convenience, not
security: it cannot tell a real token from a made-up one without a network call per request.
What actually holds is that **every figure on these pages comes from an endpoint behind
`requireAuth` upstream** — a forged cookie gets a page with nothing in it.

Nothing sensitive is ever rendered into the HTML, so there is nothing to leak before the
check runs.

### The demo is answered here, never forwarded

The demo password is printed at the top of this file. Forwarding it to the real API would put
a public password against the real door and spend the real rate limit, so the demo account is
recognised in this app and served from fixtures in `lib/demoData.js`.

Demo price edits are **real edits** — they just live in the visitor's own cookie instead of a
database. Save, reload, reset and the "that is 7x the current price, confirm it" guard all
behave exactly as they do on the live panel. A demo you cannot type into is a screenshot.

### Rupiah is the source of truth

Every price on the site is derived from one rupiah figure. The panel takes rupiah and shows
the derived USD beside it, **read-only** — a second editable currency is a second number that
can drift. Thousand separators are grouped as you type, because `90000` next to `900000` is
not something anyone spots, and a dropped zero is the mistake nothing downstream would
question.

The panel also reports **drift**: the public site bakes some prices in at build time (listing
card fallbacks, the JSON-LD Google reads), so after a change those stay stale until the site
is rebuilt. Saying which ones turns a silent cost into a visible one.

## Design system

The tokens, the shell and two components are **copied** from the public site, not shared
through a package:

| here | from |
| --- | --- |
| `app/tokens.css` | the site's `:root` tokens and reset |
| `components/ui/RailLayout.jsx` | the shell behind Our Company, My Trips and the guide articles |
| `components/ui/{railClasses,btnClasses,formClasses}.js` | the button, field and rail strings |

Copying is the deliberate trade. A shared package would couple a deploy of this dashboard to a
deploy of the public site, for two products with different release rhythms and different
audiences. The cost is that a brand change has to be made twice — so both files say so, at the
top, in the file.

## Running it

```bash
npm install
cp .env.example .env.local     # then fill it in
npm run dev
```

| variable | what it is |
| --- | --- |
| `CAHYANA_API` | base URL of the API, including `/api` |
| `DEMO_ENABLED` | `true` to offer the demo account at all |
| `DEMO_USER` / `DEMO_PASS` | the demo credentials shown on the login page |

`DEMO_ENABLED` is off unless the deployment says otherwise, so a checkout with no env file has
no open door.

## Verifying it

`verify-dash2.mjs` drives a real browser against a real build at 390, 768 and 1280:
the redirect for a signed-out visitor, both data routes answering **401 with no data** to a
caller with no cookie, the design tokens resolving to the site's values *as the page resolves
them* (not as numbers typed into the test), the rail at 248px on desktop and absent on a
phone, no sideways overflow, the demo banner, a reachable Sign out, the price panel loading,
and the login rate limit actually biting.

Each check was confirmed by **putting the bug back**: removing the token import (9 failures),
serving bookings without a session (6), and removing the login limiter (1).

The second of those is the one worth keeping. The first version of the harness only checked
that the login page's HTML contained no booking data — and a route that handed bookings to
*anyone* passed it 53/53, because the login page never calls that route. An assertion that
only proves the harness agrees with itself is not a test.
