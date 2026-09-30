import { chromium } from '/home/user/CUE/node_modules/playwright-core/index.mjs';

// RESTART THE SERVER BEFORE EVERY RUN. Login is rate limited to 5 tries per IP
// per 15 minutes and the counter lives in the server process, so a second run
// against the same process starts failing at the 6th sign-in - and it fails as
// a navigation timeout, which reads like a broken page rather than a full
// bucket. That is the limiter doing its job, not a bug.

const BASE = 'http://localhost:3100';
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log('  FAIL:', m)); };

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell' });

for (const w of [390, 768, 1280]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  const phone = w <= 992;
  const pick = async (id, label) => {
    if (phone) {
      await page.click('#hamburger');
      await page.waitForTimeout(400);
      await page.click(`[data-drawer-row="${id}"]`);
      await page.waitForTimeout(400);
    } else {
      await page.locator('aside button', { hasText: label }).first().click();
    }
  };
  // Chat is its own icon in the navbar on a phone; desktop keeps it in the rail.
  const openChat = async () => (phone ? page.click('[data-nav-chat]') : pick('chat', 'Chat'));
  page.on('pageerror', (e) => errs.push(String(e)));

  // A stranger gets the door, not the data.
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  ok(new URL(page.url()).pathname === '/login', `${w}: / did not redirect to /login`);
  ok(!(await page.content()).includes('Sample Guest'), `${w}: booking data leaked into the login page`);

  // The page redirecting is NOT the boundary - the data routes are. Ask them
  // directly with no cookie. (Checking only the login page's HTML let a route
  // that served bookings to anyone pass this harness 40/40: the login page
  // never calls it.)
  for (const path of ['/api/bookings', '/api/prices']) {
    const r = await ctx.request.get(BASE + path, { failOnStatusCode: false });
    const body = await r.text();
    ok(r.status() === 401, `${w}: ${path} answered ${r.status()} without a session`);
    ok(!/Sample Guest|baseIdr/.test(body), `${w}: ${path} handed data to a signed-out caller`);
  }

  // Tokens actually reached the page: compare against what the page resolves,
  // not against numbers typed in here.
  const tok = await page.evaluate(() => {
    const el = document.createElement('div');
    el.style.cssText = 'font-size:var(--fs-body);border-radius:var(--r-md);height:var(--btn-h)';
    document.body.appendChild(el);
    const cs = getComputedStyle(el);
    const out = { fs: cs.fontSize, r: cs.borderRadius, h: cs.height,
      font: getComputedStyle(document.body).fontFamily };
    el.remove();
    return out;
  });
  ok(tok.fs === '12.8px', `${w}: --fs-body resolved to ${tok.fs}`);
  ok(tok.r === '12px', `${w}: --r-md resolved to ${tok.r}`);
  // Sub-pixel: the browser resolves 2.1rem to 33.5938 at some device scales.
  // The token is what is being checked, not the rounding.
  ok(Math.abs(parseFloat(tok.h) - 33.6) < 0.1, `${w}: --btn-h resolved to ${tok.h}`);
  ok(/Inter/.test(tok.font), `${w}: body font is ${tok.font}`);

  // Sign in with the demo account.
  await page.fill('#adm-user', 'demo');
  await page.fill('#adm-pass', 'demo');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => new URL(u).pathname === '/', { timeout: 15000 });
  await page.waitForSelector('text=Sample Guest', { timeout: 15000 });

  ok(/Demo data/i.test(await page.innerText('body')), `${w}: no demo banner`);
  // Sign out lives in the navbar's account slot (DASHBOARD BRIEF #2), one tap
  // away at every width.
  await page.click('[data-account-slot] > button');
  ok((await page.locator('[data-account-slot] button:has-text("Sign out")').first().isVisible()),
     `${w}: Sign out not visible in the account menu`);
  await page.keyboard.press('Escape');

  // Rail: a column on desktop, no column on a phone.
  const rail = page.locator('aside').first();
  const hasRail = await rail.count() ? await rail.isVisible() : false;
  if (w >= 1024) {
    ok(hasRail, `${w}: rail missing on desktop`);
    const box = await rail.boundingBox();
    ok(box && Math.round(box.width) === 248, `${w}: rail width ${box && box.width}`);
  } else {
    ok(!hasRail, `${w}: rail should be hidden on a phone`);
  }

  // The page must not grow sideways at any width.
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok(over <= 0, `${w}: page overflows by ${over}px`);

  // Prices section works from the browser, not just from curl.
  // On a phone the sections are in the navbar's drawer (DASHBOARD BRIEF #2),
  // so the harness walks the same path a visitor does: burger, then the row.
  await pick('prices', 'Prices');
  await page.waitForSelector('input[value="700,000"]', { timeout: 15000 });
  ok(true, `${w}: prices loaded`);
  ok(/40/.test(await page.innerText('body')), `${w}: derived USD missing`);

  // ---- Chat: the guests the site's panel handed over ----
  await openChat();
  await page.waitForSelector('text=Sample Guest (Hannah W.)', { timeout: 15000 });

  const rows = page.locator('button:visible', { hasText: 'Sample Guest' });
  ok(await rows.count() === 2, `${w}: expected 2 chat threads, got ${await rows.count()}`);

  // A thread nobody has answered carries its own count.
  const before = await page.locator('button:visible', { hasText: 'Hannah' }).innerText();
  ok(/\b1\b/.test(before), `${w}: the waiting thread shows no unread count`);

  await page.locator('button:visible', { hasText: 'Hannah' }).first().click();
  const conv = page.locator('[data-chatbody]');
  await conv.getByText('is the batur sunrise trek realistic', { exact: false }).waitFor({ timeout: 15000 });
  ok(true, `${w}: thread opened`);

  // Replying is real, even in the demo.
  const reply = 'Batur is a real climb - I would send her to Jatiluwih instead.';
  const box = page.getByLabel('Your reply');
  await box.fill(reply);
  await page.getByRole('button', { name: 'Send reply' }).click();
  await conv.getByText(reply, { exact: false }).waitFor({ timeout: 15000 });
  ok(true, `${w}: reply shown straight away`);

  // It survives a reload, which is what makes it a demo rather than a mock.
  await page.reload({ waitUntil: 'networkidle' });
  await openChat();
  await page.waitForSelector('text=Sample Guest (Hannah W.)', { timeout: 15000 });
  const after = await page.locator('button:visible', { hasText: 'Hannah' }).innerText();
  ok(after.includes('You:'), `${w}: the reply did not survive a reload`);
  ok(!/\b1\b/.test(after.replace(/\d{1,2}:\d{2}/g, '')), `${w}: answering did not clear the unread count`);

  ok(errs.length === 0, `${w}: page errors ${errs.join(' | ')}`);
  // Falls back to shots/ (already gitignored) when SP is unset. Interpolating an
  // undefined env var straight into the path writes a directory literally named
  // "undefined" into the repo root, which then shows up as untracked work - it
  // happened, and the screenshots are not work, they are output.
  await page.screenshot({ path: `${process.env.SP || 'shots'}/dash-${w}.png`, fullPage: false });
  await ctx.close();
}

// The door has a limit of its own, in front of the API's. Proved last, because
// it leaves the bucket full for whatever runs next.
{
  const ctx = await b.newContext();
  let sawLimit = false;
  for (let i = 0; i < 8; i++) {
    const r = await ctx.request.post(BASE + '/api/session', {
      data: { user: 'nobody', pass: 'nothing' }, failOnStatusCode: false,
    });
    if (r.status() === 429) { sawLimit = true; break; }
  }
  ok(sawLimit, 'login is not rate limited');
  await ctx.close();
}

await b.close();
console.log(`${pass}/${pass + fail}`);
process.exit(fail ? 1 : 0);
