import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '/home/user/CUE/node_modules/playwright-core/index.mjs';

// DASHBOARD BRIEF #5: the Settings section and dashboard push, end to end.
//
// Runs the dashboard in LIVE mode against the REAL cahyana-api server (its
// database stubbed in memory, its outgoing pushes written to a file instead of
// leaving the machine):
//   node ../cahyana-api/tools/chat-dev-server.js           (port 4599, PUSH_LOG=...)
//   CAHYANA_API=http://127.0.0.1:4599/api npx next start -p 3101
// plus the demo server on 3100 and CUE's out/ on 4000 (for the switch's look).
//
// What this CANNOT drive: a real browser push service. Headless Chromium has
// none, so PushManager is replaced with a fake that hands back a fixed
// subscription - everything after that (our API, the toggles, the payload the
// server builds, the service worker showing it, the tap opening a section) is
// the real code. The payload is delivered to the worker over CDP, which is the
// same event a push service would fire.
const DASH = process.env.DASH || 'http://localhost:3101';
const DEMO = process.env.DEMO || 'http://localhost:3100';
const API = process.env.API || 'http://127.0.0.1:4599/api';
const CUE = process.env.CUE || 'http://localhost:4000';
const PUSH_LOG = process.env.PUSH_LOG || '/tmp/claude-0/pushes.jsonl';
const BASIC = 'Basic ' + Buffer.from('owner:pw').toString('base64');
const ENDPOINT = 'https://push.example/harness-device';

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log('  FAIL:', m)); };
// Reads that report instead of throwing: one missing element must not hide
// every assertion after it.
const isOn = (loc) => loc.isChecked({ timeout: 3000 }).catch(() => null);
const isOff = (loc) => loc.isDisabled({ timeout: 3000 }).catch(() => null);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pushes = () => readFileSync(PUSH_LOG, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const apiPost = async (path, body, auth = BASIC) => {
  const r = await fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: auth } : {}) }, body: JSON.stringify(body) });
  return { status: r.status, json: await r.json().catch(() => ({})) };
};

// A PushManager that works without a push service. getSubscription survives a
// reload (localStorage), like a real subscription does.
const fakePush = (endpoint) => {
  const make = () => ({
    endpoint,
    toJSON: () => ({ endpoint, keys: { p256dh: 'BHarnessKey' + 'x'.repeat(60), auth: 'harnessAuth12345' } }),
    unsubscribe: async () => { localStorage.removeItem('__fakesub'); return true; },
  });
  PushManager.prototype.subscribe = async function subscribe(opts) {
    if (!opts || !opts.applicationServerKey || !opts.userVisibleOnly) throw new Error('bad subscribe options');
    localStorage.setItem('__fakesub', '1');
    return make();
  };
  PushManager.prototype.getSubscription = async function getSubscription() {
    return localStorage.getItem('__fakesub') ? make() : null;
  };
};

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

// ---- sign in once (5 sign-ins per 15 min per process) ----
let SESSION;
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(DASH + '/login', { waitUntil: 'networkidle' });
  await page.fill('#adm-user', 'owner');
  await page.fill('#adm-pass', 'pw');
  await page.click('button[type=submit]');
  const landed = await page.waitForURL((u) => new URL(u).pathname === '/', { timeout: 20000 }).then(() => true).catch(() => false);
  if (!landed) { console.log('  FAIL: could not sign in to the live dashboard (restart it; is the dev API up?)'); process.exit(1); }
  SESSION = await ctx.storageState();
  await ctx.close();
}

const openSettings = async (page, w, via) => {
  if (via === 'account') {
    await page.click('[data-account-slot] > button');
    await page.click('[data-acct-settings]');
  } else if (w <= 992) {
    await page.click('#hamburger');
    await sleep(400);
    await page.click('[data-drawer-row="settings"]');
  } else {
    await page.locator('aside button', { hasText: 'Settings' }).first().click();
  }
  return page.locator('[data-settings]').first().waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
};

