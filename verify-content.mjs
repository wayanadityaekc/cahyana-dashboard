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

  // ---- tour details ------------------------------------------------------
  await page.click('[data-kind="tours"]', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(900);

  // It really loaded the OTHER document, rather than relabelling this one: the
  // legal page's title field is gone and a stop has appeared.
  ok((await page.locator('#c-title').count()) === 0, `${tag}: switching to tours left the legal fields on screen`);
  ok(await page.locator('[data-stoptext="0"]').isVisible().catch(() => false), `${tag}: no stop text to edit`);
  ok(await page.locator('#c-desc').isVisible().catch(() => false), `${tag}: no tour blurb field`);

  // Seventeen tours do not fit on a row of tabs, so past six pages the picker is
  // a list. That is the branch the owner actually sees.
  ok(await page.locator('[data-pagepick]').isVisible().catch(() => false), `${tag}: many tours still rendered as tabs`);
  ok((await page.locator('[data-page]').count()) === 0, `${tag}: both pickers rendered at once`);

  // THE MONEY GUARD, from the outside: the pricing catalog key and the tour name
  // are not offered as fields. The API refuses them too - this is the second
  // line, and it is the one the owner meets first.
  const values = await page.locator('input, textarea').evaluateAll(
    (els) => els.map((e) => (e.value || '').trim()),
  );
  ok(!values.includes('Ubud Tour'), `${tag}: THE PRICING CATALOG KEY (bookItem) IS AN EDITABLE FIELD`);
  ok(!values.includes('Ubud Highlights Tour'), `${tag}: the tour name is editable, and four other things read it`);

  ok((await countText()).startsWith('No changes'), `${tag}: tours claims changes before anything was typed`);

  // Rewording a stop.
  await page.locator('[data-stoptext="0"]').fill('Reworded by the harness.', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(400);
  ok((await countText()).startsWith('1 unpublished change'), `${tag}: rewording a stop was not counted (${await countText()})`);

  // ADDING a line to what's included - the one thing in this editor that can
  // change the size of the document.
  const lines = () => page.locator('[data-line^="included-"]').count();
  const before = await lines();
  await page.click('[data-add="included"]', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(300);
  ok((await lines()) === before + 1, `${tag}: Add a line did not add one (${before} -> ${await lines()})`);
  await page.locator(`[data-line="included-${before}"]`).fill('Free cold water on board', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(400);
  const c2 = await countText();
  ok(/[2-9]\d* unpublished/.test(c2), `${tag}: the ADDED line did not count as a change (${c2})`);

  // ...and removing one.
  await page.click(`[data-remove="included-${before}"]`, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(300);
  ok((await lines()) === before, `${tag}: removing a line did not remove one`);

  // The last line cannot be removed: an empty list renders an empty box, and
  // the API refuses it - so the button greys out instead of teaching a wall.
  const exLines = await page.locator('[data-line^="excluded-"]').count();
  for (let i = exLines - 1; i > 0; i -= 1) {
    await page.click(`[data-remove="excluded-${i}"]`, { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(150);
  }
  ok((await page.locator('[data-line^="excluded-"]').count()) === 1, `${tag}: could not get the list down to one line`);
  ok(await page.locator('[data-remove="excluded-0"]').isDisabled().catch(() => false),
     `${tag}: the last line of a list can be removed, which ships an empty box`);

  // Switching back must not leave tour fields behind.
  await page.click('[data-kind="legal"]', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(900);
  ok((await page.locator('[data-stoptext="0"]').count()) === 0, `${tag}: tour fields survived switching back to legal`);
  ok(await page.locator('#c-title').isVisible().catch(() => false), `${tag}: the legal fields did not come back`);

  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok(over <= 0, `${tag}: page overflows by ${over}px`);
  ok(errs.length === 0, `${tag}: page errors ${errs.join(' | ')}`);
  await page.close();
  await ctx.close();
}

// ---- publishing to a draft branch says so ----------------------------------
// The API response is rewritten on the way in rather than adding a second demo
// fixture: what needs proving is that the PANEL reacts to deploys:false, and the
// shape it reacts to is the real one.
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, storageState: SESSION });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.route('**/api/content**', async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    const res = await route.fetch();
    let j;
    try { j = await res.json(); } catch { return route.fulfill({ response: res }); }
    j.deploys = false;
    j.branch = 'content-draft';
    j.compareUrl = 'https://github.com/wayanadityaekc/CUE/compare/main...content-draft?expand=1';
    j.build = { state: 'awaiting-merge', url: j.compareUrl };
    return route.fulfill({ response: res, body: JSON.stringify(j) });
  });
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.locator('button:visible', { hasText: 'Content' }).first().click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(900);

  const txt = (await page.locator('body').innerText().catch(() => '')) || '';
  ok(/Nothing reaches the site until you review and merge it/i.test(txt),
     'draft branch: the panel does not say the publish is not live');
  ok(txt.includes('content-draft'), 'draft branch: the branch name is not shown');
  ok(await page.locator('[data-compare]').isVisible().catch(() => false),
     'draft branch: no link to review the diff');
  ok(/waiting for you to merge/i.test(txt),
     'draft branch: the build line still talks about a build that never happens');
  // The old copy promised a rebuild; off the deploy branch that would be a lie.
  ok(!/rebuilds in about three minutes/i.test(txt),
     'draft branch: it still promises the site rebuilds by itself');
  ok(errs.length === 0, `draft branch: page errors ${errs.join(' | ')}`);
  await page.close();
  await ctx.close();
}

await b.close();
console.log(`${pass}/${pass + fail}`);
