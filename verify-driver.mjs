import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '/home/user/CUE/node_modules/playwright-core/index.mjs';

// DASHBOARD BRIEF #7: the driver app, the owner's Drivers + Dispatch sections,
// and the driver chat - end to end, against the REAL cahyana-api on a REAL
// throwaway Postgres (tools/driver-dev-server.js in the API repo):
//
//   cd ../cahyana-api && PUSH_LOG=<file> node tools/driver-dev-server.js     (port 4598)
//   CAHYANA_API=http://127.0.0.1:4598/api npx next start -p 3102
//   PUSH_LOG=<same file> node verify-driver.mjs
//
// RESTART BOTH before every run: the drivers are created fresh each time, and
// sign-ins are rate limited per process.
//
// The look is measured against the OWNER'S dashboard in the same browser at the
// same width - the brief asks for "the same design language", so the reference
// is the app beside it, not numbers typed here.
const DASH = process.env.DASH || 'http://localhost:3102';
const PUSH_LOG = process.env.PUSH_LOG || '/tmp/cahyana-driver-pushes.jsonl';
const ENDPOINT = 'https://push.example/made-phone';

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log('  FAIL:', m)); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pushes = () => readFileSync(PUSH_LOG, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const text = (page, sel) => page.locator(sel).first().innerText({ timeout: 4000 }).catch(() => '');

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

// The picker now reads "Made - No reviews yet" (brief #8), so options are found by prefix.
const optionStartingWith = (sel, prefix) => sel.evaluate((el, p) => [...el.options].find((o) => o.text.startsWith(p))?.value, prefix);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errs = [];
const watch = (page, tag) => page.on('pageerror', (e) => errs.push(`${tag}: ${e.message}`));

// ===== 0. signed out: the gate and nothing else =====
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  watch(page, 'gate');
  await page.goto(DASH + '/driver', { waitUntil: 'networkidle' });
  ok(new URL(page.url()).pathname === '/driver/login', `signed-out /driver landed on ${page.url()}`);
  ok(await page.locator('[data-driver-login]').count() === 1, 'no driver sign-in form');
  ok(await page.locator('[data-driver-app], [data-jobs], nav[aria-label="Sections"]').count() === 0, 'app chrome visible before sign-in');
  ok(!/sign up|create account|register/i.test(await page.locator('body').innerText()), 'a self-signup path is offered');
  const head = await page.evaluate(() => ({
    manifest: document.querySelector('link[rel=manifest]')?.getAttribute('href'),
    title: document.querySelector('meta[name="apple-mobile-web-app-title"]')?.content,
    apple: document.querySelector('link[rel=apple-touch-icon]')?.getAttribute('href'),
  }));
  ok(head.manifest === '/driver.webmanifest' && head.title === 'Driver' && /driver-apple-touch-icon/.test(head.apple), `driver head ${JSON.stringify(head)}`);
  const man = await (await fetch(DASH + '/driver.webmanifest')).json().catch(() => null);
  ok(man && man.start_url === '/driver' && man.scope === '/driver' && man.id === '/driver' && man.name === 'Cahyana Driver', `driver manifest ${JSON.stringify(man)}`);
  const own = await (await fetch(DASH + '/manifest.webmanifest')).json().catch(() => null);
  ok(own && own.start_url === '/' && own.name === 'Cahyana Dashboard', 'owner manifest changed or unreachable signed out');
  for (const p of man ? man.icons.map((i) => i.src) : []) ok((await fetch(DASH + p)).status === 200, `icon ${p} not reachable signed out`);
  ok(await page.locator('[data-install-hint]').count() === 1, 'no Home Screen hint on the sign-in page');
  // wrong password: the API's one answer
  await page.fill('#drv-user', 'nobody'); await page.fill('#drv-pass', 'whatever-123'); await page.click('button[type=submit]');
  await page.locator('[data-driver-login] [role=alert]').waitFor({ timeout: 8000 }).catch(() => {});
  const wrong = await text(page, '[data-driver-login] [role=alert]');
  ok(/Wrong username or password/.test(wrong), `wrong sign-in answer "${wrong}"`);
  // API routes refuse a cookie-less caller
  ok((await fetch(DASH + '/api/driver/jobs')).status === 401, '/api/driver/jobs answered without a driver cookie');
  ok((await fetch(DASH + '/api/driver/../drivers')).status !== 200, 'path games reached an owner route');
  await ctx.close();
}