// ---- 1. reachable three ways, at both widths ----
for (const w of [390, 1280]) {
  for (const via of ['menu', 'account']) {
    const ctx = await b.newContext({ viewport: { width: w, height: 844 }, storageState: SESSION });
    const page = await ctx.newPage();
    await page.goto(DASH + '/', { waitUntil: 'networkidle' });
    ok(await openSettings(page, w, via), `${w}: Settings did not open from the ${via === 'menu' ? (w <= 992 ? 'drawer' : 'sidebar') : 'account menu'}`);
    await page.waitForFunction(() => !/Loading/.test(document.querySelector('[data-set-user]')?.textContent || 'Loading'), null, { timeout: 8000 }).catch(() => {});
    const who = await page.locator('[data-set-user]').innerText().catch(() => '');
    ok(/owner/.test(who) && /session ends/i.test(who), `${w}: account line reads "${who}"`);
    const bell = await page.evaluate(() => {
      const row = window.innerWidth <= 992
        ? document.querySelector('[data-drawer-row="settings"]')
        : [...document.querySelectorAll('aside button')].find((x) => x.textContent.trim() === 'Settings');
      return !!(row && row.querySelector('svg.lucide-bell'));
    });
    ok(bell, `${w}: the Settings row is not the Lucide bell`);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    ok(over <= 0, `${w}: Settings overflows by ${over}px`);
    await ctx.close();
  }
}

// ---- 2. the switch is the site's switch ----
{
  const shape = (page, sel) => page.evaluate((s) => {
    const track = document.querySelector(s);
    if (!track) return null;
    const c = getComputedStyle(track);
    const r = track.getBoundingClientRect();
    return { w: r.width, h: r.height, rad: c.borderRadius, bg: c.backgroundColor };
  }, sel);
  const cctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const cp = await cctx.newPage();
  await cp.goto(CUE + '/transfer.html', { waitUntil: 'networkidle' });
  const ref = await shape(cp, 'label:has(input.peer[type=checkbox]) > span');
  await cctx.close();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, storageState: SESSION });
  const page = await ctx.newPage();
  await page.goto(DASH + '/?tab=settings', { waitUntil: 'networkidle' });
  await page.locator('[data-settings]').waitFor({ timeout: 8000 }).catch(() => {});
  const mine = await shape(page, 'label[for="push-master"] > span');
  ok(ref && mine && ref.w === mine.w && ref.h === mine.h && ref.rad === mine.rad && ref.bg === mine.bg,
    `switch ${JSON.stringify(mine)} vs site's ${JSON.stringify(ref)}`);
  // ?tab= deep link lands on Settings and is cleaned from the URL.
  ok(new URL(page.url()).search === '', `?tab= was left in the URL (${page.url()})`);
  await ctx.close();
}

