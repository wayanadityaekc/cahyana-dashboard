#!/usr/bin/env node
// The owner's Coins screens: the Coins panel (rules, villa perks, guest lookup and
// adjust), the coin block on a booking card (rows, "Covered by coin" notes,
// Refund coins, Redeem perk), the owner-only door, and the demo.
//
// Run (from the repo root, after `npm run build`):
//   node tests/verify-coins-dash.mjs
//   SHOTS=/some/dir node tests/verify-coins-dash.mjs   (also writes dash-*.png there)
//
// Needs: the build in .next, playwright-core (a devDependency) and a Chromium at
// PW_BIN (default: the headless shell under /opt/pw-browsers). It starts its own
// stub of the cahyana-api coin and booking endpoints (in this process, port
// STUB_PORT, default 4611) and its own `next start` (port DASH_PORT, default 3111)
// pointed at it, so no real API, database or payment is touched. The stub fakes
// data only; the dashboard routes, cookies and proxying under test are the real ones.
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STUB_PORT = Number(process.env.STUB_PORT || 4611);
const DASH_PORT = Number(process.env.DASH_PORT || 3111);
const DASH = `http://127.0.0.1:${DASH_PORT}`;
const PW_BIN = process.env.PW_BIN || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const SHOTS = process.env.SHOTS || '';
const TOKEN = 'stub-admin-token';

let passed = 0;
let failed = 0;
function ok(cond, msg) {
  if (cond) passed += 1;
  else { failed += 1; console.log(`  FAIL: ${msg}`); }
}

