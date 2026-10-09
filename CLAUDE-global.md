# Global Rules (all Cahyana projects)

State of things now. No history. The master is `CLAUDE-global.md` in the `cahyanaui` repo; every repo holds an identical copy named `CLAUDE-global.md`, loaded by the first line of its own `CLAUDE.md` (`@CLAUDE-global.md`). Change the master first, then copy.
Project-specific facts (brand colours, copy, prices, feature logic) live in each project's own file.
**The project file overrides this file.** Every place a project deliberately differs is listed in its "Exceptions to global" section, with the reason.

**Scope:** these rules apply to new code and code you touch. Never refactor untouched code to match them unless asked.

## 0. Working rules

- `main` auto-deploys. Never push or merge to `main` unless Wayan says so. Work on a feature branch.
- Docs and code are separate work. One code task = one branch, one plan, Wayan's approval, tests before and after, one commit.
- Audit first, then fix. During an audit change nothing. Report: rule, hits/files, where most of it is, likely false positives or keep-as-is. Wait for approval.
- Delete nothing (files, endpoints, components, branches, folders) without Wayan's OK.
- Never invent a value, a claim or content. If it is not in the code or the project file, write `UNKNOWN — ask Wayan`.
- Code wins for what the system does. The file wins for what it should do. Report every gap. Never resolve one silently.
- Final decisions are Wayan's. Offer options with reasons.
- A rule that cannot be applied cleanly (for example a loop with `return`/`break`): list it separately, do it in its own work order.
- Do not start real payments. Wayan runs real-money tests himself.
- Finished-work report, always in this form: what changed, what was tested, what was not tested, what needs Wayan. Never claim a check that did not run.
- New feature or new site: walk Wayan through the checklist in section 8 and remind him of the small items he may forget.

## 1. Stack

- React + Next.js (App Router), Tailwind CSS, Zod, Framer Motion (`motion` package), Lucide, clsx.
- Multi-language sites: next-intl.
- Backend: Node + Express + PostgreSQL. What a backend actually uses is written in its project file. Do not assume Helmet, Zod, cookies or CSRF exist there.
- Not allowed: React Hook Form, shadcn/ui as a dependency (study its structure only).
- Before adding any new package: ask first, then check it is maintained, widely used and has no known security warnings.

## 2. Syntax

- Named function declarations (`function name() {}`), not arrow functions assigned to variables. Arrow functions stay for inline callbacks (`map`, `filter`, `forEach`) and short inline handlers (`onClick={() => {...}}`).
- Components: `export default function ComponentName()`.
- Template literals, never string concatenation with `+`. Skip false positives (a phone prefix, a CSS class string continued over lines).
- Array methods (`map`, `filter`, `reduce`, `find`, `some`, `forEach`) over `for` loops. `for...of` only when each item must `await` in sequence.
- Destructure props in the function signature. Plain dot access is fine for one simple value.
- Spread by default for copying and merging objects and arrays.
- `async`/`await`, never `.then()` chains. Exception: a fire-and-forget call that must not be awaited (for example sending an email): wrap it in an un-awaited async helper.
- `if`/`else`, never `switch`.
- Every `try` has a `catch`, and the error variable is always `e`.
- camelCase, descriptive names. No cryptic single letters (`el`, `dt`, `q`, `r`, `t`). Exception: `a`/`b` in `.sort()` comparators.
- Comments are one line, directly above the tricky line, and say why.
- A component with several props gets defaults (for example `included = []`) and a friendly fallback when data is missing ("Sorry, we could not load this information. Please try again.").

### API calls
- All API calls go through one fetch wrapper or service functions in `lib/`. No raw `fetch()` scattered in components.
- Every call handles its own error and shows a loading state.

## 3. Code Structure

### Folders
- `app/` pages and routes.
- `components/` all React components (layers below).
- `hooks/` React hooks.
- `lib/` pure helper functions. No React, no page logic.
- `content/` data (tours, prices, copy), JSON, with thin getters.
- `state/` what the user is currently doing (cart, trip plan, preferences).
- Business logic lives in `lib/`, never inside JSX.
- All guest-facing text is data, not literals in JSX: UI strings in `messages/<locale>/<area>.json`, long-form content in `content/`.

### Three layers
1. **Components** — smallest reusable pieces: button, price tag, input, image, card.
2. **Blocks** — assembled from components: navbar, footer, menu, booking form, section.
3. **Templates** — a full reusable page structure built from blocks. Every page of the same type reuses the same template (all articles use the article template).

Pages arrange a template with content. A new page of an existing type never rebuilds the template. A layer never imports upwards. "Layout" means Next's `layout.jsx` only.

