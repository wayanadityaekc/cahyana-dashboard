// Screenshots of the main screens, phone + desktop, owner dashboard + driver app.
//   node tools/shoot.mjs <outDir>      (dev API on 4598, next start on 3102)
import { chromium } from '/home/user/CUE/node_modules/playwright-core/index.mjs';
import { mkdirSync } from 'node:fs';
const OUT = process.argv[2] || 'shots/current';
mkdirSync(OUT, { recursive: true });
const DASH = 'http://localhost:3102', API = 'http://127.0.0.1:4598/api';
const BASIC = 'Basic ' + Buffer.from('owner:pw').toString('base64');
const j = (h) => ({ 'Content-Type': 'application/json', ...h });
const call = async (p, o) => (await fetch(API + p, o)).json().catch(() => ({}));

await call('/admin/drivers', { method: 'POST', headers: j({ Authorization: BASIC }), body: JSON.stringify({ name: 'Made Wirawan', username: 'made', password: 'made-pass-123', phone: '+62 812 3456 789' }) });
const disp = await call('/admin/dispatch', { headers: { Authorization: BASIC } });
const made = disp.drivers.find((d) => d.username === 'made' || d.name.startsWith('Made'));
const ids = (ref) => disp.rows.filter((r) => r.ref === ref).map((r) => r.id);
await call('/admin/dispatch', { method: 'POST', headers: j({ Authorization: BASIC }), body: JSON.stringify({ rows: [...ids('CUE-901'), ...ids('CUE-902')], driverId: made.id, note: 'Meet at the lobby' }) });
const tok = (await call('/driver/login', { method: 'POST', headers: j(), body: JSON.stringify({ username: 'made', password: 'made-pass-123' }) })).token;
const jobs = await call('/driver/jobs', { headers: { Authorization: 'Bearer ' + tok } });
const first = (jobs.jobs || jobs.upcoming || [])[0];
if (first) await call('/driver/jobs/respond', { method: 'POST', headers: j({ Authorization: 'Bearer ' + tok }), body: JSON.stringify({ rows: [first.id], action: 'accept' }) });

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
for (const [label, w, h] of [['phone', 390, 844], ['desktop', 1280, 800]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: w < 993, isMobile: w < 993 });
  const p = await ctx.newPage();
  const snap = async (name, full = false) => { await p.waitForTimeout(700); await p.screenshot({ path: `${OUT}/${label}-${name}.png`, fullPage: full }); };
  await p.goto(DASH + '/login', { waitUntil: 'networkidle' });
  await snap('01-login');
  await p.fill('#adm-user', 'owner'); await p.fill('#adm-pass', 'pw'); await p.click('button[type=submit]');
  await p.waitForURL((u) => new URL(u).pathname === '/', { timeout: 10000 });
  await p.waitForLoadState('networkidle');
  await snap('02-home');
  for (const [name, url] of [['03-bookings', '/cue'], ['04-dispatch', '/cue?tab=dispatch'], ['05-prices', '/cue?tab=prices'], ['06-drivers', '/cue?tab=drivers'], ['07-villas', '/villas']]) {
    await p.goto(DASH + url, { waitUntil: 'networkidle' }); await snap(name);
  }
  await ctx.close();

  const dctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: w < 993, isMobile: w < 993 });
  const d = await dctx.newPage();
  const dsnap = async (name) => { await d.waitForTimeout(700); await d.screenshot({ path: `${OUT}/${label}-${name}.png` }); };
  await d.goto(DASH + '/driver/login', { waitUntil: 'networkidle' });
  await dsnap('08-driver-login');
  await d.fill('#drv-user', 'made'); await d.fill('#drv-pass', 'made-pass-123'); await d.click('button[type=submit]');
  await d.waitForURL((u) => new URL(u).pathname === '/driver', { timeout: 10000 });
  await d.waitForLoadState('networkidle');
  await d.locator('[data-push-gate]').waitFor({ timeout: 4000 }).catch(() => {});
  if (await d.locator('[data-push-gate]').count()) { await dsnap('09-driver-alerts-gate'); await d.getByRole('button', { name: /not now/i }).click(); }
  await dsnap('10-driver-bookings');
  for (const [name, tab] of [['11-driver-earnings', 'earnings'], ['12-driver-account', 'account']]) {
    await d.goto(DASH + '/driver?tab=' + tab, { waitUntil: 'networkidle' });
    if (await d.locator('[data-push-gate]').count()) await d.getByRole('button', { name: /not now/i }).click();
    await dsnap(name);
  }
  await dctx.close();
}
await browser.close();
console.log('shots in', OUT);