// ===== 1. owner: sign in, create two drivers =====
let OWNER, madePw;
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  watch(page, 'owner');
  await page.goto(DASH + '/login', { waitUntil: 'networkidle' });
  await page.fill('#adm-user', 'owner'); await page.fill('#adm-pass', 'pw'); await page.click('button[type=submit]');
  const landed = await page.waitForURL((u) => new URL(u).pathname === '/', { timeout: 20000 }).then(() => true).catch(() => false);
  if (!landed) { console.log('  FAIL: owner sign-in (restart both servers)'); process.exit(1); }
  OWNER = await ctx.storageState();
  await page.goto(DASH + '/cue', { waitUntil: 'networkidle' }); // sign-in lands on the tiles (brief #8)
  // An owner phone with push on, straight through the API, so the owner pushes
  // (driver message, decline) have somewhere to go.
  await fetch(DASH.replace(/:\d+$/, ':4598') + '/api/admin/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Basic ' + Buffer.from('owner:pw').toString('base64') },
    body: JSON.stringify({ subscription: { endpoint: 'https://push.example/owner-phone', keys: { p256dh: 'BOwner' + 'x'.repeat(60), auth: 'ownerAuth1234567' } } }),
  });

  await page.locator('aside button', { hasText: 'Drivers' }).first().click();
  await page.locator('[data-driver-create]').waitFor({ timeout: 8000 });
  const add = async (name, user, pass) => {
    await page.fill('#drv-name', name); await page.fill('#drv-phone', '+62 812 0000 111'); await page.fill('#drv-user', user); await page.fill('#drv-pass', pass);
    await page.click('[data-driver-create] button[type=submit]');
    await page.locator('[data-new-password]').waitFor({ timeout: 8000 });
    const out = { user: await text(page, '[data-secret-user]'), pass: await text(page, '[data-secret-pass]') };
    await page.locator('[data-new-password] button', { hasText: 'Done' }).click();
    return out;
  };
  const w = await add('Wayan', 'wayan', 'wayan-drives-1');
  ok(w.user === 'wayan' && w.pass === 'wayan-drives-1', `own password shown once ${JSON.stringify(w)}`);
  // DASHBOARD BRIEF #11: phone and password are required, and there is no generated-password path.
  ok(await page.locator('#drv-phone').getAttribute('required') !== null, 'phone field is not required');
  ok(await page.locator('#drv-pass').getAttribute('required') !== null, 'password field is not required');
  ok(!/optional|generate/i.test(await text(page, '[data-driver-create]')), 'the add form still mentions optional / generated');
  ok(await page.locator('#drv-pass').getAttribute('placeholder') === null, 'password placeholder offers a way to leave it empty');
  await page.fill('#drv-name', 'Nobody'); await page.fill('#drv-user', 'nobody1'); await page.fill('#drv-pass', 'long-enough-1');
  await page.click('[data-driver-create] button[type=submit]');
  await page.waitForTimeout(500);
  ok(await page.locator('[data-new-password]').count() === 0 && await page.locator('[data-driver]').count() === 1, 'a driver with no phone was created');
  await page.fill('#drv-phone', '+62 812'); await page.fill('#drv-pass', '');
  await page.click('[data-driver-create] button[type=submit]');
  await page.waitForTimeout(500);
  ok(await page.locator('[data-new-password]').count() === 0 && await page.locator('[data-driver]').count() === 1, 'a driver with no password was created');
  await page.fill('#drv-name', ''); await page.fill('#drv-user', ''); await page.fill('#drv-phone', ''); await page.fill('#drv-pass', '');
  const m = await add('Made', 'made', 'made-drives-1');
  madePw = m.pass;
  ok(m.pass === 'made-drives-1', `owner-typed password echoed once ${m.pass}`);
  ok(await page.locator('[data-new-password]').count() === 0, 'the password stayed on screen after Done');
  ok(await page.locator('[data-driver]').count() === 2, 'two driver cards');
  // duplicate refused, visibly
  await page.fill('#drv-name', 'Made 2'); await page.fill('#drv-phone', '+62 8'); await page.fill('#drv-pass', 'another-pass-1'); await page.fill('#drv-user', 'made'); await page.click('[data-driver-create] button[type=submit]');
  ok(/taken/.test(await text(page, '[data-driver-create] [role=alert]')), 'duplicate username not refused on screen');

  // ===== 2. dispatch =====
  await page.locator('aside button', { hasText: 'Dispatch' }).first().click();
  await page.locator('[data-dispatch]').waitFor({ timeout: 8000 });
  const refs = await page.locator('[data-dispatch-group]').evaluateAll((els) => els.map((e) => e.dataset.dispatchGroup));
  ok(refs.includes('CUE-901') && refs.includes('CUE-902'), `confirmed bookings listed ${refs}`);
  ok(!refs.includes('CUE-903'), 'PENDING booking offered for dispatch');
  ok(!refs.includes('CUE-904'), 'PAST booking offered for dispatch');
  const g = page.locator('[data-dispatch-group="CUE-901"]');
  ok(await g.locator('[data-dispatch-row]').count() === 2, 'two days in CUE-901');
  ok(/Unassigned/i.test(await g.locator('[data-row-status]').first().innerText()), 'new booking not shown Unassigned');
  writeFileSync(PUSH_LOG, '');
  await g.locator('[data-group-driver]').selectOption({ value: await optionStartingWith(g.locator('[data-group-driver]'), 'Made') });
  await g.locator('[data-group-note]').fill('Meet at the lobby');
  await g.locator('[data-group-assign]').click();
  await page.waitForFunction(() => /Waiting - Made/.test(document.querySelector('[data-dispatch-group="CUE-901"]')?.innerText || ''), null, { timeout: 8000 }).catch(() => {});
  ok(/Sent to Made/.test(await text(page, '[data-dispatch] [role=status]')), 'no confirmation after assigning');
  await page.locator('[data-filter="all"]').click();
  const st = await page.locator('[data-dispatch-group="CUE-901"] [data-row-status]').allInnerTexts();
  ok(st.length === 2 && st.every((s) => /Waiting - Made/i.test(s)), `CUE-901 statuses ${st}`);
  // CUE-902 to Made as well (he will decline it)
  const g2 = page.locator('[data-dispatch-group="CUE-902"]');
  await g2.locator('[data-group-driver]').selectOption({ value: await optionStartingWith(g2.locator('[data-group-driver]'), 'Made') });
  await g2.locator('[data-group-assign]').click();
  await sleep(800);
  await ctx.close();
}

