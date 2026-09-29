import { chromium } from 'playwright-core';

// The Google Search section, driven through the demo (which never reaches the
// API or Google). RESTART THE SERVER BETWEEN RUNS (sign-in is rate limited).
//   DEMO_ENABLED=true DEMO_USER=demo DEMO_PASS=demo CAHYANA_API=http://127.0.0.1:1 npx next start -p 3180
//   node verify-search.mjs
const BASE = process.env.BASE || 'http://localhost:3180';
const SHOTS = process.env.SHOTS || '';
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log('  FAIL:', m)); };

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
  const inDoor = await page.waitForURL((u) => new URL(u).pathname === '/', { timeout: 20000 }).then(() => true).catch(() => false);
  if (!inDoor) { console.log('  FAIL: could not sign in - RESTART THE SERVER'); process.exit(1); }
  SESSION = await ctx.storageState();
  await ctx.close();
}

for (const w of [390, 1280]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 }, storageState: SESSION });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  const asked = [];
  page.on('request', (r) => { if (r.url().includes('/api/search')) asked.push(new URL(r.url()).search); });
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  if (w < 993) await page.click('button:has-text("Bookings")', { timeout: 8000 }).catch(() => {});
  await page.locator('button:visible', { hasText: 'Google Search' }).first().click({ timeout: 8000 });
  await page.waitForSelector('[data-gsc-chart]', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(400);
  const tag = `${w}`;

  ok((await page.locator('input[placeholder="Search a tour, place or transfer"]').count()) === 0, `${tag}: the Search section renders the Prices panel`);
  ok((await page.locator('[data-gsc-tile]').count()) === 4, `${tag}: expected 4 metric tiles`);
  ok(asked.some((q) => q.includes('days=28')), `${tag}: default period is not 28 days (asked ${asked.join(',')})`);

  // The chart draws a line, and hovering says which day and what value.
  const path = await page.locator('[data-gsc-chart] svg path[stroke]').getAttribute('d');
  ok(path && path.split('L').length >= 27, `${tag}: the line does not cover 28 days`);
  await page.locator('[data-gsc-chart]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const box = await page.locator('[data-gsc-chart] svg').boundingBox();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5);
  await page.waitForTimeout(150);
  const tip = await page.locator('[data-gsc-chart] [role=status]').textContent().catch(() => '');
  ok(/clicks/.test(tip || ''), `${tag}: hovering the chart shows no tooltip (got "${tip}")`);
  // The last date label must sit inside the chart, not clipped by its edge.
  const clip = await page.evaluate(() => {
    const svg = document.querySelector('[data-gsc-chart] svg');
    const r = svg.getBoundingClientRect();
    return [...svg.querySelectorAll('text')].some((t) => { const b = t.getBoundingClientRect(); return b.right > r.right + 0.5 || b.left < r.left - 0.5; });
  });
  ok(!clip, `${tag}: an axis label is clipped by the chart edge`);
  ok(/^\+|^-|no change/.test((await page.locator('[data-gsc-tile="position"] span').nth(3).textContent().catch(() => '')) || '') , `${tag}: position badge missing`);
  ok(!/%/.test((await page.locator('[data-gsc-tile="position"] span').nth(3).textContent().catch(() => '%')) || '%'), `${tag}: position change shown as a percent`);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/search-${w}.png`, fullPage: true });

  // A tile switches the chart; position is drawn with 1 at the top.
  await page.locator('[data-gsc-tile="position"]').click();
  ok((await page.locator('[data-gsc-tile="position"]').getAttribute('aria-pressed')) === 'true', `${tag}: tile did not select`);
  ok(/Avg\. position per day/.test(await page.locator('[data-gsc] h2').first().textContent()), `${tag}: chart title did not follow the tile`);

  // Period switch asks for the new window.
  await page.locator('[role=radio]', { hasText: '7 days' }).click();
  await page.waitForTimeout(500);
  ok(asked.some((q) => q.includes('days=7')), `${tag}: the 7-day button did not ask for 7 days`);
  const path7 = await page.locator('[data-gsc-chart] svg path[stroke]').getAttribute('d');
  ok(path7 && path7.split('L').length === 7, `${tag}: the 7-day chart has ${path7 && path7.split('L').length} points`);

  // Tables and sitemaps.
  ok((await page.locator('[data-gsc] table').count()) >= 5, `${tag}: tables missing`);
  ok(/Australia/.test(await page.locator('[data-gsc]').textContent()), `${tag}: country codes not turned into names`);
  ok(/sitemap\.xml/.test(await page.locator('[data-gsc]').textContent()), `${tag}: sitemap not listed`);

  const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  ok(over <= 0, `${tag}: page is ${over}px wider than the screen`);
  ok(errs.length === 0, `${tag}: page errors ${errs.join(' | ')}`);
  await ctx.close();
}

await b.close();
console.log(`${pass}/${pass + fail}`);
process.exit(fail ? 1 : 0);
