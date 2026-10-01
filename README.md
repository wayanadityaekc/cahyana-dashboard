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
- **Chat.** The support panel on the public site answers most questions from the price list by
  itself; a conversation only reaches here when a guest asked for a person. Threads waiting on
  a reply carry a count, and answering one clears it.

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
| `components/Navbar.jsx` | the site's header, phone drawer and hamburger (DASHBOARD BRIEF #1/#2) |

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

### One thing the API has to know about this deployment

The chat column holds a WebSocket, and that is the **only** request this app's browser makes
straight to cahyana-api instead of through the BFF - a socket cannot be proxied through a
serverless route. So the API's origin allowlist has to include wherever this is deployed:
`EXTRA_ORIGINS=https://your-dashboard-domain`, or `ALLOW_VERCEL_PREVIEWS=true` while it is
still on a `*.vercel.app` URL.

Get it wrong and nothing breaks loudly: the upgrade is refused, the panel falls back to
polling every 8 seconds, and the only sign is that replies stop feeling instant.
**`GET /api/admin/ws-check`** on the API answers it - it prints the origin it saw, whether it
would be allowed, and who is connected right now.

Everything else still goes through this app's own routes, and the admin token still never
leaves the server: the browser gets a one-shot ticket instead, good for about thirty seconds.

## Editing the site's words

A **Content** section: pick a legal page, retype it, **Publish**. Publishing
**commits to the site's repo** and CI rebuilds - so it is about three minutes,
not instant, and the panel says so and reports the build result afterwards.

- **Drafts live on the server**, so closing the tab or moving to the phone keeps
  them. The button carries a count: `Publish (3)`.
- **There is no "add a paragraph" button, on purpose.** The API refuses any draft
  whose structure differs from the live file - a new page, an extra block, a
  changed block type. The editor can retype what is there and nothing else.
  Adding a clause is a change to the *page*, not to its *words*, and it needs its
  own (more careful) piece of work.
- **The demo can type but cannot publish**, and says so. A demo that pretends to
  have published is worse than one that does nothing.

**Gotcha worth carrying: 401 and 403 mean ONE thing here - the session is gone.**
`lib/api.js` turns either into `Unauthorized`, which sends the visitor to
`/login`. The demo's publish refusal first answered 403, so clicking Publish
logged you out and the panel vanished instead of explaining itself. Any "no, but
you are still signed in" answer must be a **400**.