// ---- stub cahyana-api -------------------------------------------------------
const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
const stub = {
  calls: [],
  earn: { villa: 1, tour: 2, experience: 2, transfer: 2, charter: 2 },
  pct: { tour: 5, experience: 5, transfer: 5, charter: 5, villa: 5 },
  menu: [
    { id: 1, property: 'Cahyana House', item_label: 'Breakfast for two', coin_cost: 2, active: true, service_id: null },
    { id: 2, property: 'Cahyana House', item_label: 'Airport pick-up', coin_cost: 4, active: true, service_id: null },
    { id: 3, property: 'Cahyana Tibuah', item_label: 'Late check-out', coin_cost: 1, active: true, service_id: null },
  ],
  ledger: [
    { email: 'amelia@example.com', delta: 4, source: 'cue_booking', ref: 'CUE-501', status: 'posted', note: null, date: day(-20), expires: day(1000) },
    { email: 'amelia@example.com', delta: 3, source: 'villa_night', ref: 'UPV-AB12CD', status: 'posted', note: null, date: day(-2), expires: day(1093) },
    { email: 'amelia@example.com', delta: -2, source: 'villa_perk', ref: 'UPV-AB12CD', status: 'posted', note: 'Covered by coin: Breakfast for two', date: day(-2), expires: null },
  ],
};
function balanceOf(email) {
  return stub.ledger.filter((row) => row.email === email && ['held', 'posted'].includes(row.status)).reduce((sum, row) => sum + row.delta, 0);
}
function summary(email) {
  const mine = stub.ledger.filter((row) => row.email === email);
  return { balance: balanceOf(email), nextExpiry: { date: day(1000), coins: 4 }, history: [...mine].reverse().map(({ delta, source, ref, status, date, expires }) => ({ delta, source, ref, status, date, expires })) };
}
const villaGroup = {
  ref: 'UPV-AB12CD', id: 7001, name: 'Sample Guest (Amelia R.)', phone: '+61 400 000 000', email: 'amelia@example.com', guests: 2,
  status: 'paid', payment: { option: 'full', currency: 'IDR', amountDisplay: 4500000, status: 'paid' },
  lines: [{ dayNo: 1, type: 'villa', service: 'Cahyana House', date: day(5), time: null, pickup: null, dropoff: null, items: `Check-out ${day(8)} (3 nights); Covered by coin: Airport pick-up` }],
  firstDate: day(5), lastDate: day(8),
};
const cueGroup = {
  ref: 'CUE-501', id: 7002, name: 'Sample Guest (Amelia R.)', phone: '+61 400 000 000', email: 'amelia@example.com', guests: 2,
  status: 'paid', payment: { option: 'full', currency: 'USD', amountDisplay: 40, status: 'paid' },
  lines: [{ dayNo: 1, type: 'tour', service: 'Ubud Tour', date: day(3), time: '08:30', pickup: 'Ubud', dropoff: null, items: null }],
  firstDate: day(3), lastDate: day(3),
};

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  let raw = '';
  req.on('data', (chunk) => { raw += chunk; });
  req.on('end', () => {
    const url = new URL(req.url, 'http://stub');
    const body = raw ? JSON.parse(raw) : {};
    const route = `${req.method} ${url.pathname}`;
    stub.calls.push({ route, body, query: Object.fromEntries(url.searchParams) });

    if (route === 'POST /api/admin/login') {
      if (body.user === 'owner' && body.pass === 'pw') return send(res, 200, { status: 'ok', token: TOKEN });
      return send(res, 401, { status: 'error', detail: 'Bad credentials' });
    }
    if (req.headers.authorization !== `Bearer ${TOKEN}`) return send(res, 401, { status: 'error', detail: 'Unauthorized' });

    if (route === 'GET /api/admin/bookings') {
      const scope = url.searchParams.get('scope');
      return send(res, 200, { today: day(0), attention: [], upcoming: scope === 'villa' ? [villaGroup] : [cueGroup], past: [], undated: [] });
    }
    if (route === 'GET /api/admin/coins/rules') return send(res, 200, { status: 'ok', earn: stub.earn, pct: stub.pct, menu: stub.menu });
    if (route === 'POST /api/admin/coins/rules') {
      stub.earn = { ...stub.earn, ...body.earn };
      stub.pct = { ...stub.pct, ...body.pct };
      return send(res, 200, { status: 'ok', earn: stub.earn, pct: stub.pct });
    }
    if (route === 'POST /api/admin/coins/menu') {
      const item = { id: body.id || stub.menu.length + 1, property: body.property, item_label: body.label, coin_cost: body.coins, active: body.active !== false, service_id: body.serviceId || null };
      stub.menu = body.id ? stub.menu.map((row) => (row.id === body.id ? item : row)) : [...stub.menu, item];
      return send(res, 200, { status: 'ok', item });
    }
    if (route === 'GET /api/admin/coins/account') {
      const email = url.searchParams.get('email');
      if (email !== 'amelia@example.com') return send(res, 404, { status: 'error', detail: 'No account with that email' });
      return send(res, 200, { status: 'ok', account: { id: 1, email }, ...summary(email) });
    }
    if (route === 'POST /api/admin/coins/adjust') {
      if (body.delta < 0 && balanceOf(body.email) + body.delta < 0) return send(res, 409, { status: 'error', detail: 'Not enough coins', balance: balanceOf(body.email) });
      stub.ledger.push({ email: body.email, delta: body.delta, source: 'adjust', ref: null, status: 'posted', note: body.note, date: day(0), expires: null });
      return send(res, 200, { status: 'ok', ...summary(body.email) });
    }
    if (route.startsWith('GET /api/admin/coins/booking/')) {
      const ref = decodeURIComponent(url.pathname.split('/').pop());
      return send(res, 200, { status: 'ok', ref, rows: stub.ledger.filter((row) => row.ref === ref).map(({ delta, source, status, note }) => ({ delta, source, status, note })) });
    }
    if (route === 'POST /api/admin/coins/redeem') {
      const item = stub.menu.find((row) => row.id === body.itemId);
      const note = `Covered by coin: ${item.item_label}`;
      stub.ledger.push({ email: 'amelia@example.com', delta: -item.coin_cost, source: 'villa_perk', ref: body.ref, status: 'posted', note, date: day(0), expires: null });
      return send(res, 200, { status: 'ok', ok: true, note, balance: balanceOf('amelia@example.com') });
    }
    if (route === 'POST /api/admin/coins/reverse') {
      let reversed = 0;
      let returned = 0;
      stub.ledger = stub.ledger.map((row) => {
        if (row.ref !== body.ref) return row;
        if (row.delta > 0 && row.status === 'posted') { reversed += 1; return { ...row, status: 'reversed', note: body.note }; }
        if (row.delta < 0 && ['held', 'posted'].includes(row.status)) { returned += 1; return { ...row, status: 'released', note: body.note }; }
        return row;
      });
      return send(res, 200, { status: 'ok', reversed, returned });
    }
    // Anything else the dashboard polls (chats, dispatch): an empty answer.
    return send(res, 200, { status: 'ok', threads: [], rows: [], drivers: [] });
  });
});
await new Promise((resolve) => server.listen(STUB_PORT, '127.0.0.1', resolve));

