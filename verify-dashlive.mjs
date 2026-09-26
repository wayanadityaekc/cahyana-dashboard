#!/usr/bin/env node
// The owner's side of the chat, live, against the real API over a real socket.
//
// verify-dash2.mjs runs in demo mode with CAHYANA_API pointed at an invalid host,
// which is right for what it checks (the door, the tokens, the layout) and
// useless for this: a socket needs a server. So this one runs the dashboard
// against cahyana-api itself, with a guest on the other end.
//
// The claim is the same one the guest's side makes, and it is checked the same
// way - by counting requests, not by a stopwatch. A guest's message has to reach
// an open conversation with NO list or thread read in between, or it came from a
// poll and nothing has changed.
//
// Run:  node ../cahyana-api/tools/chat-dev-server.js     (port 4599)
//       scratchpad/dashlive-ctl.sh start                 (port 3101, live API)
//       node verify-dashlive.mjs
import { chromium } from '/home/user/CUE/node_modules/playwright-core/index.mjs';
import WS from '/home/user/cahyana-api/node_modules/ws/index.js';

const BASE = process.env.DASH || 'http://127.0.0.1:3101';
const API = process.env.API || 'http://127.0.0.1:4599/api';
const USER = process.env.ADMIN_USER || 'owner';
const PASS = process.env.ADMIN_PASS || 'pw';
const AUTH = 'Basic ' + Buffer.from(`${USER}:${PASS}`).toString('base64');

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log('  FAIL:', m)); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Report, never throw: one failed wait must not hide every assertion after it.
const seen = async (loc, ms = 5000) => { try { await loc.first().waitFor({ timeout: ms }); return true; } catch { return false; } };
const untilTrue = async (page, fn, ms = 10000) => { try { await page.waitForFunction(fn, null, { timeout: ms }); return true; } catch { return false; } };

// Signing in, with the ONE failure mode that has wasted the most time on this
// dashboard named out loud: /api/session allows 5 attempts per 15 minutes per IP
// and the counter is in the server process, so the sixth sign-in of a session
// fails - and it used to surface as a 401 from an unrelated route much later.
// RESTART THE DASHBOARD BEFORE EVERY RUN.
async function signIn(p, user, pw, label) {
  const res = p.waitForResponse((r) => new URL(r.url()).pathname === '/api/session', { timeout: 20000 });
  await p.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await p.locator('input#adm-user').first().fill(user);
  await p.locator('input#adm-pass').first().fill(pw);
  await p.locator('button[type="submit"]').first().click();
  let status = 0;
  try { status = (await res).status(); } catch { /* no response at all */ }
  ok(status !== 429, `${label}: the sign-in was RATE LIMITED (5 per 15 min) - restart the dashboard before the run`);
  ok(status === 200, `${label}: sign-in answered ${status}`);
  return status === 200;
}

const api = (p, init = {}) => fetch(API + p, {
  ...init,
  headers: { Authorization: AUTH, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers || {}) },
}).then(async (r) => ({ status: r.status, json: await r.json().catch(() => null) }));

const pub = (p, init = {}) => fetch(API + p, {
  ...init, headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
}).then(async (r) => ({ status: r.status, json: await r.json().catch(() => null) }));

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell' });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));

// Every read of the chat list or a conversation, so "no poll happened" is a
// count. The ticket exchange is deliberately NOT counted - that is the socket's
// own handshake, not a fallback read.
// The LIST read and the CONVERSATION read are counted apart, and only the second
// one settles the question. A socket push makes the panel refresh the list on
// purpose - that is how a badge and a preview line stay right for threads that
// are not open - so counting all reads together says "a poll happened" about the
// socket doing its job. The message body itself can only come from a poll if the
// conversation was re-read, so that is the count that has to be zero.
const listReads = [];
const threadReads = [];
page.on('request', (r) => {
  const p = new URL(r.url()).pathname;
  if (/^\/api\/chats\/\d+$/.test(p)) threadReads.push(r.url());
  else if (p === '/api/chats') listReads.push(r.url());
});

// --- a guest is waiting before the owner even signs in -------------------
const Q = 'we land at 2am with a baby, is the batur trek ok';
const started = await pub('/chat/start', { method: 'POST', body: JSON.stringify({ name: 'Priya', email: 'priya@example.com', question: Q, page: '/tour.html' }) });
ok(started.status === 200 && /^[a-f0-9]{48}$/.test(started.json.thread || ''), 'could not start a guest thread');
const guestId = started.json.thread;

// --- sign in ------------------------------------------------------------
await signIn(page, USER, PASS, 'owner');
ok(await untilTrue(page, () => new URL(location.href).pathname === '/', 15000), 'signing in did not reach the dashboard');

// --- open the chat section ----------------------------------------------
await page.locator('nav[aria-label] >> text=Chat').first().click();
ok(await seen(page.locator('[data-live]'), 8000), 'the chat column never rendered');
ok(await untilTrue(page, () => document.querySelector('[data-live]')?.getAttribute('data-live') === '1', 12000),
  'the dashboard never got a live socket - the ticket exchange or the upgrade failed');
ok(await page.locator('[data-live]').getAttribute('data-live') === '1', 'the dashboard is not live');