// ===== 3. driver: sign in, the firm push ask, jobs =====
let MADE;
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.grantPermissions(['notifications'], { origin: new URL(DASH).origin });
  await ctx.addInitScript(fakePush, ENDPOINT);
  const page = await ctx.newPage();
  watch(page, 'made');
  await page.goto(DASH + '/driver/login', { waitUntil: 'networkidle' });
  await page.fill('#drv-user', 'MADE'); await page.fill('#drv-pass', madePw); await page.click('button[type=submit]');
  const landed = await page.waitForURL((u) => new URL(u).pathname === '/driver', { timeout: 20000 }).then(() => true).catch(() => false);
  ok(landed, 'driver sign-in did not land on /driver');
  MADE = await ctx.storageState();

  // The gate: over everything, and it is a real dialog.
  const gate = page.locator('[data-push-gate]');
  ok(await gate.waitFor({ timeout: 8000 }).then(() => true).catch(() => false), 'NO push prompt after sign-in');
  const covers = await page.evaluate(() => {
    const g = document.querySelector('[data-push-gate]');
    if (!g) return false;
    const r = g.getBoundingClientRect();
    const hit = document.elementFromPoint(window.innerWidth / 2, window.innerHeight - 30);
    return r.width >= window.innerWidth - 1 && r.height >= window.innerHeight - 1 && g.contains(hit);
  });
  ok(covers, 'the push prompt does not cover the app (the tab bar is still tappable)');
  const attr = (n) => gate.getAttribute(n, { timeout: 2000 }).catch(() => null);
  ok(await attr('role') === 'dialog' && await attr('aria-modal') === 'true', 'push prompt is not a modal dialog');
  // "Not now" lasts this session only.
  await page.click('[data-gate-later]', { timeout: 3000 }).catch(() => {});
  ok(await gate.count() === 0, '"Not now" did not close the prompt');
  ok(await page.locator('[data-push-off]').count() === 1, 'no red reminder after "Not now"');
  await page.reload({ waitUntil: 'networkidle' });
  await sleep(600);
  ok(await page.locator('[data-push-gate]').count() === 0, 'prompt came back within the same session');
  // A new app launch = a new session: it asks again.
  const page2 = await ctx.newPage();
  await page2.goto(DASH + '/driver', { waitUntil: 'networkidle' });
  ok(await page2.locator('[data-push-gate]').waitFor({ timeout: 8000 }).then(() => true).catch(() => false), 'prompt did not come back on the next launch');
  writeFileSync(PUSH_LOG, '');
  await page2.click('[data-gate-enable]', { timeout: 3000 }).catch(() => {});
  ok(await page2.locator('[data-push-gate]').waitFor({ state: 'detached', timeout: 8000 }).then(() => true).catch(() => false), 'prompt stayed after turning alerts on');
  ok(await page2.locator('[data-push-off]').count() === 0, 'red reminder stayed after turning alerts on');
  await page2.close();

  // Jobs
  await page.goto(DASH + '/driver', { waitUntil: 'networkidle' });
  await page.locator('[data-jobs]').waitFor({ timeout: 8000 });
  ok(await page.locator('[data-push-gate]').count() === 0, 'prompt shown to a phone that already has alerts');
  const jobs = await page.locator('[data-job]').count();
  ok(jobs === 3, `made sees ${jobs} jobs, expected 3 (2 x CUE-901 + CUE-902)`);
  const body = await page.locator('[data-jobs]').innerText();
  ok(/Andras S\./.test(body) && !/Szabo/.test(body), 'guest name not shortened to first + initial');
  ok(!/guest@example\.com/.test(body) && !/@/.test(body), 'a guest email reached the driver page');
  ok(!/Rp|IDR|USD|\$|700/.test(body), 'a price reached the Bookings tab');
  ok(/Meet at the lobby/.test(body), 'owner note missing');
  ok(/QZ 512/.test(body), 'flight number missing on the airport job');
  ok(await page.locator('[data-job] a[href^="tel:"]').count() === 3, 'phone not tappable');
  ok(await page.locator('[data-accept-all]').count() === 1, 'no Accept all for several new jobs');

  // accept one, decline the airport job
  const first = page.locator('[data-job]').filter({ hasText: 'Ubud Tour' }).first();
  await first.locator('[data-accept]').click();
  await page.waitForFunction(() => /Accepted\. Cahyana/.test(document.querySelector('[data-jobs] [role=status]')?.innerText || ''), null, { timeout: 8000 }).catch(() => {});
  await page.waitForFunction(() => [...document.querySelectorAll('[data-job]')].some((j) => /Ubud Tour/.test(j.innerText) && /^accepted$/i.test(j.querySelector('[data-job-status]')?.innerText.trim())), null, { timeout: 8000 }).catch(() => {});
  const acc = await page.locator('[data-job]').filter({ hasText: 'Ubud Tour' }).first().locator('[data-job-status]').innerText();
  ok(/^Accepted$/i.test(acc.trim()), `accepted job shows "${acc}"`);
  page.once('dialog', (d) => d.accept());
  await page.locator('[data-job]').filter({ hasText: 'QZ 512' }).locator('[data-decline]').click();
  await page.waitForFunction(() => !/QZ 512/.test(document.querySelector('[data-jobs]')?.innerText || ''), null, { timeout: 8000 }).catch(() => {});
  ok(!/QZ 512/.test(await page.locator('[data-jobs]').innerText()), 'declined job still on the list');
  await sleep(400);
  ok(pushes().some((p) => p.endpoint === 'https://push.example/owner-phone' && p.payload.tab === 'dispatch' && /declined/.test(p.payload.title)), `owner not pushed about the decline ${JSON.stringify(pushes())}`);
  ok(!JSON.stringify(pushes()).includes('Maria'), 'guest name in a push');
  // a declined dialog cancel keeps the job
  page.once('dialog', (d) => d.dismiss());
  await page.locator('[data-job]').filter({ hasText: 'Kecak' }).locator('[data-decline]').click();
  await sleep(500);
  ok(/Kecak/.test(await page.locator('[data-jobs]').innerText()), 'cancelling the decline dialog still declined');

  // Earnings
  await page.locator('nav[aria-label="Sections"] button', { hasText: 'Earnings' }).click();
  await page.locator('[data-earnings]').waitFor({ timeout: 8000 });
  const labels = await page.locator('[data-earnings-chart] svg text').allTextContents();
  const monthLabels = labels.filter((t) => /^[A-Z][a-z]{2}$/.test(t));
  ok(monthLabels.length === 12, `chart has ${monthLabels.length} month labels`);
  const sched = await page.locator('[data-bar-scheduled]').count();
  ok(sched >= 1, 'no scheduled bar for the accepted upcoming jobs');
  const barShape = await page.evaluate(() => {
    const el = document.querySelector('[data-bar-scheduled]');
    const r = el && el.getBoundingClientRect();
    return r ? { w: r.width, fill: el.getAttribute('fill') } : null;
  });
  ok(barShape && barShape.w <= 24.5 && barShape.w > 4, `bar width ${barShape && barShape.w}`);
  await page.locator('[data-bar-hit]').last().hover();
  await page.locator('[data-bar-hit]').nth(11).hover();
  const tip = await text(page, '[data-chart-tip]');
  ok(/Scheduled Rp/.test(tip) || /Earned Rp/.test(tip), `tooltip reads "${tip}"`);
  const total = (await text(page, '[data-earnings]'));
  ok(/1\.100\.000|700\.000|400\.000/.test(total), 'earnings do not carry the full program price');
  ok(await page.locator('[data-month-row]').count() >= 1, 'no month-by-month table');

  // Chat to the owner
  await page.locator('[data-nav-chat]').click();
  await page.locator('[data-thread]').waitFor({ timeout: 8000 });
  writeFileSync(PUSH_LOG, '');
  await page.fill('[data-thread-input]', 'Lobby or gate?');
  await page.press('[data-thread-input]', 'Enter');
  await page.waitForFunction(() => /Lobby or gate\?/.test(document.querySelector('[data-chatbody]')?.innerText || ''), null, { timeout: 8000 }).catch(() => {});
  ok(/Lobby or gate\?/.test(await text(page, '[data-chatbody]')), 'driver message not shown');
  await sleep(500);
  ok(pushes().some((p) => p.payload.tab === 'chat' && /Message from a driver/.test(p.payload.title)), `owner not pushed about the driver message ${JSON.stringify(pushes())}`);
  ok(errs.length === 0, `page errors: ${errs.join(' | ')}`);
  await ctx.close();
}

