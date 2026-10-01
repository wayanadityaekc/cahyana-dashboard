import { readFileSync } from 'node:fs';
import { chromium } from '/home/user/CUE/node_modules/playwright-core/index.mjs';
import pgmod from '/home/user/cahyana-api/node_modules/pg/lib/index.js';

// DASHBOARD BRIEF #8: the split into a tiles home page, a tours dashboard (/cue)
// and a villas dashboard (/villas), plus driver ratings (Part 2), end to end
// against the REAL cahyana-api on a REAL throwaway Postgres:
//
//   cd ../cahyana-api && PG_URL_FILE=/tmp/pgurl.txt PUSH_LOG=/tmp/p.jsonl node tools/driver-dev-server.js   (4598)
//   CAHYANA_API=http://127.0.0.1:4598/api DEMO_ENABLED=true DEMO_USER=demo DEMO_PASS=demo npx next start -p 3102
//   PG_URL_FILE=/tmp/pgurl.txt node verify-split.mjs
//
// RESTART BOTH before every run (sign-in is rate limited; drivers are created fresh).
const DASH = process.env.DASH || 'http://localhost:3102';
const API = process.env.API || 'http://127.0.0.1:4598/api';
const PG_URL = readFileSync(process.env.PG_URL_FILE || '/tmp/pgurl.txt', 'utf8').trim();
const BASIC = 'Basic ' + Buffer.from('owner:pw').toString('base64');

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log('  FAIL:', m)); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = async (path, body) => {
  const r = await fetch(API + path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', Authorization: BASIC }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, json: await r.json().catch(() => ({})) };
};
const body = (page) => page.locator('body').innerText();
const errs = [];

const db = new pgmod.Pool({ connectionString: PG_URL, ssl: { rejectUnauthorized: false } });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

// ---- fixtures through the real API ----
const made = (await api('/admin/drivers', { name: 'Made', phone: '+62 812 1', username: 'made', password: 'made-pass-1' })).json;
const wayan = (await api('/admin/drivers', { name: 'Wayan', phone: '+62 812 2', username: 'wayan', password: 'wayan-pass-1' })).json;
const disp = (await api('/admin/dispatch')).json;
const rowsOf = (ref) => disp.rows.filter((r) => r.ref === ref).map((r) => r.id);
await api('/admin/dispatch', { rows: rowsOf('CUE-901'), driverId: made.id });
const rv = (ref, service, rating, status, msg) => db.query(
  "INSERT INTO reviews (booking_ref, name, service, rating, message, status) VALUES ($1,'Secret Guest',$2,$3,$4,$5)",
  [ref, service, rating, msg, status],
);
await rv('CUE-901', 'Ubud Tour', 5, 'approved', 'WORDS-ONLY-OWNER-SEES-1');
await rv('CUE-901', 'Kecak Dance', 3, 'approved', 'WORDS-ONLY-OWNER-SEES-2');
await rv('CUE-920', 'Cahyana House', 5, 'approved', 'VILLA-REVIEW-WORDS');

// ===== 1. owner signs in: tiles =====
let OWNER;
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push('tiles: ' + e.message));
  await page.goto(DASH + '/login', { waitUntil: 'networkidle' });
  await page.fill('#adm-user', 'owner'); await page.fill('#adm-pass', 'pw'); await page.click('button[type=submit]');
  const landed = await page.waitForURL((u) => new URL(u).pathname === '/', { timeout: 20000 }).then(() => true).catch(() => false);
  if (!landed) { console.log('  FAIL: owner sign-in (restart both servers)'); process.exit(1); }
  OWNER = await ctx.storageState();
  await page.locator('[data-landing]').waitFor({ timeout: 8000 });
  await page.waitForFunction(() => [...document.querySelectorAll('[data-tile-fact]')].every((e) => !/Loading/.test(e.textContent)), null, { timeout: 8000 }).catch(() => {});
  ok(await page.locator('[data-tile]').count() === 2, 'home page does not have exactly two tiles');
  const t = await page.locator('[data-tile]').evaluateAll((els) => els.map((e) => ({ id: e.dataset.tile, href: e.getAttribute('href'), text: e.innerText })));
  ok(t[0].href === '/cue' && /Cahyana Ubud Experience/.test(t[0].text), `CUE tile ${JSON.stringify(t[0])}`);
  ok(t[1].href === '/villas' && /Ubud Private Villas/.test(t[1].text), `villas tile ${JSON.stringify(t[1])}`);
  // CUE: 3 upcoming bookings with tour lines (901, 902, 920's tour) ; villas: 920 + 921
  ok(/4\D+upcoming/.test(t[0].text), `CUE tile number (901, 902, pending 903 and 920 count as upcoming): ${t[0].text.replace(/\n/g, ' ')}`);
  ok(/2 upcoming stays/.test(t[1].text), `villa tile number: ${t[1].text.replace(/\n/g, ' ')}`);
  ok(!/Rp|CUE-9|Szabo|Hanna/.test(await body(page)), 'the home page shows a booking, price or guest');
  await page.click('[data-tile="villas"]');
  await page.waitForURL((u) => new URL(u).pathname === '/villas');
  await page.goBack();
  await page.click('[data-tile="cue"]');
  await page.waitForURL((u) => new URL(u).pathname === '/cue');
  await ctx.close();
}