The rules that actually protect the repo are server-side (allowlisted paths,
structure-only-unchanged, a four-tag sanitiser, and a commit that carries the
file's sha). See the content section in `cahyana-api`'s CLAUDE.md.

```
DEMO_ENABLED=true DEMO_USER=demo DEMO_PASS=demo npx next start -p 3100
node verify-content.mjs                       # 24/24
```

## The seasonal sale

A **Sale** section next to Prices: one percentage off every program, with a last
day. It is a **price change, not a payment option**, which is why it sits beside
Prices and why `payment.js` in the API never hears about it.

- **Programs only** - tours, tour packages, destinations, experiences,
  performances. Transfers, charters and the pick-up fee are **not** discounted:
  those are priced off a car and a driver, so a cut there is nearly all margin.
- **It never stacks with a referral code, and there is no switch for that.** The
  API refuses a sale below the referral discount (5%), so the sale is always the
  bigger of the two and a code simply steps aside while one runs. Guaranteeing it
  by construction beats writing "best of" as arithmetic that three files and two
  rounding modes have to agree on.
- **The demo has its own sale**, in the visitor's own cookie, with the **same
  validation** the live route applies - so the demo teaches the real rules. A
  demo request still never reaches the real API.
- Prices on the site follow within about half a minute (the API caches the sale
  with a TTL, because Railway can run more than one instance).

### Verifying it

```
DEMO_ENABLED=true DEMO_USER=demo DEMO_PASS=demo npx next start -p 3100
node verify-promoui.mjs                       # 22/22
```

Tested with three real bugs: the POST envelope read as a body (8 fail), the
Prices catch-all restored so the price list drew under the Sale heading (16),
and the percentage floor removed (2).

**One gotcha worth carrying:** `postJson` returns the **envelope** - `{ status,
json }` - while `getJson` returns the **body**. Reading a POST result as a body
leaves the state undefined, and the screen then looks exactly like a button that
does nothing: no result, no error, no change. That is how this shipped the first
time and what the harness caught.

## Installing it on a phone

The dashboard is a PWA: add it to the home screen and it opens without browser
chrome. The bottom bar shows on every phone-sized screen (below 993px),
installed or in a browser tab (DASHBOARD BRIEF #3); desktop has none.

- **Navbar** (`components/Navbar.jsx`, every width): the site's own header.
  Phones get the hamburger + left drawer holding the sections (not Chat), a
  link to the live site and Sign out. Chat is its own icon in the bar, and the
  account slot at the right holds Sign out. Desktop has no hamburger: the cream
  rail is still the menu there.
- **Bottom bar** (`components/AppBottomNav.jsx`): Attention, Upcoming, Past,
  Prices. Chat left the bar when it got its own navbar icon. Its shell is the
  site's book bar (1px top line, rounded top corners, no shadow). The bar,
  the rail and the drawer all drive the **same `tab` state**, so they cannot
  disagree about what is open.
- **`components/pwaClasses.js`** holds the one condition (`PHONE_ONLY`), and the
  string is written out **in full on purpose**: Tailwind scans source text, so a
  class assembled by interpolation is never generated. That exact mistake shipped
  on the public site first and failed silently - the bar stayed `display:none`
  with no error anywhere.
- **`@custom-variant standalone`** (in `app/globals.css`) is deliberately two
  selectors: `@media (display-mode: standalone)` for Chrome/Android and iOS
  16.4+, and `html[data-standalone]` for older iPhones, which only expose
  `navigator.standalone`. `PwaRegister` writes that attribute on mount.
- **Its own icon, without drawing one.** Both apps land on the same phone, and
  two identical tiles under two labels is a daily annoyance. `tools/make-icons.js`
  takes the site's icon and swaps **only the tile** - brand gold becomes brand
  soft-black, the monogram stays. Not a CI gate; run it by hand if the logo
  changes and commit the output:

  ```
  node tools/make-icons.js ../CUE/public/assets/icons/icon-512.png
  ```

- **The service worker caches nothing that came from the server**, and here that
  matters more than it does on the site: everything is live data behind a session
  cookie. A cached page or API response is a stale answer about money, or one
  person's answer shown to whoever picks the phone up next. `/api/` is excluded
  outright; only `/_next/static/` and the font are cached, because their names
  change when their contents do. Bump `VERSION` in `public/sw.js` to retire a
  cache - there is no per-file invalidation to get wrong.

### Verifying it

```
DEMO_ENABLED=true DEMO_USER=demo DEMO_PASS=demo npx next start -p 3100
node verify-dashpwa.mjs                       # 47/47
```

Two things about this harness are worth knowing before you trust it:

- **It signs in ONCE** and hands the session to all seven contexts. Signing in
  per context blew the limiter (5 per IP per 15 minutes, counted in the server
  process) on the sixth and failed as a navigation timeout, which reads like a
  broken page. It now says which of the two it is - but **restart the server
  between runs** anyway.
- **It cannot drive the `display-mode` branch.** Measured, not assumed: this
  Chromium honours `Emulation.setEmulatedMedia` for `prefers-color-scheme` and
  ignores it for `display-mode`, and a headless `--app` window exposes no page.
  So behaviour runs through `html[data-standalone]`, and the media branch is held
  to the same declarations by comparing the two **in the built CSS**. Drop a slot
  from the custom variant and that fires.

Tested with four real bugs: the class name rebuilt by interpolation (14 fail),
the older-iPhone branch removed (10), the site's own icon copied in (1), and the
worker allowed to cache `/api/` (1).

## Verifying it

`verify-dash2.mjs` drives a real browser against a real build at 390, 768 and 1280 (71 assertions):
the redirect for a signed-out visitor, both data routes answering **401 with no data** to a
caller with no cookie, the design tokens resolving to the site's values *as the page resolves
them* (not as numbers typed into the test), the rail at 248px on desktop and absent on a
phone, no sideways overflow, the demo banner, a reachable Sign out, the price panel loading,
the login rate limit actually biting, and the chat: two threads, an unread count on the one
waiting, a reply appearing immediately and still being there after a reload.

`verify-dashlive.mjs` covers what that one cannot: it points `CAHYANA_API` at a real API and
puts a guest on the other end (28 assertions). A guest's message reaching an open conversation
**with the conversation never re-read** - the only airtight version of "that was not a poll" -
the ticket exchange, typing in both directions, the reply arriving down the guest's own socket,
and demo mode refusing to reach for a socket it has no API for.

```bash
node ../cahyana-api/tools/chat-dev-server.js     # the API, database in memory
CAHYANA_API=http://127.0.0.1:4599/api npm run build && npm start -- -p 3101
node verify-dashlive.mjs
```

**Restart the dashboard before every run.** Sign-in is limited to 5 attempts per 15 minutes and
the counter lives in the server process; the harness names that failure explicitly, because it
used to surface as a 401 from an unrelated route much later.

Each check was confirmed by **putting the bug back**: removing the token import (9 failures),
serving bookings without a session (6), and removing the login limiter (1).

The second of those is the one worth keeping. The first version of the harness only checked
that the login page's HTML contained no booking data — and a route that handed bookings to
*anyone* passed it 53/53, because the login page never calls that route. An assertion that
only proves the harness agrees with itself is not a test.

`verify-dashnav.mjs` measures the navbar, the phone drawer and the app tab bar **against the
public site's own build**, in the same browser at the same width (320, 390, 768, 1280): gutter,
logo, hamburger box and bars, chat icon, drawer width and edge, row type and pills, close
button, and the tab bar shell against CUE's real `.bookbar`. It needs CUE's `out/` served on
port 4000 (`node tools/serve-out.js` in the CUE repo).

## Settings + push notifications (DASHBOARD BRIEF #4/#5)

**Settings** is a section like the others: last in the sidebar (desktop) and the
drawer (phones), and a row in the navbar's account menu. Its icon is the Lucide
**bell** - the same glyph the push notification itself shows (Wayan's call).

- **Account**: who is signed in and when this session ends (`/api/account` ->
  `/admin/me`), Sign out, and **sign out on all devices** (ends every admin
  session - a lost phone). The password stays in Railway (`ADMIN_PASS`).
- **Notifications**: one switch for "push on this device", one per event, and a
  test button. Toggles are **per device** - the server keeps them next to that
  device's subscription (cahyana-api `push.js`). Defaults: new booking, payment
  needs attention and chat ON; new review and the stopped-at-payment digest OFF.
  The browser is asked for permission only when the switch is flipped. On an
  iPhone the switch stays off in a Safari tab: iOS only allows web push for the
  Home Screen app. The demo account never gets push.
- **The switch is the website's switch** (the return-trip toggle on /transfer),
  measured against it.

**How a push arrives**: cahyana-api sends it (Web Push, VAPID) next to the owner
email it already sends; `public/sw.js` shows it with `/icons/bell-192.png`
(badge `/icons/bell-badge-96.png`, both rendered from Lucide's Bell by
`tools/make-bell-icons.js`); a tap opens `/?tab=<section>`, which the page reads
once and then drops from the URL. The lock screen only ever shows a booking
reference and a tour name.

**Needs, on the API side**: the `claude/dashboard-push` branch of cahyana-api
merged, and `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` set in
Railway. Until then Settings says "Push is not set up on the server yet".

`verify-settings.mjs` runs all of it against the real API server (its database
in memory, its pushes written to a file): reachable from sidebar, drawer and
account menu; the switch measured against the website's; turning push on
subscribes the device in the API with the right defaults; each toggle reaches
the API; a chat event is NOT sent while Chat is off and IS sent (with nothing
about the guest in it) once it is on; the test button; the payload delivered
to the real service worker shows the bell and opens the right section; blocked
permission, an iPhone tab and the demo all keep the switch off and say why; and
sign out on all devices ends a second device's session too.

```bash
node ../cahyana-api/tools/chat-dev-server.js                 # port 4599
CAHYANA_API=http://127.0.0.1:4599/api npx next start -p 3101
DEMO_ENABLED=true DEMO_USER=demo DEMO_PASS=demo npx next start -p 3100
(cd ../CUE && node tools/serve-out.js)                       # port 4000
node verify-settings.mjs
```

## Drivers + dispatch (DASHBOARD BRIEF #7)

Two halves, one app.

**The owner's side** - two new sections in the dashboard:
- **Drivers**: create a driver (name, phone, username, password - ALL required;
  the owner types the password, nothing is generated, and a driver can never change it
  themselves). The password is shown ONCE, to hand over in person; the server
  only keeps a hash. New password and Deactivate both sign that driver out on every
  device at once. There is no self-signup and no env variable per driver.
- **Dispatch**: every confirmed (paid / not charged online) booking from today on, not
  villa stays. "Needs a driver" first. One driver for the whole booking plus a note, or
  a different driver per day from the line's own picker. A driver's decline puts the line
  back here marked "Declined by X", and emails + pushes you.
- Booking cards now say who drives each line, and whether they accepted.
- Chat has a **Guests | Drivers** switch; each driver has one private thread with you.

**The driver app** - `/driver`, same address:
- Its own install: `/driver.webmanifest` (name "Cahyana Driver", green tile, opens on
  `/driver`) - a phone can carry both apps. Its own httpOnly cookie (`cue_driver`): the
  owner's cookie does not open `/driver`, a driver's does not open `/`.
- Signed out it shows only the sign-in form and how to add it to the Home Screen.
- Tabs: **Bookings** (only their jobs; first name + last initial, phone, pickup, time,
  guests, flight, your note - never the guest's email or price; Accept / Decline),
  **Earnings** (12-month bar chart + month list; full program price, earned once the
  date has passed), **Chat** (with you only), **Account** (job alerts, password, sign out).
- **Job alerts are pushed hard**: until the phone has push on, a full-screen prompt
  greets every app launch, and a red reminder sits on every tab. On iPhone it explains
  Add to Home Screen first, since iOS only allows push there.

### Verifying it
```
cd ../cahyana-api && PUSH_LOG=/tmp/p.jsonl node tools/driver-dev-server.js     # real Postgres, port 4598
CAHYANA_API=http://127.0.0.1:4598/api npx next start -p 3102
PUSH_LOG=/tmp/p.jsonl node verify-driver.mjs
```
Restart both before each run. The look is measured against the owner's dashboard in
the same browser (header, logo, h1, tab bar, rail), at 320 / 390 / 768 / 1280.

## Two dashboards (DASHBOARD BRIEF #8)
`/` is the home page: two tiles, **Cahyana Ubud Experience** and **Ubud Private Villas**, each with one live
number. One login opens both; the navbar has a Tours | Villas switcher (a drawer row on phones).
- **`/cue`** - everything tour-side: bookings, Dispatch, Drivers, Sale, Content, Reviews, Chat, tour Prices.
  Asks the API with `?scope=cue`, so it can never receive a villa line.
- **`/villas`** - Upcoming / Past stays, Needs attention, **Calendar** (is each villa's Airbnb calendar readable,
  and which nights are taken - an unreadable calendar says so instead of looking empty), the two villas' Prices,
  and **Discounts** and **Ratings**, which exist as pages but are deliberately not wired (no rule, no form, no
  numbers) until the owner decides the rules. Asks with `?scope=villa`. No chat icon: there is no villa chat.
- **Bundled bookings** (one ref: a villa stay + tours) show on each side with only that side's lines, a
  "part of a bundle" note and a link to the other dashboard. The total shown is the whole booking's: it is
  one payment.
- **Old links keep working**: `/?tab=upcoming` (old bookmarks, push notifications) redirect to `/cue?tab=upcoming`.
  Only known section names are forwarded.
- This separates what each dashboard *shows*; there is still one owner login, not two permission levels.

### Driver ratings
A guest reviews the tour once; that review counts for the driver of that booking and tour (booking ref + tour
name -> the dispatched row). Dispatch shows "Made - 4.5 (12 reviews)" in the picker and on each assigned line,
"No reviews yet" when none. The Drivers list does not show ratings. The driver app's Earnings page has a
"Tour reviews" card: average, count, and per review only stars, tour and month - never the guest's words,
name or booking.

### Verifying it
Same servers as above (`driver-dev-server.js` now also seeds a villa bundle), plus:
```
PG_URL_FILE=/tmp/pgurl.txt node tools/driver-dev-server.js     # in cahyana-api; also needs PUSH_LOG
PG_URL_FILE=/tmp/pgurl.txt node verify-split.mjs
```

## Standing rules: phone input zoom + popup scroll lock (DASHBOARD BRIEF #9)
Both apply to everything built later, not just what exists today.
- **No zoom on focus.** iOS Safari zooms the page when a focused field is under
  16px. `app/globals.css` sets every `input` (not checkbox/radio/range), `select`
  and `textarea` to 16px at `max-width: 992px` or on touch screens
  (`pointer: coarse`), with `!important`, on the bare elements - not on a class,
  so a new field is covered without remembering. Desktop stays 12.8px. Do not
  fix a zoom by changing `viewport` (`maximum-scale` takes pinch-zoom from
  Android users).
- **Popups lock the page.** Any popup, dialog, drawer or sheet calls
  `useScrollLock(open)` from `lib/useScrollLock.js`. It counts, so two overlays
  open together unlock only when the last closes. Never set
  `document.body.style.overflow` by hand.
- Checked by `verify-mobile.mjs` (every field on every owner tab, `/login`,
  `/villas` and the driver app at 390/768/1280; drawer and push gate lock and
  release the page).

## "Update available" prompt (DASHBOARD BRIEF #11)
The installed app (owner dashboard and driver app alike) tells you when a newer version is live.
- `next.config.mjs` stamps every build with one id (`NEXT_PUBLIC_BUILD_ID` = the Vercel commit sha).
  `/api/build` answers which build the server is serving now. `components/UpdatePrompt.jsx`,
  mounted in the root layout, compares the two when the app comes back to the foreground, when it
  goes back online, and every 5 minutes. Different = a small banner: "Update available. Refresh
  to get the latest version." Tapping Refresh reloads.
- It asks instead of reloading by itself: someone halfway through a reply or an edit would lose it.
- Why not the service worker alone: `public/sw.js` only changes when its own bytes change and a
  normal deploy leaves them alone, so the browser never reports a new worker. The page's JS is
  what changes, hence the build id. The worker file is still re-checked on every poll.
- Dev server has no build id, so the prompt stays off there.
- Checked by `verify-update.mjs`. One thing it cannot prove: Vercel "skew protection", if turned on
  for the project, can keep an old tab talking to its own old deployment, in which case /api/build
  would answer with the old id and no banner would show. Turn it off if the banner never appears.

## Driver sign-in + past trips in Dispatch (DASHBOARD BRIEF #12)
- **Driver sign-in** is username, password, Sign in and Install - no title, no sentences, no field labels
  (placeholders plus aria-labels). Signing in never needs the app installed. **Install**: Android and
  desktop Chrome get the browser's own one-tap prompt; iPhone gets a popup with the manual steps (iOS has no
  one-tap install); a browser that offers neither (or a prompt already used) gets the same popup, so the
  button never does nothing. Hidden once the app is installed. Do not put instructions back on this page.
- **Dispatch has a "Past trips" filter** (90 days back). Assign, change or clear a driver exactly like an
  upcoming trip. No alert goes out and the driver has nothing to accept (it is recorded as accepted); it only
  fixes who drove it. Past lines never count toward "Needs a driver" or the sidebar badge.
- Checked by `verify-brief12.mjs`.