// ---- 3. turning push on, the toggles, the test, a real event, the worker ----
{
  writeFileSync(PUSH_LOG, '');
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, storageState: SESSION });
  await ctx.grantPermissions(['notifications'], { origin: new URL(DASH).origin });
  await ctx.addInitScript(fakePush, ENDPOINT);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('dialog', (d) => d.accept());
  await page.goto(DASH + '/?tab=settings', { waitUntil: 'networkidle' });
  await page.locator('[data-settings]').waitFor({ timeout: 8000 }).catch(() => {});
  await page.evaluate(() => navigator.serviceWorker.ready);

  const master = page.locator('#push-master');
  ok(!(await isOff(master)), 'push switch is disabled with permission granted and keys set');
  ok(!(await isOn(master)), 'push switch starts ON before anything was subscribed');
  ok(await isOff(page.locator('#push-review')), 'event toggles are live before push is on');
  await page.click('label[for="push-master"]', { timeout: 5000 }).catch(() => {});
  await page.waitForFunction(() => document.querySelector('#push-master').checked, null, { timeout: 8000 }).catch(() => {});
  ok(await isOn(master), 'push switch did not turn on');
  let st = await apiPost('/admin/push/status', { endpoint: ENDPOINT });
  ok(st.json.subscribed === true, `API does not have the device (${JSON.stringify(st.json)})`);
  ok(st.json.prefs && st.json.prefs.booking && st.json.prefs.chat && st.json.prefs.attention && !st.json.prefs.review && !st.json.prefs.leads,
    `saved defaults are ${JSON.stringify(st.json.prefs)}`);

  // Toggle one event and read it back from the API, not from the page.
  await page.click('label[for="push-review"]', { timeout: 5000 }).catch(() => {});
  await sleep(600);
  st = await apiPost('/admin/push/status', { endpoint: ENDPOINT });
  ok(st.json.prefs && st.json.prefs.review === true, 'switching Reviews on did not reach the API');
  await page.click('label[for="push-chat"]', { timeout: 5000 }).catch(() => {});
  await sleep(600);
  st = await apiPost('/admin/push/status', { endpoint: ENDPOINT });
  ok(st.json.prefs && st.json.prefs.chat === false, 'switching Chat off did not reach the API');

  // Reload: the page must read this device's state back.
  // (?tab= is stripped after use, so a plain reload lands on Upcoming.)
  await page.goto(DASH + '/?tab=settings', { waitUntil: 'networkidle' });
  await page.locator('[data-settings]').waitFor({ timeout: 8000 }).catch(() => {});
  await page.waitForFunction(() => document.querySelector('#push-master')?.checked, null, { timeout: 8000 }).catch(() => {});
  ok(await isOn(master), 'after a reload the switch forgot this device is subscribed');
  ok(!(await isOn(page.locator('#push-chat'))), 'after a reload Chat came back on');

  // A chat event while Chat is OFF for this device: nothing sent.
  writeFileSync(PUSH_LOG, '');
  await fetch(API + '/chat/start', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:4000' }, body: JSON.stringify({ name: 'Hannah Guest', email: 'hannah.guest@gmail.com', question: 'Can you pick up at 3am?' }) });
  await sleep(700);
  ok(pushes().length === 0, `a chat push went out with Chat switched off (${JSON.stringify(pushes())})`);
  // Chat back on, event again: sent, and nothing about the guest in it.
  await page.click('label[for="push-chat"]', { timeout: 5000 }).catch(() => {});
  await sleep(600);
  await fetch(API + '/chat/start', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:4000' }, body: JSON.stringify({ name: 'Hannah Guest', email: 'hannah.guest@gmail.com', question: 'Can you pick up at 3am?' }) });
  await sleep(700);
  const chatPush = pushes().find((p) => p.payload.tag === 'chat');
  ok(!!chatPush && chatPush.endpoint === ENDPOINT, `no chat push reached the device (${JSON.stringify(pushes())})`);
  ok(chatPush && !/Hannah|hannah|3am/.test(JSON.stringify(chatPush.payload)), `the chat push leaks the guest: ${JSON.stringify(chatPush && chatPush.payload)}`);

  // The test button.
  writeFileSync(PUSH_LOG, '');
  await page.click('[data-push-test]');
  await sleep(700);
  const t = pushes();
  ok(t.length === 1 && t[0].payload.title === 'Test notification', `test button sent ${JSON.stringify(t)}`);
  ok(/Test sent/.test(await page.locator('[role=status]').innerText().catch(() => '')), 'no confirmation after Send test');

  // The worker: deliver the real chat payload and read back the notification.
  const cdp = await ctx.newCDPSession(page);
  let regId = null;
  cdp.on('ServiceWorker.workerRegistrationUpdated', (e) => {
    for (const r of e.registrations) if (!r.isDeleted && r.scopeURL.startsWith(new URL(DASH).origin)) regId = r.registrationId;
  });
  await cdp.send('ServiceWorker.enable');
  await sleep(500);
  ok(!!regId, 'no service worker registration to deliver to');
  if (regId && chatPush) {
    await cdp.send('ServiceWorker.deliverPushMessage', { origin: new URL(DASH).origin, registrationId: regId, data: JSON.stringify(chatPush.payload) });
    await sleep(800);
    const shown = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      const ns = await reg.getNotifications();
      return ns.map((n) => ({ title: n.title, body: n.body, icon: n.icon, badge: n.badge, tag: n.tag, url: n.data && n.data.url }));
    });
    const n = shown.find((x) => x.tag === 'chat');
    ok(!!n, `the worker showed no notification (${JSON.stringify(shown)})`);
    ok(n && n.title === 'Chat' && n.url === '/?tab=chat', `notification ${JSON.stringify(n)}`);
    ok(n && /\/icons\/bell-192\.png$/.test(n.icon) && /\/icons\/bell-badge-96\.png$/.test(n.badge), `notification icon/badge ${n && n.icon} / ${n && n.badge}`);
    // A tap opens that URL; opening it must land on the section.
    await page.goto(DASH + (n ? n.url : '/'), { waitUntil: 'networkidle' });
    await sleep(500);
    const onChat = await page.evaluate(() => document.querySelector('[data-nav-chat]')?.getAttribute('aria-current'));
    ok(onChat === 'page', 'the notification URL did not open Chat');
  }

  // Off again: gone from the API.
  await page.goto(DASH + '/?tab=settings', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('#push-master')?.checked, null, { timeout: 8000 }).catch(() => {});
  await page.click('label[for="push-master"]', { timeout: 5000 }).catch(() => {});
  await sleep(700);
  st = await apiPost('/admin/push/status', { endpoint: ENDPOINT });
  ok(st.json.subscribed === false, 'turning push off left the device subscribed');
  ok(errs.length === 0, `page errors: ${errs.join(' | ')}`);
  await ctx.close();
}