// ===== 2. old links =====
{
  const ctx = await b.newContext({ storageState: OWNER });
  const page = await ctx.newPage();
  for (const [from, to] of [['/?tab=dispatch', '/cue'], ['/?tab=chat', '/cue'], ['/?tab=settings', '/cue']]) {
    await page.goto(DASH + from, { waitUntil: 'networkidle' });
    ok(new URL(page.url()).pathname === to, `${from} went to ${page.url()}`);
  }
  await page.goto(DASH + '/?tab=dispatch', { waitUntil: 'networkidle' });
  await page.locator('[data-dispatch]').waitFor({ timeout: 8000 }).catch(() => {});
  ok(await page.locator('[data-dispatch]').count() === 1, 'the old push link did not open Dispatch');
  for (const evil of ['/?tab=//evil.example', '/?tab=https://evil.example', '/?tab=nonsense', '/?tab=../villas']) {
    await page.goto(DASH + evil, { waitUntil: 'networkidle' });
    ok(new URL(page.url()).origin === DASH && new URL(page.url()).pathname === '/', `${evil} was followed to ${page.url()}`);
  }
  await ctx.close();
}

// ===== 3. tours dashboard: tour lines only =====
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, storageState: OWNER });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push('cue: ' + e.message));
  await page.goto(DASH + '/cue', { waitUntil: 'networkidle' });
  await page.locator('aside button', { hasText: 'Upcoming' }).first().click();
  await page.waitForFunction(() => /CUE-901/.test(document.body.innerText), null, { timeout: 8000 }).catch(() => {});
  const txt = await body(page);
  ok(/CUE-901/.test(txt) && /CUE-920/.test(txt), 'tours dashboard misses a booking with tour lines');
  ok(!/CUE-921/.test(txt), 'a villa-only booking is on the tours dashboard');
  ok(!/Cahyana House|Cahyana Tibuah/.test(txt), 'a villa line is on the tours dashboard');
  const card920 = page.locator('article', { hasText: 'CUE-920' });
  ok(/Ubud Tour/.test(await card920.innerText()), 'the tour line of the bundle is missing');
  ok(await card920.locator('[data-bundle]').count() === 1 && await card920.locator('[data-bundle-link]').getAttribute('href') === '/villas', 'bundle note/link to Villas missing on the tours side');
  ok(await page.locator('article', { hasText: 'CUE-901' }).locator('[data-bundle]').count() === 0, 'a plain tour booking has a bundle note');
  // prices
  await page.locator('aside button', { hasText: 'Prices' }).first().click();
  await page.waitForFunction(() => /Ubud Tour/.test(document.body.innerText), null, { timeout: 8000 }).catch(() => {});
  ok(!/Cahyana House|Cahyana Tibuah/.test(await body(page)), 'villa prices are in the tours price list');
  // reviews: the villa review is not listed
  await page.locator('aside button', { hasText: 'Reviews' }).first().click();
  await page.waitForFunction(() => /WORDS-ONLY-OWNER-SEES-1/.test(document.body.innerText), null, { timeout: 8000 }).catch(() => {});
  const rt = await body(page);
  ok(/WORDS-ONLY-OWNER-SEES-1/.test(rt), 'tour reviews missing from the tours Reviews list');
  ok(!/VILLA-REVIEW-WORDS/.test(rt), 'a villa review is in the tours Reviews list');
  // switcher
  const sw = await page.locator('[data-dash-switch] a').evaluateAll((els) => els.map((e) => [e.textContent, e.getAttribute('href'), e.getAttribute('aria-current')]));
  ok(JSON.stringify(sw) === JSON.stringify([['Tours', '/cue', 'page'], ['Villas', '/villas', null]]), `switcher ${JSON.stringify(sw)}`);
  // dispatch ratings (Part 2)
  await page.locator('aside button', { hasText: 'Dispatch' }).first().click();
  await page.locator('[data-dispatch]').waitFor({ timeout: 8000 });
  await page.locator('[data-filter="all"]').click();
  const opts = await page.locator('[data-dispatch-group="CUE-902"] [data-group-driver] option').allInnerTexts();
  ok(opts.includes('Made - 4.0 (2 reviews)'), `Dispatch picker shows ${JSON.stringify(opts)}`);
  ok(opts.includes('Wayan - No reviews yet'), `a driver with no reviews should read "No reviews yet": ${JSON.stringify(opts)}`);
  ok(/4\.0 \(2 reviews\)/.test(await page.locator('[data-dispatch-group="CUE-901"] [data-row-rating]').first().innerText()), 'assigned row does not show its driver\'s rating');
  ok(!/Cahyana House|CUE-921/.test(await page.locator('[data-dispatch]').innerText()), 'a villa line is in Dispatch');
  // Drivers list: NO ratings (Wayan #8 Q5)
  await page.locator('aside button', { hasText: 'Drivers' }).first().click();
  await page.locator('[data-drivers]').waitFor({ timeout: 8000 });
  await page.waitForFunction(() => document.querySelectorAll('[data-driver]').length === 2, null, { timeout: 8000 }).catch(() => {});
  ok(!/review|4\.0|No reviews/i.test(await page.locator('[data-driver]').first().innerText()) && !/review|4\.0/i.test(await page.locator('[data-driver]').nth(1).innerText()), 'the Drivers list shows ratings');
  await ctx.close();
}

