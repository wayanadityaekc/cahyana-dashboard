import { chromium } from '/home/user/CUE/node_modules/playwright-core/index.mjs';
// Manual "Check for updates" in owner Settings and driver Account.
//   cd ../cahyana-api && node tools/driver-dev-server.js   (4598)
//   CAHYANA_API=http://127.0.0.1:4598/api npx next start -p 3102
const DASH = process.env.DASH || 'http://localhost:3102';
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log('  FAIL:', m)); };
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const real = await (await fetch(DASH + '/api/build')).json();
for (const [who, w] of [['owner', 1280], ['owner', 390], ['driver', 390]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 844 }, hasTouch: w < 993, isMobile: w < 993 });
  await ctx.addInitScript(() => { try { sessionStorage.setItem('cahyana_driver_push_later', '1'); } catch {} });
  const page = await ctx.newPage();
  let answer = null, fail503 = false;
  await page.route('**/api/build', (r) => fail503 ? r.fulfill({ status: 503, body: '{}' }) : answer === null ? r.continue() : r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: answer }) }));
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  const tag = `${who}@${w}`;
  if (who === 'owner') {
    await page.goto(DASH + '/login', { waitUntil: 'networkidle' });
    await page.fill('#adm-user', 'owner'); await page.fill('#adm-pass', 'pw'); await page.click('button[type=submit]');
    await page.waitForURL((u) => new URL(u).pathname === '/', { timeout: 10000 });
    await page.goto(DASH + '/?tab=settings', { waitUntil: 'networkidle' });
  } else {
    await fetch('http://127.0.0.1:4598/api/admin/drivers', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Basic ' + Buffer.from('owner:pw').toString('base64') }, body: JSON.stringify({ name: 'Chk', phone: '+62 8', username: 'chky', password: 'check-pass-1' }) });
    await page.goto(DASH + '/driver/login', { waitUntil: 'networkidle' });
    await page.fill('#drv-user', 'chky'); await page.fill('#drv-pass', 'check-pass-1'); await page.click('button[type=submit]');
    await page.waitForURL((u) => new URL(u).pathname === '/driver', { timeout: 10000 });
    await page.goto(DASH + '/driver?tab=account', { waitUntil: 'networkidle' });
  }
  const btn = page.locator('[data-check-update]');
  await btn.waitFor({ timeout: 8000 }).catch(() => {});
  ok(await btn.count() === 1, `${tag}: no Check for updates button`);
  if (!await btn.count()) { await ctx.close(); continue; }
  const box = await btn.boundingBox();
  ok(box && box.x >= 0 && box.x + box.width <= w, `${tag}: button off-screen`);
  // 1. current build
  await btn.click();
  await page.locator('[data-update-status]').waitFor({ timeout: 5000 });
  await page.waitForFunction(() => /latest version/i.test(document.querySelector("[data-update-status]")?.innerText || ""), null, { timeout: 5000 }).catch(() => {}); const st = await page.locator("[data-update-status]").innerText(); ok(/latest version/i.test(st), `${tag}: current build not reported as latest (got "${st}")`);
  // 2. server unreachable
  fail503 = true; await btn.click();
  await page.waitForFunction(() => /Could not check/i.test(document.querySelector('[data-update-status]')?.innerText || ''), null, { timeout: 5000 }).catch(() => {});
  ok(/Could not check/i.test(await page.locator('[data-update-status]').innerText()), `${tag}: error not shown`);
  // 3. newer build => reloads
  fail503 = false; answer = 'a-newer-build-id';
  await page.evaluate(() => { window.__marker = 1; });
  const nav = page.waitForNavigation({ timeout: 8000 }).catch(() => null);
  await btn.click(); await nav;
  await page.waitForLoadState('networkidle');
  ok(await page.evaluate(() => window.__marker === undefined), `${tag}: page did not reload on newer build`);
  ok(errs.length === 0, `${tag}: page errors ${errs.join('|')}`);
  const sw = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  ok(sw <= 0, `${tag}: page overflows by ${sw}`);
  await ctx.close();
}
await b.close();
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
