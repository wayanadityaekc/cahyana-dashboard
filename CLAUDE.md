# cahyana-dashboard — Project Rules (owner and driver apps)

Project-specific. Universal rules live in `CLAUDE-global.md` (a copy; the master is in `cahyanaui`). This file overrides global where they differ (last section).
Current state only. Read from the code on 9 Oct 2026. What cannot be seen in the code is marked **UNKNOWN — ask Wayan**. Server rules (prices, payments, bookings, drivers, content edits) live in the `cahyana-api` project file; the public site is in the `CUE` project file.

@CLAUDE-global.md

## 1. What it is

- Next.js (App Router) app on Vercel (`https://cahyana-dashboard.vercel.app`, per the CUE notes). Tailwind v4, Lucide, no other UI library. React 19, Next 16.
- Two apps in one repo, two separate sign-ins and cookies:
  - **Owner dashboard** at `/` (`/cue` and `/villas` views): bookings in four buckets (Needs attention, Upcoming, Past, No date), prices, seasonal sale, reviews moderation, dispatch, drivers, chat, content edits, villa calendar, settings and push notifications (`components/admin/*`, `components/Dashboard.jsx`, `components/VillasDashboard.jsx`).
  - **Driver app** at `/driver`: its own install, its own cookie, jobs, chat, earnings (`components/driver/`, `app/driver/`).
- It is a **client of `cahyana-api`**. It owns no data and no business rule. Money, status and ownership are decided by the API. This repo only shows them and sends the owner's edits.

## 2. How a request flows

- Signing in sets an **httpOnly cookie**. No token reaches page JavaScript or `localStorage`. The page calls this app's own `/api/*` routes (`app/api/*`), which add the token and call `cahyana-api` server to server (`lib/upstream.js`, `lib/passthrough.js`, `lib/session.js`, `lib/driverSession.js`). So there is no CORS between the page and its own routes.
- `proxy.js` only checks that a cookie exists and sends everyone else to `/login` or `/driver/login`. It is routing convenience, not the security boundary. **The API's own auth is the gate.** Never render anything sensitive into the HTML before that check.
- The owner cookie does not open `/driver`, and the driver cookie does not open `/`.
- Live chat uses a WebSocket ticket: `app/api/ws-ticket` swaps the cookie session for a single-use ticket, then the page connects to the API (`lib/chatSocket.js`). The API must allow this app's origin (`EXTRA_ORIGINS` or `ALLOW_VERCEL_PREVIEWS`), otherwise the socket is refused and the panels quietly fall back to polling.
- **Demo account**: a fixed demo sign-in answered inside this app (`lib/demo.js`, `lib/demoData.js`), never forwarded to the real API. Controlled by `DEMO_ENABLED`, `DEMO_USER`, `DEMO_PASS`.

## 3. Content edits

The Content panel edits the public site's text by committing JSON to the CUE repo through the API (`app/api/content`, allowlist and rules in `cahyana-api/content.js`). The dashboard writes data, never code. `EDIT-KONTEN.md` is the owner's guide (Indonesian). Locked fields (catalog keys, titles, images) cannot be edited here and must not be unlocked from this side: the API is the lock, this form is only the second layer.

## 4. Environment

Names only, never values: `CAHYANA_API` (the API address), `DEMO_ENABLED`, `DEMO_USER`, `DEMO_PASS`, and the build stamps `NEXT_PUBLIC_BUILD_ID`, `NEXT_PUBLIC_BUILD_SHA`, `NEXT_PUBLIC_BUILD_TIME`, `VERCEL_GIT_COMMIT_SHA`. Secrets live in Vercel environment variables, never in git.

## 5. Tests

- `npm run verify` runs `verify-dash2.mjs`. There are 13 `verify-*.mjs` browser harnesses at the repo root (dashboard, nav, PWA, driver, reviews, settings, promo, content, split views, mobile, update prompt, live chat). Most need `cahyana-api/tools/chat-dev-server.js` or `driver-dev-server.js` running locally and a build served on a port named at the top of each file.
- There is no unit-test folder and no lint setup. **UNKNOWN — ask Wayan** whether CI runs anything here.

## 6. Deploy

Vercel. Whether `main` deploys automatically and whether preview deployments are used is **UNKNOWN — ask Wayan** (no workflow file in the repo). The app shows an update prompt when a new build is live (`components/UpdatePrompt.jsx`, `app/api/build`).

## 7. Exceptions to global

| Global rule | What this repo does | Reason |
|---|---|---|
| Session in an httpOnly cookie, CSRF | httpOnly cookie, but no CSRF token | Same-origin calls only; whether `SameSite` and a CSRF check are enough is not reviewed. **UNKNOWN — ask Wayan** |
| Tests in `tests/` | `verify-*.mjs` at the repo root | Left in place, as in CUE. |
| Validate with Zod | No Zod in this repo | Validation happens in the API; forms only pre-check. |
| Syntax rules | Not audited in this repo | The audit covered CUE. Apply to touched code. |