// ===== 4. villas dashboard =====
for (const w of [1280, 390]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 844 }, storageState: OWNER });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(`villas ${w}: ${e.message}`));
  await page.goto(DASH + '/villas', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => /CUE-920/.test(document.body.innerText), null, { timeout: 8000 }).catch(() => {});
  const txt = await body(page);
  ok(/CUE-920/.test(txt) && /CUE-921/.test(txt), `${w}: villa stays missing`);
  ok(!/CUE-901|CUE-902|Kecak|Airport/.test(txt), `${w}: a tour booking is on the villas dashboard`);
  const card = page.locator('article', { hasText: 'CUE-920' });
  const ct = await card.innerText();
  ok(/Cahyana House/.test(ct) && !/Ubud Tour/.test(ct), `${w}: the bundle card shows ${/Ubud Tour/.test(ct) ? 'the tour line' : 'no villa line'}`);
  ok(await card.locator('[data-bundle-link]').getAttribute('href') === '/cue', `${w}: bundle link to the tours dashboard`);
  ok(await page.locator('[data-nav-chat]').count() === 0, `${w}: villas has a chat icon (there is no villa chat)`);
  ok(await page.locator('[data-dash-switch]').count() === 1, `${w}: switcher element missing`);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok(over <= 0, `${w}: overflows by ${over}px`);

  const open = async (id, label) => {
    if (w <= 992) { await page.click('#hamburger'); await sleep(350); await page.click(`[data-drawer-row="${id}"]`); }
    else await page.locator('aside button', { hasText: label }).first().click();
  };
  // prices
  await open('prices', 'Prices');
  await page.waitForFunction(() => /Cahyana House/.test(document.body.innerText), null, { timeout: 8000 }).catch(() => {});
  const pt = await body(page);
  ok(/Cahyana House/.test(pt) && /Cahyana Tibuah/.test(pt) && !/Ubud Tour|Kecak|Airport/.test(pt), `${w}: villa price list ${/Ubud Tour/.test(pt) ? 'has tours' : 'is missing villas'}`);
  // calendar: no Airbnb link in this environment, and it must SAY so
  await open('calendar', 'Calendar');
  await page.locator('[data-villa-calendar]').waitFor({ timeout: 8000 });
  await page.waitForFunction(() => document.querySelectorAll('[data-villa-cal]').length === 2, null, { timeout: 8000 }).catch(() => {});
  ok(await page.locator('[data-villa-cal]').count() === 2, `${w}: calendar shows ${await page.locator('[data-villa-cal]').count()} villas`);
  const states = await page.locator('[data-cal-state]').allInnerTexts();
  ok(states.length === 2 && states.every((s) => /not readable/i.test(s)), `${w}: an unreadable calendar is not flagged: ${JSON.stringify(states)}`);
  ok(/No Airbnb link is set/.test(await body(page)) && !/No taken nights/.test(await body(page)), `${w}: an unknown calendar reads as empty`);
  ok(!/https?:\/\/[^ ]*airbnb/i.test(await body(page)), `${w}: an Airbnb link is on the page`);
  // placeholders
  for (const [id, label, title] of [['discounts', 'Discounts', 'Villa discounts'], ['ratings', 'Ratings', 'Villa ratings']]) {
    await open(id, label);
    const ph = page.locator(`[data-coming-soon="${title}"]`);
    await ph.waitFor({ timeout: 8000 });
    ok(/Not switched on/.test(await ph.innerText()), `${w}: ${title} does not say it is off`);
    ok(await ph.locator('input, select, textarea, button, form').count() === 0, `${w}: ${title} has controls that pretend to work`);
    ok(!/\d+\s*%|Rp\s*\d|[1-5]\.\d/.test(await ph.innerText()), `${w}: ${title} shows a made-up number`);
  }
  // settings still works from here
  await open('settings', 'Settings');
  ok(await page.locator('[data-settings]').first().waitFor({ timeout: 8000 }).then(() => true).catch(() => false), `${w}: Settings does not open on Villas`);
  if (w <= 992) {
    await page.click('#hamburger'); await sleep(350);
    const dd = await page.locator('[data-drawer-dash]').evaluateAll((els) => els.map((e) => [e.dataset.drawerDash, e.getAttribute('href')]));
    ok(JSON.stringify(dd) === JSON.stringify([['cue', '/cue'], ['villas', '/villas']]), `${w}: drawer dashboards ${JSON.stringify(dd)}`);
  }
  await ctx.close();
}