### One file per component
- A component's JSX and its Tailwind classes live together in one file, so opening that file shows everything about it. No separate class-constants file for one component.
- Long class strings are named constants at the top of the same file, so the JSX stays readable.
- A style used by 2+ components becomes its own component (button, field, label) in its own file with its classes. Only when it is not a UI piece does it go in one shared module named for its role.
- Do not split a component across files unless its logic is reused elsewhere.

### Naming
- PascalCase for component, block and template files (`BookingForm.jsx`).
- camelCase for helper files in `lib/` (`formatPrice.js`).

### Size (a signal, not a limit)
- Component about 200–250 lines, block about 300. Data files are excluded.
- A longer file is acceptable when it is one component. Wayan decides, so never split a file only to reduce its line count.
- Real split signal: the file handles more than one clearly separate piece of UI or logic. Then stop and ask.

## 4. UI Global (how it looks)

### Scales, never raw numbers
- Every project defines fixed scales up front: font size, font weight, spacing, border radius, shadow, icon size, motion timing, container width, breakpoints.
- Every component picks from a scale. A value that fits no step snaps to the nearest step. No one-off numbers.
- One font family by default (Inter), headings and body. A second only with a deliberate reason.
- One page gutter value for mobile, one for desktop, applied everywhere.
- Icon-to-text and icon-to-icon gaps come from the spacing scale.
- A new project picks a small set of breakpoints up front and records it in its project file.

### Default scales (mirrored from CUE `app/globals.css`; override per project)
- Font sizes: display 28–40px fluid, h2 18px, h3 and strong 14px, body and field and small 12.8px, label 10.24px. Line height body 1.6, heading 1.15.
- Weights, four jobs: 400 body, 500 labels and section titles, 600 buttons, prices, card titles, strong and active states, 700 page H1 only.
- Radius: 8 / 12 / 16 / 22 / pill (999).
- Spacing: 8 / 16 / 24 / 32 / 48 / 64, section gap 36.
- Container: 1200 wide, 1080 mid, 720 reading column.
- Gutter: 16px mobile, 24px desktop.
- Icons: 16 / 20 / 24, from Lucide with an explicit size class.
- Motion: 0.15s fast, 0.2s base, 0.3s slow. Ease `cubic-bezier(.4,0,.2,1)`, entrance ease-out `cubic-bezier(.16,1,.3,1)`.
- Shadow: one card shadow token plus a focus ring. Nothing else casts a shadow.

### Rules
- Interactive elements share one hover, pressed, disabled and focus treatment.
- **Feedback is colour only.** Hover, pressed and selected states change colour, background or border. Never size, scale, weight or position. No photo zoom on hover. Cards do not move.
- Focus rings stay visible. Contrast stays readable. Keyboard navigation works everywhere.
- No native browser UI: no default scrollbars, no native `<select>`, date picker, checkbox, radio, tooltip, `alert()` or `confirm()`. Build custom styled versions.
- Uppercase text only for the hero kicker and Popular/Selected badges. Every other label is sentence case.
- Enter and exit (mount and unmount) animations use Framer Motion. Hover, pressed and colour states are CSS transitions. Both use the shared timing tokens.
- With no design provided for something new, look at shadcn/ui or Flowbite for structure first, adapt to the project's tokens, deviate only when told.

## 5. UX Global (how it behaves)

- **No silent dead ends.** Every action gives clear feedback. If the problem is fixable (no account yet), say so and link to the fix.
- **Popup scroll lock.** While any popup, modal, dropdown or sheet is open, the page behind cannot scroll. A popup opened on top of another must not release the lock of the one underneath.
- **No auto-zoom on input focus (mobile).** Fields at 16px or more, or, when fields are under 16px, the iOS zoom-prevention clamp: `maximum-scale=1` on iPhone and iPad only. Android keeps pinch-zoom. Never `user-scalable=no`.
- **Loading states.** Anything that takes time shows a visible loading state.
- **Empty states.** Say why it is empty and point to an action.
- **Error and offline states.** Clear message, never a blank screen or a cryptic error. Offline gets its own plain message.
- **Confirm destructive actions** before they run. They look different from safe ones and sit apart from the main action.
- **Instant tap feedback** within about 100ms on every tappable element (colour only, see section 4).
- **Do not lose progress.** Interrupted forms, filters and choices restore when the user returns.
- **Breadcrumbs** on every page below the homepage.
- **Legal text matches reality.** Privacy and cookie text must describe what the site actually does (analytics, cookies, third parties).

## 6. Security

These are the rules for new and touched code. Each project file says which of them are implemented today.