// ---- 4. blocked permission and an iPhone tab: the switch says why and stays off ----
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, storageState: SESSION });
  await ctx.addInitScript(() => {
    Object.defineProperty(Notification, 'permission', { get: () => 'denied' });
    Notification.requestPermission = async () => 'denied';
  });
  const page = await ctx.newPage();
  await page.goto(DASH + '/?tab=settings', { waitUntil: 'networkidle' });
  await page.locator('[data-push-note]').waitFor({ timeout: 8000 }).catch(() => {});
  await sleep(400);
  ok(await isOff(page.locator('#push-master')), 'blocked: switch is still usable');
  ok(/blocked/i.test(await page.locator('[data-push-note]').innerText()), 'blocked: note does not say notifications are blocked');
  await ctx.close();

  const ictx = await b.newContext({
    viewport: { width: 390, height: 844 }, storageState: SESSION,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
  const ip = await ictx.newPage();
  await ip.goto(DASH + '/?tab=settings', { waitUntil: 'networkidle' });
  await ip.locator('[data-push-note]').waitFor({ timeout: 8000 }).catch(() => {});
  await sleep(400);
  ok(await isOff(ip.locator('#push-master')), 'iPhone tab: switch is usable (iOS only allows push when installed)');
  ok(/Home Screen/.test(await ip.locator('[data-push-note]').innerText()), 'iPhone tab: note does not say to add to Home Screen');
  await ictx.close();
}

// ---- 5. demo: push is off and says why, nothing reaches the API ----
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(DEMO + '/login', { waitUntil: 'networkidle' });
  await page.fill('#adm-user', 'demo');
  await page.fill('#adm-pass', 'demo');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => new URL(u).pathname === '/', { timeout: 20000 }).catch(() => {});
  await page.goto(DEMO + '/?tab=settings', { waitUntil: 'networkidle' });
  await page.locator('[data-push-note]').waitFor({ timeout: 8000 }).catch(() => {});
  await sleep(400);
  ok(await isOff(page.locator('#push-master')), 'demo: push switch is usable');
  ok(/demo/i.test(await page.locator('[data-push-note]').innerText().catch(() => '')), 'demo: note does not mention the demo');
  await ctx.close();
}

// ---- 6. sign out on all devices ends THIS and every other session ----
{
  const a = await b.newContext({ viewport: { width: 1280, height: 900 }, storageState: SESSION });
  const other = await b.newContext({ viewport: { width: 390, height: 844 }, storageState: SESSION });
  const pa = await a.newPage();
  pa.on('dialog', (d) => d.accept());
  await pa.goto(DASH + '/?tab=settings', { waitUntil: 'networkidle' });
  await pa.click('[data-set-logout-all]');
  const out = await pa.waitForURL((u) => new URL(u).pathname === '/login', { timeout: 10000 }).then(() => true).catch(() => false);
  ok(out, 'sign out on all devices did not send this device to /login');
  const po = await other.newPage();
  await po.goto(DASH + '/', { waitUntil: 'networkidle' });
  await sleep(800);
  // The other device's cookie is still there, but the API session behind it is
  // gone - its first data call bounces it to the door.
  ok(new URL(po.url()).pathname === '/login', `the other device is still in (${po.url()})`);
  await a.close(); await other.close();
}

await b.close();
console.log(`${pass}/${pass + fail}`);
process.exit(fail ? 1 : 0);