// ===== 5. same shell on both: header and tab bar measure the same =====
for (const w of [390, 1280]) {
  const shape = async (url) => {
    const ctx = await b.newContext({ viewport: { width: w, height: 844 }, storageState: OWNER });
    const page = await ctx.newPage();
    await page.goto(DASH + url, { waitUntil: 'networkidle' });
    await sleep(500);
    const s = await page.evaluate(() => {
      const r = (el) => { if (!el) return null; const x = el.getBoundingClientRect(); return [Math.round(x.height), Math.round(x.left)]; };
      const bar = document.querySelector('nav[aria-label="Sections"]');
      return { header: r(document.querySelector('[data-navbar]')), bar: bar && getComputedStyle(bar).display !== 'none' ? r(bar) : null, h1: getComputedStyle(document.querySelector('h1')).fontSize };
    });
    await ctx.close();
    return s;
  };
  const a = await shape('/cue?tab=upcoming');
  const v = await shape('/villas');
  ok(JSON.stringify(a.header) === JSON.stringify(v.header), `${w}: header ${v.header} (villas) vs ${a.header} (tours)`);
  ok(JSON.stringify(a.bar) === JSON.stringify(v.bar), `${w}: tab bar ${v.bar} vs ${a.bar}`);
  ok(a.h1 === v.h1, `${w}: h1 ${v.h1} vs ${a.h1}`);
  const ctx = await b.newContext({ viewport: { width: w, height: 844 }, storageState: OWNER });
  const page = await ctx.newPage();
  await page.goto(DASH + '/', { waitUntil: 'networkidle' });
  await sleep(500);
  ok(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth) <= 0, `${w}: home page overflows`);
  await ctx.close();
}

