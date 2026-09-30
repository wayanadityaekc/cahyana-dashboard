import { chromium } from '/home/user/CUE/node_modules/playwright-core/index.mjs';

// The Sale panel, driven through the demo - which never reaches the real API, so
// this can run as often as it likes without touching a live price.
//
// RESTART THE SERVER BETWEEN RUNS: sign-in is 5 per IP per 15 minutes, counted
// in the server process. This harness signs in ONCE and reuses the session.
const BASE = process.env.BASE || 'http://localhost:3102';
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log('  FAIL:', m)); };

const day = (n) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const b = await chromium.launch({
  executablePath: process.env.PW_BIN || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});

let SESSION = null;
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('#adm-user', 'demo');
  await page.fill('#adm-pass', 'demo');
  await page.click('button[type=submit]');
  const inDoor = await page.waitForURL((u) => new URL(u).pathname === '/', { timeout: 20000 })
    .then(() => true).catch(() => false);
  if (!inDoor) {
    console.log('  FAIL: could not sign in - RESTART THE SERVER (login is rate limited per process)');
    process.exit(1);
  }
  SESSION = await ctx.storageState();
  await ctx.close();
}

for (const w of [390, 1280]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 }, storageState: SESSION });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  // On a phone the sections live in the navbar's drawer (DASHBOARD BRIEF #2).
  if (w < 993) {
    await page.click('#hamburger');
    await page.waitForTimeout(400);
    await page.click('[data-drawer-row="promo"]', { timeout: 8000 }).catch(() => {});
  } else {
    await page.locator('aside button', { hasText: 'Sale' }).first().click({ timeout: 8000 }).catch(() => {});
  }
  await page.waitForTimeout(700);

  const tag = `${w}`;
  // The old render condition was a catch-all ("not bookings, not chat" = Prices),
  // so a seventh section would have drawn the price list under this heading.
  const wrongPanel = await page.locator('input[placeholder="Search a tour, place or transfer"]').count();
  ok(wrongPanel === 0, `${tag}: the Sale section is rendering the Prices panel`);
  ok(await page.locator('#promo-pct').isVisible(), `${tag}: no percent field in the Sale section`);

  ok(await page.getByText('No sale running', { exact: false }).first().isVisible(),
     `${tag}: the panel does not say that no sale is running`);

  // A percentage below the referral discount has to be refused, and the reason
  // has to be readable - that rule is the whole reason "best of" holds.
  await page.fill('#promo-pct', '3', { timeout: 5000 }).catch(() => {});
  await page.fill('#promo-ends', day(20), { timeout: 5000 }).catch(() => {});
  await page.click('[data-save]', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(700);
  const refused = await page.getByText('between 5 and 50', { exact: false }).first().isVisible().catch(() => false);
  ok(refused, `${tag}: a 3% sale was not refused with a reason`);

  // A real one.
  await page.fill('#promo-pct', '10', { timeout: 5000 }).catch(() => {});
  await page.fill('#promo-ends', day(20), { timeout: 5000 }).catch(() => {});
  await page.fill('#promo-label', 'Low season', { timeout: 5000 }).catch(() => {});
  await page.click('[data-save]', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(900);
  ok(await page.getByText('10% off', { exact: false }).first().isVisible().catch(() => false),
     `${tag}: the panel does not report the sale it just saved`);
  ok(await page.getByText('Referral codes are superseded', { exact: false }).first().isVisible().catch(() => false),
     `${tag}: the panel never says a code steps aside during a sale`);
  const said = (await page.locator('p').allTextContents()).join(' / ').slice(0, 300);
  ok(await page.locator('[data-stop]').isVisible().catch(() => false),
     `${tag}: no way to stop a running sale. Panel said: ${said}`);

  // And stopping it.
  await page.click('[data-stop]', { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(900);
  ok(await page.getByText('No sale running', { exact: false }).first().isVisible().catch(() => false),
     `${tag}: stopping the sale did not clear it`);
  ok((await page.locator('[data-stop]').count()) === 0, `${tag}: Stop is still offered with no sale running`);

  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok(over <= 0, `${tag}: page overflows by ${over}px`);
  ok(errs.length === 0, `${tag}: page errors ${errs.join(' | ')}`);
  await page.close();
  await ctx.close();
}

await b.close();
console.log(`${pass}/${pass + fail}`);