// ===== 4. owner sees the decline + the message, replies =====
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, storageState: OWNER });
  const page = await ctx.newPage();
  watch(page, 'owner2');
  await page.goto(DASH + '/?tab=dispatch', { waitUntil: 'networkidle' });
  await page.locator('[data-dispatch]').waitFor({ timeout: 8000 });
  ok(/Declined by Made/i.test(await page.locator('[data-dispatch-group="CUE-902"]').innerText().catch(() => '')), 'decline not visible in Dispatch');
  const statuses = await page.locator('[data-dispatch-group="CUE-901"]').innerText().catch(() => '');
  // CUE-901 is fully assigned, so it only shows under "All upcoming"
  await page.locator('[data-filter="all"]').click();
  ok(/Accepted - Made/i.test(await page.locator('[data-dispatch-group="CUE-901"]').innerText()), `accept not visible in Dispatch ${statuses}`);
  ok((await page.locator('[data-nav-chat] span').innerText().catch(() => '')).trim() === '1', 'navbar chat badge does not count the driver message');
  await page.locator('[data-nav-chat]').click();
  await page.locator('[data-chat-who="drivers"]').click();
  await page.locator('[data-driver-chats]').waitFor({ timeout: 8000 });
  await page.locator('[data-driver-thread]', { hasText: 'Made' }).click();
  await page.locator('[data-thread]').waitFor({ timeout: 8000 });
  await page.waitForFunction(() => /Lobby or gate\?/.test(document.querySelector('[data-chatbody]')?.innerText || ''), null, { timeout: 8000 }).catch(() => {});
  ok(/Lobby or gate\?/.test(await text(page, '[data-chatbody]')), `owner does not see the driver message: "${await text(page, '[data-thread]')}"`);
  writeFileSync(PUSH_LOG, '');
  await page.fill('[data-thread-input]', 'Lobby, 8:20');
  await page.press('[data-thread-input]', 'Enter');
  await sleep(800);
  ok(pushes().some((p) => p.endpoint === ENDPOINT && p.payload.url === '/driver?tab=chat'), `driver not pushed about the reply ${JSON.stringify(pushes())}`);
  // The booking card names the driver
  await page.goto(DASH + '/?tab=upcoming', { waitUntil: 'networkidle' });
  await sleep(800);
  ok(/driver Made \(accepted\)/.test(await page.locator('body').innerText()), 'booking card does not name the driver');
  await ctx.close();
}