// ---- the dashboard ----------------------------------------------------------
const next = spawn(process.execPath, [path.join(ROOT, 'node_modules/next/dist/bin/next'), 'start', '-p', String(DASH_PORT), '-H', '127.0.0.1'], {
  cwd: ROOT,
  env: { ...process.env, CAHYANA_API: `http://127.0.0.1:${STUB_PORT}/api`, DEMO_ENABLED: 'true', DEMO_USER: 'demo', DEMO_PASS: 'demo', NODE_ENV: 'production' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let nextLog = '';
next.stdout.on('data', (chunk) => { nextLog += chunk; });
next.stderr.on('data', (chunk) => { nextLog += chunk; });

async function waitForDash() {
  const until = Date.now() + 30000;
  while (Date.now() < until) {
    try {
      const res = await fetch(`${DASH}/login`);
      if (res.status === 200) return true;
    } catch (e) { /* not up yet */ }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  return false;
}

function stop(code) {
  next.kill('SIGTERM');
  server.close();
  process.exit(code);
}

if (!(await waitForDash())) {
  console.log('  FAIL: next start did not come up\n', nextLog.slice(-2000));
  stop(1);
}

const callsTo = (route) => stub.calls.filter((call) => call.route === route);
const browser = await chromium.launch({ executablePath: PW_BIN });
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
async function shot(page, name) {
  if (!SHOTS) return;
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(SHOTS, `dash-${name}.png`), fullPage: true });
}
async function signIn(page, user, pass) {
  await page.goto(`${DASH}/login`, { waitUntil: 'networkidle' });
  await page.fill('#adm-user', user);
  await page.fill('#adm-pass', pass);
  await page.click('button[type=submit]');
  return page.waitForURL((u) => new URL(u).pathname === '/', { timeout: 20000 }).then(() => true).catch(() => false);
}
async function openSection(page, width, id, label) {
  if (width < 993) {
    await page.click('#hamburger');
    await page.waitForTimeout(400);
    await page.click(`[data-drawer-row="${id}"]`, { timeout: 8000 }).catch(() => {});
  } else {
    await page.locator('aside button', { hasText: label }).first().click({ timeout: 8000 }).catch(() => {});
  }
  await page.waitForTimeout(600);
}
const text = async (loc) => { try { return await loc.first().innerText({ timeout: 4000 }); } catch (e) { return ''; } };
const seen = async (loc, ms = 5000) => { try { await loc.first().waitFor({ timeout: ms }); return true; } catch (e) { return false; } };

try {
  // ---- the door: no cookie, a driver cookie, a forged owner cookie ----------
  {
    const before = stub.calls.length;
    const none = await fetch(`${DASH}/api/coins/rules`);
    ok(none.status === 401, `no cookie: /api/coins/rules answered ${none.status}, wanted 401`);
    const driverOnly = await fetch(`${DASH}/api/coins/account?email=amelia%40example.com`, { headers: { cookie: 'cue_driver=some-driver-token' } });
    ok(driverOnly.status === 401, `driver cookie opened /api/coins/account (${driverOnly.status})`);
    const driverPost = await fetch(`${DASH}/api/coins/reverse`, { method: 'POST', headers: { cookie: 'cue_driver=some-driver-token', 'Content-Type': 'application/json' }, body: '{"ref":"UPV-AB12CD"}' });
    ok(driverPost.status === 401, `driver cookie opened /api/coins/reverse (${driverPost.status})`);
    ok(stub.calls.length === before, 'a request without the owner cookie reached the API');
    const badRef = await fetch(`${DASH}/api/coins/booking/..%2Fadmin`, { headers: { cookie: 'cue_dash=live:x' } });
    ok(badRef.status === 404, `a ref with a slash was forwarded (${badRef.status})`);
  }

  // ---- owner, live (against the stub) ---------------------------------------
  const ownerCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ownerCtx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  ok(await signIn(page, 'owner', 'pw'), 'owner could not sign in through the stub');
  await page.goto(`${DASH}/cue`, { waitUntil: 'networkidle' });
  await openSection(page, 1280, 'coins', 'Coins');

  ok(await seen(page.locator('[data-coin-rules]')), 'the Coins section shows no rules card');
  ok(await page.locator('input[placeholder="Search a tour, place or transfer"]').count() === 0, 'the Coins section renders the Prices panel');
  ok(await page.locator('[data-earn="tour"]').inputValue().catch(() => '') === '2', 'tour earn input does not show the API value 2');
  ok(await page.locator('[data-pct="villa"]').inputValue().catch(() => '') === '5', 'villa % input does not show the API value 5');
  const rulesBox = await page.locator('[data-coin-rules]').boundingBox();
  ok(rulesBox && rulesBox.width > 200 && rulesBox.height > 100, 'rules card has no real size');
  await shot(page, 'coins-desktop');

  // A value out of range is refused here, before any request.
  const postsBefore = callsTo('POST /api/admin/coins/rules').length;
  await page.fill('[data-earn="tour"]', '99');
  await page.click('[data-rules-save]');
  ok(await seen(page.locator('[data-rules-err]'), 2000), 'earn 99 was not refused on the page');
  ok(callsTo('POST /api/admin/coins/rules').length === postsBefore, 'earn 99 was sent to the API');
  await page.fill('[data-earn="tour"]', '3');
  await page.fill('[data-pct="charter"]', '10');
  await page.click('[data-rules-save]');
  ok(await seen(page.locator('[data-rules-ok]')), 'saving the rules showed no confirmation');
  const savedRules = callsTo('POST /api/admin/coins/rules').at(-1);
  ok(savedRules && savedRules.body.earn.tour === 3 && savedRules.body.pct.charter === 10, `the API did not receive earn.tour 3 / pct.charter 10: ${JSON.stringify(savedRules && savedRules.body)}`);

  // Villa perk menu: add, switch off.
  ok(await page.locator('[data-perk-villa="Cahyana House"] [data-perk]').count() === 2, 'Cahyana House does not list its 2 perks');
  await page.fill('#perk-new-cahyana-tibuah', 'Fruit basket');
  await page.fill('#perk-coins-cahyana-tibuah', '3');
  await page.click('[data-perk-add="cahyana-tibuah"] [data-perk-add-btn]');
  await page.waitForTimeout(800);
  const added = callsTo('POST /api/admin/coins/menu').at(-1);
  ok(added && added.body.property === 'Cahyana Tibuah' && added.body.label === 'Fruit basket' && added.body.coins === 3, `perk add did not reach the API as typed: ${JSON.stringify(added && added.body)}`);
  ok(await page.locator('[data-perk-villa="Cahyana Tibuah"] [data-perk]').count() === 2, 'the new perk is not listed after the reload');
  await page.locator('[data-perk="2"] label').click();
  await page.waitForTimeout(800);
  ok(stub.menu.find((row) => row.id === 2).active === false, 'switching a perk off did not reach the API');
  ok(await page.locator('[data-perk="2"]').getAttribute('data-perk-active') === 'off', 'the switched-off perk still reads on');

  // Guest lookup and a minus that has to be confirmed.
  await page.fill('#coin-email', 'nobody@example.com');
  await page.click('[data-coin-lookup]');
  ok(await seen(page.locator('[data-coin-guest-err]')), 'an unknown email showed no error');
  await page.fill('#coin-email', 'amelia@example.com');
  await page.click('[data-coin-lookup]');
  ok(await seen(page.locator('[data-coin-balance]')), 'lookup showed no balance');
  ok((await text(page.locator('[data-coin-balance]'))).trim() === String(balanceOf('amelia@example.com')), 'the balance shown is not the API balance');
  ok(await page.locator('[data-coin-history-row]').count() === summary('amelia@example.com').history.length, 'history rows do not match the API');
  ok((await text(page.locator('[data-coin-expiry]'))).includes('4 coins expire'), 'next expiry not shown from { date, coins }');

  const adjustsBefore = callsTo('POST /api/admin/coins/adjust').length;
  await page.fill('#coin-delta', '-2');
  await page.click('[data-coin-apply]');
  ok(await seen(page.locator('[data-coin-adjust-err]'), 2000), 'a minus without a note was not refused');
  await page.fill('#coin-note', 'Duplicate credit');
  await page.click('[data-coin-apply]');
  ok(await seen(page.locator('[data-coin-guest] [data-confirm-bar]'), 2000), 'a minus did not ask for confirmation');
  ok(callsTo('POST /api/admin/coins/adjust').length === adjustsBefore, 'a minus was sent before it was confirmed');
  await shot(page, 'coins-adjust-confirm');
  await page.click('[data-coin-guest] [data-confirm-yes]');
  ok(await seen(page.locator('[data-coin-adjust-ok]')), 'the confirmed minus showed no result');
  const adjust = callsTo('POST /api/admin/coins/adjust').at(-1);
  ok(adjust && adjust.body.delta === -2 && adjust.body.note === 'Duplicate credit' && adjust.body.email === 'amelia@example.com', `adjust body wrong: ${JSON.stringify(adjust && adjust.body)}`);
  ok((await text(page.locator('[data-coin-balance]'))).trim() === String(balanceOf('amelia@example.com')), 'balance did not update after the adjust');
  await page.fill('#coin-delta', '2');
  await page.fill('#coin-note', 'Goodwill');
  const plusBefore = callsTo('POST /api/admin/coins/adjust').length;
  await page.click('[data-coin-apply]');
  await page.waitForTimeout(800);
  ok(callsTo('POST /api/admin/coins/adjust').length === plusBefore + 1, 'a plus did not go straight through');

  // ---- villa dashboard: the booking card -------------------------------------
  await page.goto(`${DASH}/villas`, { waitUntil: 'networkidle' });
  const card = page.locator('[data-booking-coins="UPV-AB12CD"]');
  ok(await seen(card.locator('[data-booking-coin-row]')), 'the villa card did not open its coin rows by itself');
  const notes = page.locator('[data-covered-note]');
  ok(await notes.count() === 2, `want 2 "Covered by coin" notes (line items + ledger), got ${await notes.count()}`);
  const noteStyle = await notes.first().evaluate((node) => {
    const style = getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    return { bg: style.backgroundColor, border: style.borderTopColor, weight: style.fontWeight, w: rect.width, h: rect.height, text: node.innerText };
  }).catch(() => null);
  ok(noteStyle && noteStyle.w > 100 && noteStyle.h > 16, `covered note has no real size: ${JSON.stringify(noteStyle)}`);
  ok(noteStyle && noteStyle.bg !== 'rgba(0, 0, 0, 0)' && noteStyle.bg !== 'rgb(255, 255, 255)', `covered note has no background of its own: ${noteStyle && noteStyle.bg}`);
  ok(noteStyle && noteStyle.weight === '600', `covered note is not semibold: ${noteStyle && noteStyle.weight}`);
  ok(noteStyle && noteStyle.text.includes('Airport pick-up'), 'the line-item covered note lost its perk name');

  // Hover is colour only: the button keeps its size.
  const refundBtn = card.locator('[data-refund-open]');
  const sizeBefore = await refundBtn.boundingBox();
  const bgBefore = await refundBtn.evaluate((node) => getComputedStyle(node).backgroundColor);
  await refundBtn.hover();
  await page.waitForTimeout(400);
  const sizeAfter = await refundBtn.boundingBox();
  const bgAfter = await refundBtn.evaluate((node) => getComputedStyle(node).backgroundColor);
  ok(sizeBefore && sizeAfter && sizeBefore.width === sizeAfter.width && sizeBefore.height === sizeAfter.height, 'Refund coins changes size on hover');
  ok(bgBefore !== bgAfter, 'Refund coins has no hover colour');
  await shot(page, 'villa-booking-coins');

  // Redeem perk: pick, confirm, the note appears.
  await card.locator('[data-redeem-open]').click();
  ok(await seen(card.locator('[data-redeem-item="1"]')), 'Redeem perk shows no menu');
  ok(await card.locator('[data-redeem-item]').count() === 1, 'Redeem perk lists a switched-off perk or another villa\'s perk');
  await card.locator('[data-redeem-item="1"]').click();
  ok(await seen(card.locator('[data-confirm-bar]'), 2000), 'redeem did not ask for confirmation');
  await shot(page, 'villa-redeem-confirm');
  const redeemsBefore = callsTo('POST /api/admin/coins/redeem').length;
  await card.locator('[data-confirm-yes]').click();
  ok(await seen(card.locator('[data-booking-coins-ok]')), 'redeem showed no result');
  const redeem = callsTo('POST /api/admin/coins/redeem').at(-1);
  ok(callsTo('POST /api/admin/coins/redeem').length === redeemsBefore + 1 && redeem.body.ref === 'UPV-AB12CD' && redeem.body.itemId === 1, `redeem body wrong: ${JSON.stringify(redeem && redeem.body)}`);
  await page.waitForTimeout(600);
  ok(await page.locator('[data-covered-note]').count() === 3, 'the redeemed perk note did not appear on the card');

  // Refund coins: cancel sends nothing; confirm sends the ref.
  const reversesBefore = callsTo('POST /api/admin/coins/reverse').length;
  await card.locator('[data-refund-open]').click();
  ok(await seen(card.locator('[data-confirm-bar]'), 2000), 'Refund coins did not ask for confirmation');
  await card.locator('[data-confirm-no]').click();
  ok(callsTo('POST /api/admin/coins/reverse').length === reversesBefore, 'cancelling the refund still sent it');
  await card.locator('[data-refund-open]').click();
  await card.locator('[data-confirm-yes]').click();
  ok(await seen(card.locator('[data-booking-coins-ok]')), 'refund showed no result');
  const reverse = callsTo('POST /api/admin/coins/reverse').at(-1);
  ok(callsTo('POST /api/admin/coins/reverse').length === reversesBefore + 1 && reverse.body.ref === 'UPV-AB12CD', 'refund did not send the ref');
  const settled = await page.waitForFunction(() => document.querySelectorAll('[data-covered-note]').length === 1, null, { timeout: 5000 }).then(() => true).catch(() => false);
  ok(settled, `returned perk rows still show as covered after the refund (${await page.locator('[data-covered-note]').count()} notes)`);
  await shot(page, 'villa-after-refund');

  // Tours side: closed until asked (one request per opened card).
  const bookingReadsBefore = stub.calls.filter((call) => call.route.startsWith('GET /api/admin/coins/booking/')).length;
  await page.goto(`${DASH}/cue`, { waitUntil: 'networkidle' });
  ok(stub.calls.filter((call) => call.route.startsWith('GET /api/admin/coins/booking/')).length === bookingReadsBefore, 'the tours list loaded coin rows for closed cards');
  await page.locator('[data-booking-coins="CUE-501"] [data-coins-toggle]').click();
  ok(await seen(page.locator('[data-booking-coins="CUE-501"] [data-booking-coin-row]')), 'opening the coin block on a tour card showed no rows');
  ok(await page.locator('[data-booking-coins="CUE-501"] [data-redeem-open]').count() === 0, 'a tour booking offers Redeem perk');
  ok(errors.length === 0, `page errors: ${errors.join(' | ')}`);
  await ownerCtx.close();

  // ---- phone width -----------------------------------------------------------
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, storageState: await (async () => {
    const ctx = await browser.newContext();
    const login = await ctx.newPage();
    await signIn(login, 'owner', 'pw');
    const state = await ctx.storageState();
    await ctx.close();
    return state;
  })() });
  const phonePage = await phone.newPage();
  await phonePage.goto(`${DASH}/cue`, { waitUntil: 'networkidle' });
  await openSection(phonePage, 390, 'coins', 'Coins');
  ok(await seen(phonePage.locator('[data-coin-rules]')), 'phone: the Coins section did not open from the drawer');
  const overflow = await phonePage.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok(overflow <= 0, `phone: the Coins section scrolls sideways by ${overflow}px`);
  await shot(phonePage, 'coins-phone');
  await phonePage.goto(`${DASH}/villas`, { waitUntil: 'networkidle' });
  await seen(phonePage.locator('[data-booking-coin-row]'));
  await shot(phonePage, 'villa-booking-phone');
  await phone.close();

  // ---- demo: works, and never reaches the API ---------------------------------
  const demoCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const demoPage = await demoCtx.newPage();
  ok(await signIn(demoPage, 'demo', 'demo'), 'demo could not sign in');
  const apiCallsBefore = stub.calls.length;
  await demoPage.goto(`${DASH}/cue`, { waitUntil: 'networkidle' });
  await openSection(demoPage, 1280, 'coins', 'Coins');
  ok(await demoPage.locator('[data-earn="tour"]').inputValue().catch(() => '') === '2', 'demo: rules did not load');
  ok(await demoPage.locator('[data-perk]').count() === 4, 'demo: perk menu not shown');
  await demoPage.fill('#coin-email', 'amelia@example.com');
  await demoPage.click('[data-coin-lookup]');
  ok((await text(demoPage.locator('[data-coin-balance]'))).trim() === '3', 'demo: amelia balance is not 3');
  await demoPage.fill('#coin-delta', '2');
  await demoPage.fill('#coin-note', 'Demo plus');
  await demoPage.click('[data-coin-apply]');
  await demoPage.waitForTimeout(800);
  ok((await text(demoPage.locator('[data-coin-balance]'))).trim() === '5', 'demo: the adjust did not change the balance');
  await shot(demoPage, 'coins-demo');
  await demoPage.goto(`${DASH}/cue`, { waitUntil: 'networkidle' });
  await demoPage.locator('[data-booking-coins="DEMO-004"] [data-coins-toggle]').click();
  ok(await seen(demoPage.locator('[data-booking-coins="DEMO-004"] [data-booking-coin-row]')), 'demo: booking coin rows did not show');
  ok(stub.calls.length === apiCallsBefore, `demo reached the API ${stub.calls.length - apiCallsBefore} time(s)`);
  await demoCtx.close();
} catch (e) {
  failed += 1;
  console.log(`  FAIL: harness crashed: ${e.stack || e}`);
}

await browser.close();
console.log(`verify-coins-dash: ${passed} passed, ${failed} failed`);
stop(failed ? 1 : 0);