// ===== 6. the driver sees stars + tour only =====
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => { try { sessionStorage.setItem('cahyana_driver_push_later', '1'); } catch {} });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push('driver: ' + e.message));
  await page.goto(DASH + '/driver/login', { waitUntil: 'networkidle' });
  await page.fill('#drv-user', 'made'); await page.fill('#drv-pass', 'made-pass-1'); await page.click('button[type=submit]');
  await page.waitForURL((u) => new URL(u).pathname === '/driver', { timeout: 15000 });
  await page.goto(DASH + '/driver?tab=earnings', { waitUntil: 'networkidle' });
  await page.locator('[data-driver-reviews]').waitFor({ timeout: 8000 });
  const sum = await page.locator('[data-rev-summary]').innerText();
  ok(/4\.0 from 2 reviews/.test(sum), `driver summary "${sum}"`);
  ok(await page.locator('[data-rev]').count() === 2, 'driver should see exactly 2 reviews');
  const all = await page.locator('[data-driver-reviews]').innerText();
  ok(/Ubud Tour/.test(all) && /Kecak Dance/.test(all) && /5\/5/.test(all) && /3\/5/.test(all), `stars/tour missing: ${all.replace(/\n/g, ' | ')}`);
  ok(!/WORDS-ONLY-OWNER|Secret Guest|CUE-9/.test(await page.content()), 'a guest\'s words, name or booking ref reached the driver page');
  ok(!/WORDS-ONLY-OWNER|Secret Guest/.test(await (await page.request.get(DASH + '/api/driver/reviews')).text()), 'the driver reviews API carries guest text');
  ok(/whole day/.test(all), 'the driver page does not say it is a review of the whole tour');
  ok(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth) <= 0, 'driver earnings overflows');
  // Wayan: no reviews yet
  const ctx2 = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx2.addInitScript(() => { try { sessionStorage.setItem('cahyana_driver_push_later', '1'); } catch {} });
  const p2 = await ctx2.newPage();
  await p2.goto(DASH + '/driver/login', { waitUntil: 'networkidle' });
  await p2.fill('#drv-user', 'wayan'); await p2.fill('#drv-pass', 'wayan-pass-1'); await p2.click('button[type=submit]');
  await p2.waitForURL((u) => new URL(u).pathname === '/driver', { timeout: 15000 });
  await p2.goto(DASH + '/driver?tab=earnings', { waitUntil: 'networkidle' });
  await p2.locator('[data-rev-empty]').waitFor({ timeout: 8000 });
  ok(await p2.locator('[data-rev]').count() === 0, 'a driver with no reviews sees reviews');
  await ctx2.close();
  await ctx.close();
}

// ===== 7. the demo =====
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push('demo: ' + e.message));
  await page.goto(DASH + '/login', { waitUntil: 'networkidle' });
  await page.fill('#adm-user', 'demo'); await page.fill('#adm-pass', 'demo'); await page.click('button[type=submit]');
  await page.waitForURL((u) => new URL(u).pathname === '/', { timeout: 15000 }).catch(() => {});
  await page.locator('[data-landing]').waitFor({ timeout: 8000 }).catch(() => {});
  await page.waitForFunction(() => [...document.querySelectorAll('[data-tile-fact]')].every((e) => !/Loading/.test(e.textContent)), null, { timeout: 8000 }).catch(() => {});
  ok(/0 upcoming stays/.test(await page.locator('[data-tile="villas"]').innerText().catch(() => '')), 'demo villa tile should read 0 upcoming stays');
  await page.goto(DASH + '/villas', { waitUntil: 'networkidle' });
  ok(/Nothing here/.test(await body(page)), 'demo villas should be empty, not full of tour bookings');
  await page.goto(DASH + '/cue', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => /Sample Guest/.test(document.body.innerText), null, { timeout: 8000 }).catch(() => {});
  ok(/Sample Guest/.test(await body(page)), 'demo tours dashboard lost its sample data');
  await ctx.close();
}

ok(errs.length === 0, `page errors: ${errs.join(' | ')}`);
await db.end();
await b.close();
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