// ===== 5. the worker shows a driver push and opens the driver app =====
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, storageState: MADE });
  await ctx.grantPermissions(['notifications'], { origin: new URL(DASH).origin });
  const page = await ctx.newPage();
  await page.goto(DASH + '/driver', { waitUntil: 'networkidle' });
  await page.evaluate(() => navigator.serviceWorker.ready);
  const cdp = await ctx.newCDPSession(page);
  let regId = null;
  cdp.on('ServiceWorker.workerRegistrationUpdated', (e) => {
    for (const r of e.registrations) if (!r.isDeleted && r.scopeURL.startsWith(new URL(DASH).origin)) regId = r.registrationId;
  });
  await cdp.send('ServiceWorker.enable');
  await sleep(600);
  ok(!!regId, 'no service worker on the driver app');
  if (regId) {
    await cdp.send('ServiceWorker.deliverPushMessage', { origin: new URL(DASH).origin, registrationId: regId, data: JSON.stringify({ title: 'New job assigned', body: 'CUE-901 · Ubud Tour', url: '/driver?tab=bookings', tag: 'driver-bookings' }) });
    // a payload pointing anywhere else must not be honoured
    await cdp.send('ServiceWorker.deliverPushMessage', { origin: new URL(DASH).origin, registrationId: regId, data: JSON.stringify({ title: 'x', url: 'https://evil.example/', tag: 'evil' }) });
    await sleep(900);
    const shown = await page.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications()).map((n) => ({ title: n.title, icon: n.icon, tag: n.tag, url: n.data && n.data.url })));
    const n = shown.find((x) => x.tag === 'driver-bookings');
    ok(n && n.url === '/driver?tab=bookings' && /driver-icon-192\.png$/.test(n.icon), `driver notification ${JSON.stringify(shown)}`);
    const evil = shown.find((x) => x.tag === 'evil');
    ok(evil && evil.url === '/', `foreign URL honoured: ${JSON.stringify(evil)}`);
  }
  await ctx.close();
}

