import { chromium } from '/home/user/CUE/node_modules/playwright-core/index.mjs';

// The content editor, driven through the demo - which never reaches the API and
// cannot publish, so this can run as often as it likes without touching the
// live site. RESTART THE SERVER BETWEEN RUNS (sign-in is 5 per 15 min).
const BASE = process.env.BASE || 'http://localhost:3150';
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
  if (!inDoor) { console.log('  FAIL: could not sign in - RESTART THE SERVER (login is rate limited per process)'); process.exit(1); }
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
  if (w < 993) await page.click('button:has-text("Bookings")', { timeout: 8000 }).catch(() => {});
  await page.locator('button:visible', { hasText: 'Content' }).first().click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(800);

  const tag = `${w}`;
  ok((await page.locator('input[placeholder="Search a tour, place or transfer"]').count()) === 0,
     `${tag}: the Content section is rendering the Prices panel`);

  const tabs = await page.locator('[data-page]').count();
  ok(tabs >= 2, `${tag}: expected a tab per legal page, found ${tabs}`);
  ok(await page.locator('#c-title').isVisible().catch(() => false), `${tag}: no title field`);

  // The editor must NOT offer a way to restructure the page - the API refuses it,
  // so an "add paragraph" button would only teach the owner to hit a wall.
  ok((await page.locator('button:has-text("Add paragraph")').count()) === 0,
     `${tag}: the editor offers to add a block, which the API refuses`);

  // Nothing changed yet.
  // Non-throwing: a missing element is a FAILURE to report, not a reason to end
  // the run and hide every assertion after it.
  const countText = async () => {
    const t = await page.locator('[data-count]').first().textContent({ timeout: 4000 }).catch(() => '');
    return (t || '').trim();
  };
  ok((await countText()).startsWith('No changes'), `${tag}: it claims changes before anything was typed`);
  ok(await page.locator('[data-publish]').isDisabled().catch(() => true), `${tag}: Publish is enabled with nothing to publish`);

  // Type into the first paragraph.
  const para = page.locator('[data-block="0"]').first();
  await para.fill('These Terms apply to every booking, and this sentence was typed by the harness.', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(400);
  ok((await countText()).startsWith('1 unpublished change'), `${tag}: an edit was not counted (${await countText()})`);
  ok(!(await page.locator('[data-publish]').isDisabled().catch(() => true)), `${tag}: Publish stayed disabled after an edit`);

  // The demo must refuse to publish, out loud.
  await page.click('[data-publish]', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(900);
  const refused = await page.getByText('demo cannot publish', { exact: false }).first().isVisible().catch(() => false);
  ok(refused, `${tag}: the demo did not refuse to publish`);

  // Discard puts it back.
  await page.click('[data-discard]', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(900);
  ok((await countText()).startsWith('No changes'), `${tag}: discarding did not clear the edit (${await countText()})`);

  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok(over <= 0, `${tag}: page overflows by ${over}px`);
  ok(errs.length === 0, `${tag}: page errors ${errs.join(' | ')}`);
  await page.close();
  await ctx.close();
}

await b.close();
console.log(`${pass}/${pass + fail}`);
