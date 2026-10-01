import { chromium } from '/home/user/CUE/node_modules/playwright-core/index.mjs';

// DASHBOARD BRIEF #11: the "update available" prompt, owner dashboard + driver app.
//   cd ../cahyana-api && node tools/driver-dev-server.js                 (4598)
//   CAHYANA_API=http://127.0.0.1:4598/api npx next start -p 3102
//   node verify-update.mjs
// The build the page is RUNNING is inlined at build time; what the server is
// serving NOW is /api/build. We answer that route ourselves to play "a new
// deploy went out" - a second real build is not needed to test the browser side.
const DASH = process.env.DASH || 'http://localhost:3102';
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log('  FAIL:', m)); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

// What the real route says (the build that is being served by this very server).
const real = await (await fetch(DASH + '/api/build')).json();
ok(/\S/.test(real.id || ''), `/api/build gave no id (${JSON.stringify(real)})`);
ok((await fetch(DASH + '/api/build')).headers.get('cache-control')?.includes('no-store'), '/api/build is cacheable');

for (const [label, w, signIn] of [['owner', 1280, 'owner'], ['owner', 390, 'owner'], ['driver', 390, 'driver']]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 844 }, hasTouch: w < 993, isMobile: w < 993 });
  await ctx.addInitScript(() => { try { sessionStorage.setItem('cahyana_driver_push_later', '1'); } catch {} });
  const page = await ctx.newPage();
  let answer = null;              // null = let the real route answer
  let calls = 0;
  await page.route('**/api/build', async (route) => {
    calls++;
    if (answer === null) return route.continue();
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: answer }) });
  });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  const tag = `${label}@${w}`;

  if (signIn === 'owner') {
    await page.goto(DASH + '/login', { waitUntil: 'networkidle' });
    await page.fill('#adm-user', 'owner'); await page.fill('#adm-pass', 'pw'); await page.click('button[type=submit]');
    await page.waitForURL((u) => new URL(u).pathname === '/', { timeout: 10000 });
  } else {
    await fetch('http://127.0.0.1:4598/api/admin/drivers', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Basic ' + Buffer.from('owner:pw').toString('base64') }, body: JSON.stringify({ name: 'Upd', phone: '+62 8', username: 'updy', password: 'update-pass-1' }) });
    await page.goto(DASH + '/driver/login', { waitUntil: 'networkidle' });
    await page.fill('#drv-user', 'updy'); await page.fill('#drv-pass', 'update-pass-1'); await page.click('button[type=submit]');
    await page.waitForURL((u) => new URL(u).pathname === '/driver', { timeout: 10000 });
  }
  await page.waitForLoadState('networkidle'); await sleep(800);
  const bar = page.locator('[data-update-prompt]');

  // 1. same build: asked, said nothing.
  ok(calls >= 1, `${tag}: never asked the server which build is live`);
  ok(await bar.count() === 0, `${tag}: banner showed although the build is current`);

  // 2. a new deploy goes out; the app comes back to the foreground.
  answer = 'a-newer-build-id';
  const before = calls;
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await bar.waitFor({ timeout: 5000 }).catch(() => {});
  ok(calls > before, `${tag}: foregrounding did not re-check`);
  ok(await bar.count() === 1, `${tag}: no banner after a new build went out`);
  if (await bar.count()) {
    ok(/Update available/.test(await bar.innerText()), `${tag}: banner text "${await bar.innerText()}"`);
    const r = await bar.evaluate((e) => { const x = e.getBoundingClientRect(); return { l: x.left, r: x.right, b: x.bottom, w: x.width }; });
    ok(r.l >= 0 && r.r <= w, `${tag}: banner leaves the screen (${r.l}..${r.r} of ${w})`);
    // not on top of the phone tab bar
    if (w < 993) {
      const tab = await page.evaluate(() => { const n = document.querySelector('nav[aria-label="App"], nav.fixed.bottom-0, [data-appbar]'); return n ? n.getBoundingClientRect().top : null; });
      if (tab !== null && tab > 100) ok(r.b <= tab + 1, `${tag}: banner covers the tab bar (${r.b} > ${tab})`);
    }
    ok(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 0, `${tag}: page grew sideways`);

    // 3. tap = reload to the new build
    answer = null;
    const nav = page.waitForNavigation({ timeout: 8000 }).then(() => true).catch(() => false);
    await page.locator('[data-update-refresh]').click();
    ok(await nav, `${tag}: Refresh did not reload the page`);
    await page.waitForLoadState('networkidle'); await sleep(500);
    ok(await page.locator('[data-update-prompt]').count() === 0, `${tag}: banner survived the reload`);
  }

  // 4. offline / failing route: no banner, no error
  answer = null;
  await page.route('**/api/build', (route) => route.abort());
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await sleep(600);
  ok(await page.locator('[data-update-prompt]').count() === 0, `${tag}: banner appeared when the check failed`);
  ok(errs.length === 0, `${tag}: page errors ${errs.slice(0, 2).join(' | ')}`);
  await ctx.close();
}

// 5. the sign-in pages carry it too (the installed app can sit on /login)
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.route('**/api/build', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"id":"newer"}' }));
  for (const p of ['/login', '/driver/login']) {
    await page.goto(DASH + p, { waitUntil: 'networkidle' }); await sleep(800);
    ok(await page.locator('[data-update-prompt]').count() === 1, `${p}: no update banner on the sign-in page`);
  }
  await ctx.close();
}
await b.close();
console.log(`${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