// ===== 6. the two doors do not cross =====
{
  const d = await b.newContext({ storageState: MADE });
  const dp = await d.newPage();
  await dp.goto(DASH + '/', { waitUntil: 'networkidle' });
  ok(new URL(dp.url()).pathname === '/login', `a driver cookie opened the owner dashboard (${dp.url()})`);
  const r = await dp.evaluate(async () => (await fetch('/api/dispatch')).status);
  ok(r === 401, `driver cookie on /api/dispatch -> ${r}`);
  await d.close();
  const o = await b.newContext({ storageState: OWNER });
  const op = await o.newPage();
  await op.goto(DASH + '/driver', { waitUntil: 'networkidle' });
  ok(new URL(op.url()).pathname === '/driver/login', `the owner cookie opened the driver app (${op.url()})`);
  const r2 = await op.evaluate(async () => (await fetch('/api/driver/jobs')).status);
  ok(r2 === 401, `owner cookie on /api/driver/jobs -> ${r2}`);
  await o.close();
}

// ===== 7. same look as the owner's dashboard, and nothing overflows =====
for (const w of [320, 390, 768, 1280]) {
  const shape = async (state, url) => {
    const ctx = await b.newContext({ viewport: { width: w, height: 844 }, storageState: state });
    await ctx.addInitScript(() => { try { sessionStorage.setItem('cahyana_driver_push_later', '1'); } catch {} });
    const page = await ctx.newPage();
    await page.goto(DASH + url, { waitUntil: 'networkidle' });
    await sleep(500);
    const s = await page.evaluate(() => {
      const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { h: Math.round(r.height), w: Math.round(r.width), l: Math.round(r.left) }; };
      const bar = document.querySelector('nav[aria-label="Sections"]');
      const bs = bar && getComputedStyle(bar);
      const h1 = document.querySelector('h1');
      const aside = document.querySelector('aside');
      return {
        header: box(document.querySelector('[data-navbar]')),
        bar: bs && bs.display !== 'none' ? { ...box(bar), rad: bs.borderTopLeftRadius, top: bs.borderTopWidth + ' ' + bs.borderTopColor, shadow: bs.boxShadow } : null,
        cells: bar ? bar.querySelectorAll('button').length : 0,
        h1: h1 && getComputedStyle(h1).fontSize + ' ' + getComputedStyle(h1).fontWeight,
        aside: aside && getComputedStyle(aside).display !== 'none' ? box(aside) : null,
        over: document.documentElement.scrollWidth - window.innerWidth,
        logo: box(document.querySelector('[data-navbar] img')),
      };
    });
    await ctx.close();
    return s;
  };
  const own = await shape(OWNER, '/?tab=upcoming');
  for (const t of ['bookings', 'earnings', 'chat', 'account']) {
    const drv = await shape(MADE, `/driver?tab=${t}`);
    ok(drv.over <= 0, `${w} ${t}: overflows by ${drv.over}px`);
    if (t === 'account' && w === 390) {
      const dctx = await b.newContext({ viewport: { width: 390, height: 844 }, storageState: MADE });
      await dctx.addInitScript(() => { try { sessionStorage.setItem('cahyana_driver_push_later', '1'); } catch {} });
      const dpg = await dctx.newPage();
      await dpg.goto(DASH + '/driver?tab=account', { waitUntil: 'networkidle' });
      await dpg.locator('[data-push-gate]').waitFor({ timeout: 3000 }).then(() => dpg.getByRole('button', { name: /not now/i }).click()).catch(() => {});
      await dpg.locator('[data-account]').waitFor({ timeout: 6000 }).catch(() => {});
      ok(await dpg.locator('#pw-cur, #pw-next').count() === 0, 'driver account still has a change-password form');
      const pr = await dpg.evaluate(async () => (await fetch('/api/driver/password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"current":"x","next":"yyyyyyyy"}' })).status);
      ok(pr === 404, `driver password route answered ${pr}`);
      await dctx.close();
    }
    if (t !== 'bookings') continue;
    ok(JSON.stringify(drv.header) === JSON.stringify(own.header), `${w}: header ${JSON.stringify(drv.header)} vs owner ${JSON.stringify(own.header)}`);
    ok(JSON.stringify(drv.logo) === JSON.stringify(own.logo), `${w}: logo ${JSON.stringify(drv.logo)} vs owner ${JSON.stringify(own.logo)}`);
    ok(drv.h1 === own.h1, `${w}: h1 ${drv.h1} vs owner ${own.h1}`);
    if (w <= 992) {
      ok(drv.bar && own.bar && drv.bar.h === own.bar.h && drv.bar.rad === own.bar.rad && drv.bar.top === own.bar.top && drv.bar.shadow === own.bar.shadow,
        `${w}: tab bar ${JSON.stringify(drv.bar)} vs owner ${JSON.stringify(own.bar)}`);
      ok(drv.cells === 4, `${w}: driver tab bar has ${drv.cells} tabs`);
    } else {
      ok(!drv.bar, `${w}: tab bar showing on desktop`);
      ok(drv.aside && own.aside && drv.aside.w === own.aside.w && drv.aside.l === own.aside.l, `${w}: rail ${JSON.stringify(drv.aside)} vs owner ${JSON.stringify(own.aside)}`);
    }
  }
}

