import { chromium } from '/home/user/CUE/node_modules/playwright-core/index.mjs';

// The Reviews section, driven through the demo. RESTART THE SERVER BETWEEN RUNS
// (sign-in is 5 per 15 min per process).
const BASE = process.env.BASE || 'http://localhost:3180';
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
  const inDoor = await page.waitForURL((u) => new URL(u).pathname === '/', { timeout: 20000 })
    .then(() => true).catch(() => false);
  if (!inDoor) { console.log('  FAIL: could not sign in - RESTART THE SERVER (login is rate limited)'); process.exit(1); }
  SESSION = await ctx.storageState();
  await ctx.close();
}

for (const w of [390, 1280]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 }, storageState: SESSION });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(BASE + '/cue', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  // On a phone the sections live in the navbar's drawer (DASHBOARD BRIEF #2).
  if (w < 993) {
    await page.click('#hamburger');
    await page.waitForTimeout(400);
    await page.click('[data-drawer-row="reviews"]', { timeout: 8000 }).catch(() => {});
  } else {
    await page.locator('aside button', { hasText: 'Reviews' }).first().click({ timeout: 8000 }).catch(() => {});
  }
  await page.waitForTimeout(900);

  const tag = `${w}`;

  // The catch-all in Dashboard.jsx sends any unnamed tab to the Prices panel.
  // Forgetting to exclude a new section is a silent swap, so it is asserted.
  ok((await page.locator('input[placeholder="Search a tour, place or transfer"]').count()) === 0,
     `${tag}: the Reviews section is rendering the Prices panel`);

  const cards = () => page.locator('[data-review]').count();
  ok((await cards()) === 4, `${tag}: expected 4 reviews, found ${await cards()}`);

  // Stars must match the rating. Reading data-stars was NOT a test - that
  // attribute is the number the component was handed, so it agreed with itself
  // while every star was drawn filled. Count the FILLED ones instead.
  const filled = async (id) => page.locator(`[data-review="${id}"] [data-stars] svg[fill="currentColor"]`).count();
  const total = async (id) => page.locator(`[data-review="${id}"] [data-stars] svg`).count();
  ok((await total(101)) === 5, `${tag}: a rating row does not have 5 stars (got ${await total(101)})`);
  ok((await filled(101)) === 1, `${tag}: the 1-star review draws ${await filled(101)} filled stars`);
  ok((await filled(102)) === 5, `${tag}: the 5-star review draws ${await filled(102)} filled stars`);
  ok((await filled(103)) === 4, `${tag}: the 4-star review draws ${await filled(103)} filled stars`);

  // The already-hidden one is marked, and offers to come back rather than to hide.
  ok((await page.locator('[data-review="104"]').getAttribute('data-status')) === 'hidden',
     `${tag}: the hidden review is not marked hidden`);
  ok(await page.locator('[data-act="show-104"]').isVisible().catch(() => false),
     `${tag}: the hidden review offers no way back`);

  // Taking one down.
  ok(await page.locator('[data-act="hide-101"]').isVisible().catch(() => false),
     `${tag}: no way to hide a live review`);
  await page.click('[data-act="hide-101"]', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(700);
  ok((await page.locator('[data-review="101"]').getAttribute('data-status')) === 'hidden',
     `${tag}: hiding did not change the review's state on screen`);
  ok(await page.locator('[data-act="show-101"]').isVisible().catch(() => false),
     `${tag}: after hiding, the button does not offer to put it back`);

  // The demo must SAY it changed nothing. A screen that looks like it saved and
  // did not is the one thing a demo must never do.
  const body1 = (await page.locator('body').innerText().catch(() => '')) || '';
  ok(/Demo: nothing was actually changed/i.test(body1),
     `${tag}: the demo hid a review without admitting nothing was saved`);

  // And back again.
  await page.click('[data-act="show-101"]', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(700);
  ok((await page.locator('[data-review="101"]').getAttribute('data-status')) === 'approved',
     `${tag}: putting a review back did not restore it`);

  // The filter is a filter.
  await page.click('[data-view="hidden"]', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(900);
  const hidden = await page.locator('[data-review]').count();
  ok(hidden === 1, `${tag}: the Hidden tab shows ${hidden} reviews instead of 1`);
  ok((await page.locator('[data-review="104"]').count()) === 1, `${tag}: the Hidden tab shows the wrong review`);

  await page.click('[data-view="all"]', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(900);
  ok((await page.locator('[data-review]').count()) === 4, `${tag}: All did not come back to 4`);

  // Nothing here should suggest deleting - it is not what the button does.
  const body2 = (await page.locator('body').innerText().catch(() => '')) || '';
  ok(/never deletes anything/i.test(body2), `${tag}: the screen does not say hiding keeps the review`);
  ok(!/\bDelete\b/.test(body2), `${tag}: the screen offers to Delete, which is not what happens`);

  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok(over <= 0, `${tag}: page overflows by ${over}px`);
  ok(errs.length === 0, `${tag}: page errors ${errs.join(' | ')}`);

  await page.close();
  await ctx.close();
}

await b.close();
console.log(`${pass}/${pass + fail}`);
