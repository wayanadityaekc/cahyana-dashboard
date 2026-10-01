import { chromium } from '/home/user/CUE/node_modules/playwright-core/index.mjs';

// DASHBOARD BRIEF #9: (1) no field under 16px on phones (iOS zooms on focus),
// desktop untouched; (2) the page behind any popup does not scroll.
//   cd ../cahyana-api && node tools/driver-dev-server.js            (4598)
//   CAHYANA_API=http://127.0.0.1:4598/api npx next start -p 3102
//   node verify-mobile.mjs
const DASH = process.env.DASH || 'http://localhost:3102';
const API = process.env.API || 'http://127.0.0.1:4598/api';
const BASIC = 'Basic ' + Buffer.from('owner:pw').toString('base64');
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log('  FAIL:', m)); };

const fieldSizes = (page) => page.evaluate(() =>
  [...document.querySelectorAll('input, select, textarea')]
    .filter((e) => !['checkbox', 'radio', 'range', 'hidden'].includes(e.type))
    .map((e) => ({ id: e.id || e.name || e.tagName, px: parseFloat(getComputedStyle(e).fontSize) })));

(async () => {
  await fetch(API + '/admin/drivers', { method: 'POST', headers: { Authorization: BASIC, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Zoom Test', username: 'zoomy', password: 'zoom-pass-123' }) });
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const errs = [];

  for (const [w, label] of [[390, 'phone'], [768, 'tablet'], [1280, 'desktop']]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 800 }, hasTouch: w < 993, isMobile: w < 993 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errs.push(e.message));
    const check = async (where) => {
      const f = await fieldSizes(page);
      ok(f.length > 0, `${label} ${where}: no fields found (harness lost the page)`);
      for (const x of f) {
        if (w < 993) ok(x.px >= 16, `${label} ${where}: ${x.id} is ${x.px}px (iOS zooms under 16)`);
        else ok(Math.abs(x.px - 12.8) < 0.1, `${label} ${where}: ${x.id} is ${x.px}px, desktop should stay 12.8`);
      }
    };

    await page.goto(DASH + '/login', { waitUntil: 'networkidle' });
    await check('/login');
    await page.fill('#adm-user', 'owner'); await page.fill('#adm-pass', 'pw'); await page.click('button[type=submit]');
    await page.waitForURL((u) => new URL(u).pathname === '/', { timeout: 10000 }).catch(() => {});
    for (const tab of ['bookings', 'prices', 'chat', 'dispatch', 'drivers', 'content', 'promo', 'settings']) {
      await page.goto(`${DASH}/cue?tab=${tab}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
      const n = (await fieldSizes(page)).length;
      if (n) await check(`/cue?tab=${tab}`);
    }
    await page.goto(DASH + '/villas', { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    if ((await fieldSizes(page)).length) await check('/villas');

    // Drawer scroll lock (phones).
    if (w < 993) {
      await page.goto(DASH + '/cue', { waitUntil: 'networkidle' });
      const ov = () => page.evaluate(() => getComputedStyle(document.body).overflow);
      ok((await ov()) !== 'hidden', 'body locked before opening the drawer');
      await page.click('[aria-label="Open menu"]');
      await page.waitForTimeout(400);
      ok((await ov()) === 'hidden', 'body NOT locked with the drawer open');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
      ok((await ov()) !== 'hidden', 'body still locked after closing the drawer');
    }
    await ctx.close();

    // Driver app: sign-in form, then the push gate dialog.
    const dctx = await browser.newContext({ viewport: { width: w, height: 800 }, hasTouch: w < 993, isMobile: w < 993 });
    const dp = await dctx.newPage();
    dp.on('pageerror', (e) => errs.push(e.message));
    await dp.goto(DASH + '/driver/login', { waitUntil: 'networkidle' });
    const f = await fieldSizes(dp);
    ok(f.length >= 2, `${label} driver login: fields missing`);
    for (const x of f) ok(w < 993 ? x.px >= 16 : Math.abs(x.px - 12.8) < 0.1, `${label} driver login ${x.id} ${x.px}px`);
    await dp.fill('#drv-user', 'zoomy'); await dp.fill('#drv-pass', 'zoom-pass-123'); await dp.click('button[type=submit]');
    await dp.waitForURL((u) => new URL(u).pathname === '/driver', { timeout: 10000 }).catch(() => {});
    const gate = dp.locator('[data-push-gate]');
    await gate.waitFor({ timeout: 6000 }).catch(() => {});
    if (await gate.count()) {
      ok((await dp.evaluate(() => getComputedStyle(document.body).overflow)) === 'hidden', `${label}: body scrolls behind the push gate`);
      const later = dp.getByRole('button', { name: /not now/i });
      if (await later.count()) {
        await later.click(); await dp.waitForTimeout(400);
        ok((await dp.evaluate(() => getComputedStyle(document.body).overflow)) !== 'hidden', `${label}: body stuck locked after the gate closed`);
      } else ok(false, `${label}: no Not now button`);
    } else ok(false, `${label}: push gate never showed`);
    await dctx.close();
  }
  ok(errs.length === 0, 'page errors: ' + errs.slice(0, 3).join(' | '));
  await browser.close();
  console.log(`${pass}/${pass + fail} passed`);
  process.exit(fail ? 1 : 0);
})();