// ===== 8. deactivate = signed out now =====
{
  const o = await b.newContext({ viewport: { width: 1280, height: 900 }, storageState: OWNER });
  const op = await o.newPage();
  await op.goto(DASH + '/?tab=drivers', { waitUntil: 'networkidle' });
  op.once('dialog', (d) => d.accept());
  await op.locator('[data-driver="made"] [data-toggle-active]').click();
  await op.waitForFunction(() => /Deactivated/i.test(document.querySelector('[data-driver="made"]')?.innerText || ''), null, { timeout: 8000 }).catch(() => {});
  ok(/Deactivated/i.test(await op.locator('[data-driver="made"]').innerText()), 'driver card not shown deactivated');
  await o.close();
  const d = await b.newContext({ viewport: { width: 390, height: 844 }, storageState: MADE });
  const dp = await d.newPage();
  await dp.goto(DASH + '/driver', { waitUntil: 'networkidle' });
  await dp.waitForURL((u) => new URL(u).pathname === '/driver/login', { timeout: 10000 }).catch(() => {});
  ok(new URL(dp.url()).pathname === '/driver/login', `deactivated driver still in the app (${dp.url()})`);
  await d.close();
}

ok(errs.length === 0, `page errors: ${errs.join(' | ')}`);
await b.close();
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