- **Ownership checks on the server, every request.** Logged in is not enough. Check the item belongs to the requester (bookings, My Trips, payments, account settings). Admin edits check admin rights.
- **Authentication and authorization are separate checks.** Who you are, then what you may do.
- **Validate on both sides.** Browser for speed (Zod on the frontend), server for safety. Server validation runs before anything is written, and a refused request leaves nothing behind. The server's validation library is named in its project file.
- **Secrets only in server environment variables.** Never in frontend code, never in git. Test fixtures never use values copied from a real dashboard.
- **Rate limit every public endpoint**, one bucket per route group.
- **Price comes from the server catalog.** Never trust a price sent by the browser. Recalculate before charging.
- **Log every payment event** (who, when, how much, result).
- **Sanitize** guest-typed text before it is displayed to anyone else. Never inject guest text as HTML.
- **Sessions expire.** Passwords are hashed, never plain text. Where the session token is stored is decided per project and written in its project file. A cookie session must be httpOnly, SameSite, and protected against CSRF. A Bearer-header session means XSS is the risk, so sanitize.
- **Security headers** on every response (Helmet on Express). The project file says whether they are in place.
- **Error messages to the browser never carry internals** (table names, hosts, stack traces).
- **Endpoint lock check.** For every new endpoint, say explicitly whether it needs login and/or an ownership check, lock it, and confirm that before calling the feature done. Never leave one open by omission.

## 7. Testing

- **Run it yourself.** After finishing a feature, run its matching test before saying done. Never wait to be asked.
- **Location.** New tests live in `tests/`, named `verify-<feature>.mjs` (browser) or `<feature>-test.js` (node). Existing tests stay where the project file says. Every test is committed. A test that lives only in a session scratchpad is lost.
- **Header.** Each test file says at the top how to run it, which build and servers it needs, and uses no absolute home-directory paths.
- **A test must be proven to fail.** Reintroduce the real bug, confirm the test turns red, restore. A test that stays green on the bug is broken. If a sabotage triggers fewer failures than expected, check the test before adding more.
- **Mocking boundary.** Fake simple data (prices, catalog responses). Never fake real connections, timing or ordering (WebSocket, reconnects, payment flow): test those against the real local server.
- **Check the rendered result.** Assert real measured values in the browser (size, colour, position, `getComputedStyle`), not class names. Reject empty or zero-size elements as a broken test.
- **No vacuous passes.** Assert the page answered HTTP 200 and at least one real element was measured. Do not assert a number you just set yourself. A test that crashes counts as a failure.
- **Reports:** say what ran and what the result was.

## 8. Setup Essentials (every new project, day one, and the QA checklist for every new feature or site)

Claude Code flags any missing item at the end of the first build and reminds the owner about items that need his accounts.

### Basics
- Favicon and tab icon set.
- Custom 404 page.
- HTTPS enforced.
- Environment variables separated for development and production.
- Performance baseline: compressed, correctly sized images (width and height set, WebP), efficient font loading.
- Accessibility baseline: alt text, contrast, keyboard navigation.
- PWA manifest (name, icons, add to home screen).
- Tested on Safari, not only Chrome.
- Image fallback (placeholder or skeleton, never a broken image icon).
- Cookie consent notice if analytics or tracking is used.
- Legal pages: privacy policy, terms, refund/cancellation policy.
- Payment flow works end to end and matches CUE.
- No placeholder content left live (phone numbers, dummy reviews, wrong brand name, `href="#"` links).
- Backup and rollback plan before risky deploys.
- Uptime monitoring that alerts the owner.
- **Reminder to the owner:** install the Google Analytics code, and submit the site to Google Search Console.

### SEO
- Unique title and meta description per page.
- Open Graph tags (image, title, description) so links preview correctly on WhatsApp and social.
- Schema markup (JSON-LD).
- `sitemap.xml` and `robots.txt`.
- Canonical tags.
- Alt text on every image.
- One H1 per page, logical H2/H3, no skipped levels, no headings used for size.
- Semantic HTML (`nav`, `article`, `button`, not `div` for everything).
- `hreflang` for multi-language sites (language and region). Not for currencies.

### GEO (AI search visibility)
- `robots.txt` allows GPTBot, PerplexityBot and the Google-Extended token.
- Content is server-rendered, not hidden behind client-only JavaScript.
- Open each page or article with a direct answer to its main question in the first couple hundred words.
- Specific, complete schema: FAQ, review/rating, organization/business with real address and contact.
- Consistent entity naming: business, tour and villa names written identically everywhere.
- Internal links between related pages (tours to guides, guides to tours).
- An About/Facts page with plain, quotable statements (service areas, years operating, what makes the business different).