// The guest who was already waiting must be in the list.
ok(await seen(page.locator('text=Priya'), 6000), 'the waiting guest is not in the list');
await page.locator('text=Priya').first().click();
ok(await seen(page.locator(`text=${Q.slice(0, 20)}`), 6000), 'the conversation did not open');

// --- the claim: a guest message lands with no poll ----------------------
await sleep(400);
const beforeThread = threadReads.length;
const t0 = Date.now();
const sent = await pub(`/chat/${guestId}/message`, { method: 'POST', body: JSON.stringify({ body: 'UNIQUE1 and can you bring a baby seat' }) });
ok(sent.status === 200, `the guest message failed (${sent.status})`);
const landed = await seen(page.locator('text=UNIQUE1'), 4000);
const took = Date.now() - t0;
ok(landed, 'the guest message never reached the open conversation');
ok(!landed || took < 1500, `it took ${took}ms - that is poll speed, not socket speed`);
// The airtight half. The socket push itself makes the panel re-read the list, so
// what must be zero is reads BEFORE the message appeared, not after.
ok(threadReads.length === beforeThread,
  `the conversation was re-read ${threadReads.length - beforeThread} time(s) before the message appeared - it came from a poll, not the socket`);

// --- typing, from the guest's own socket --------------------------------
const gsock = new WS(API.replace(/^http/, 'ws').replace(/\/api$/, '') + `/ws/chat?thread=${guestId}`);
await new Promise((r, j) => { gsock.once('open', r); gsock.once('error', j); });
gsock.send(JSON.stringify({ type: 'typing' }));
ok(await seen(page.locator('[data-typing]'), 3000), 'the guest typing never reached the dashboard');
await sleep(5000);
ok(await page.locator('[data-typing]').count() === 0, 'the typing row never expired');

// --- and the reply goes back down the guest's socket --------------------
const frames = [];
gsock.on('message', (raw) => { try { frames.push(JSON.parse(String(raw))); } catch { /* ignore */ } });
const input = page.locator('input[aria-label="Your reply"]');
await input.fill('UNIQUE2 yes, a baby seat is no problem');
await input.press('Enter');
const heard = await (async () => {
  const t = Date.now();
  while (Date.now() - t < 5000) {
    if (frames.some((f) => f.type === 'message' && /UNIQUE2/.test(f.message?.body || ''))) return true;
    await sleep(50);
  }
  return false;
})();
ok(heard, "the owner's reply never reached the guest's socket");
ok(await seen(page.locator('text=UNIQUE2'), 3000), 'the reply is not shown in the dashboard');

// The reply must appear once, not twice: the panel adds it optimistically AND
// hears its own echo back so a second tab stays in step.
await sleep(800);
// Scoped to the conversation. [data-live] wraps the LIST too, and the list's
// preview line legitimately repeats the newest message ("You: ..."), so counting
// across the whole column reported a duplicate that was never there.
const body = await page.locator('[data-chatbody]').innerText();
ok((body.match(/UNIQUE2/g) || []).length === 1, 'the reply was shown twice - the optimistic add and the echo both counted');

// --- demo mode must never try to be live -------------------------------
// It has no API behind it, so a socket would retry forever against nothing.
const dctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const dpage = await dctx.newPage();
await signIn(dpage, 'demo', 'demo', 'demo');
ok(await untilTrue(dpage, () => new URL(location.href).pathname === '/', 15000), 'the demo sign-in did not reach the dashboard');
await dpage.locator('nav[aria-label] >> text=Chat').first().click();
ok(await seen(dpage.locator('[data-live]'), 8000), 'the demo chat column never rendered');
await sleep(2500);
ok(await dpage.locator('[data-live]').getAttribute('data-live') === '0', 'demo mode reported itself live - it has no API to be live with');
// FROM THE PAGE, not from ctx.request. The session cookie is Secure (next start
// runs in production mode) and Playwright's APIRequestContext will not send a
// Secure cookie over http, while the browser will - 127.0.0.1 counts as a
// trustworthy origin to it. So ctx.request arrived with no cookie, got a 401,
// and that 401's Set-Cookie CLEARED the browser's session as well: the probe
// logged the page out and then blamed the route. Only a local artifact - a real
// deployment is https - but it cost an hour.
const tj = await dpage.evaluate(async () => {
  const r = await fetch('/api/ws-ticket', { method: 'POST' });
  return { status: r.status, body: await r.json().catch(() => ({})) };
});
ok(tj.status === 200, `the demo ticket route answered ${tj.status}`);
ok(tj.body.demo === true && !tj.body.url, `demo asked for a real socket url: ${JSON.stringify(tj.body)}`);

// --- and a stranger gets no ticket at all ------------------------------
const anon = await b.newContext();
const noSess = await anon.request.post(`${BASE}/api/ws-ticket`, { failOnStatusCode: false });
ok(noSess.status() === 401, `a signed-out caller got ${noSess.status()} from the ticket route`);
const noBody = await noSess.text();
ok(!/ws:|wss:|ticket/i.test(noBody), 'the ticket route leaked something to a signed-out caller');

ok(errs.length === 0, `page errors: ${errs.join(' | ')}`);
gsock.close();
await b.close();
console.log(`\n${pass}/${pass + fail}`);
process.exit(fail ? 1 : 0);
