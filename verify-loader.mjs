import { chromium } from '/home/user/CUE/node_modules/playwright-core/index.mjs';
// Logo splash + no arrows on buttons/links.
//   cd ../cahyana-api && node tools/driver-dev-server.js   (4598)
//   CAHYANA_API=http://127.0.0.1:4598/api npx next start -p 3102
const DASH = process.env.DASH || 'http://localhost:3102';
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log('  FAIL:', m)); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ARROW = 'svg.lucide-arrow-right,svg.lucide-arrow-left,svg.lucide-arrow-up-right,svg.lucide-chevron-right,svg.lucide-chevron-left,svg.lucide-external-link,svg.lucide-move-right,svg.lucide-arrow-up,svg.lucide-arrow-down';
for (const w of [1280, 390]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 844 }, hasTouch: w < 993, isMobile: w < 993 });
  await ctx.addInitScript(() => { try { sessionStorage.setItem('cahyana_driver_push_later', '1'); } catch {} });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  const tag = `@${w}`;
  // login page: splash exists with logo, then leaves
  await page.goto(DASH + '/login', { waitUntil: 'commit' });
  await page.waitForSelector('[data-loading-screen]', { state: 'attached' });
  const logo = await page.evaluate(async () => { const i = document.querySelector('[data-loading-screen] img'); if (i && !i.complete) await new Promise((r) => { i.onload = r; i.onerror = r; }); return i ? { w: i.naturalWidth, shown: i.getBoundingClientRect().width } : null; });
  ok(logo && logo.w > 0 && logo.shown > 100, `${tag}: splash logo missing or not loaded (${JSON.stringify(logo)})`);
  await page.waitForFunction(() => { const s = getComputedStyle(document.querySelector('[data-loading-screen]')); return s.visibility === 'hidden' && s.pointerEvents === 'none'; }, null, { timeout: 5000 }).catch(() => {});
  const gone = await page.evaluate(() => { const s = getComputedStyle(document.querySelector('[data-loading-screen]')); return s.visibility === 'hidden' && s.pointerEvents === 'none'; });
  ok(gone, `${tag}: splash never left`);
  await page.fill('#adm-user', 'owner'); await page.fill('#adm-pass', 'pw'); await page.click('button[type=submit]');
  await page.waitForURL((u) => new URL(u).pathname === '/', { timeout: 10000 });
  await page.waitForLoadState('networkidle'); await sleep(900);
  ok(await page.locator(ARROW).count() === 0, `${tag}: arrow icons on landing`);
  // same-origin link click re-shows the splash
  const p = page.waitForNavigation({ timeout: 8000 }).catch(() => null);
  await page.click('[data-tile=cue]');
  const shownOnClick = await page.evaluate(() => getComputedStyle(document.querySelector('[data-loading-screen]')).opacity).catch(() => null);
  await p; await page.waitForLoadState('networkidle'); await sleep(900);
  ok(shownOnClick === '1' || shownOnClick === null, `${tag}: splash not shown on link click (opacity ${shownOnClick})`);
  for (const t of ['bookings', 'dispatch', 'drivers', 'content', 'settings', 'chat']) {
    await page.goto(`${DASH}/cue?tab=${t}`, { waitUntil: 'networkidle' }); await sleep(900);
    const n = await page.locator(ARROW).count();
    ok(n === 0, `${tag}: ${n} arrow icon(s) on /cue?tab=${t}`);
    const sw = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    ok(sw <= 0, `${tag}: ${t} overflows ${sw}`);
  }
  // mobile rail list rows + back
  await page.goto(`${DASH}/cue`, { waitUntil: 'networkidle' }); await sleep(900);
  ok(await page.locator(ARROW).count() === 0, `${tag}: arrow on /cue`);
  ok(errs.length === 0, `${tag}: page errors ${errs.join('|')}`);
  await ctx.close();
}
// driver app
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await ctx.addInitScript(() => { try { sessionStorage.setItem('cahyana_driver_push_later', '1'); } catch {} });
  const page = await ctx.newPage();
  await fetch('http://127.0.0.1:4598/api/admin/drivers', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Basic ' + Buffer.from('owner:pw').toString('base64') }, body: JSON.stringify({ name: 'Ldr', phone: '+62 8', username: 'ldry', password: 'loader-pass-1' }) });
  await page.goto(DASH + '/driver/login', { waitUntil: 'networkidle' });
  await page.fill('#drv-user', 'ldry'); await page.fill('#drv-pass', 'loader-pass-1'); await page.click('button[type=submit]');
  await page.waitForURL((u) => new URL(u).pathname === '/driver', { timeout: 10000 });
  for (const t of ['jobs', 'account']) { await page.goto(`${DASH}/driver?tab=${t}`, { waitUntil: 'networkidle' }); await sleep(900); ok(await page.locator(ARROW).count() === 0, `driver ${t}: arrows`); }
  await ctx.close();
}
await b.close();
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
