import { chromium } from '/home/user/CUE/node_modules/playwright-core/index.mjs';

// DASHBOARD BRIEF #12.
//   cd ../cahyana-api && node tools/driver-dev-server.js            (4598)
//   CAHYANA_API=http://127.0.0.1:4598/api npx next start -p 3102
//   node verify-brief12.mjs
// Part 1: driver sign-in = username, password, Sign in, Install. Nothing else.
// Part 2: Dispatch takes a driver on PAST trips too.
const DASH = process.env.DASH || 'http://localhost:3102';
const API = 'http://127.0.0.1:4598/api';
const BASIC = 'Basic ' + Buffer.from('owner:pw').toString('base64');
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log('  FAIL:', m)); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';

// ===== Part 1: the sign-in page =====
for (const w of [390, 1280]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 844 }, hasTouch: w < 993, isMobile: w < 993 });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(DASH + '/driver/login', { waitUntil: 'networkidle' }); await sleep(500);
  const tag = `login@${w}`;
  const inv = await page.evaluate(() => {
    const f = document.querySelector('[data-driver-login]');
    const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden'; };
    return {
      inputs: [...f.querySelectorAll('input')].filter(vis).map((i) => ({ id: i.id, type: i.type, ph: i.placeholder, aria: i.getAttribute('aria-label') })),
      buttons: [...f.querySelectorAll('button')].filter(vis).map((x) => x.innerText.trim()),
      labels: document.querySelectorAll('label').length,
      headings: document.querySelectorAll('h1,h2,h3,p').length,
      pageText: document.body.innerText.trim().replace(/\s+/g, ' '),
      over: document.documentElement.scrollWidth - innerWidth,
    };
  });
  ok(inv.inputs.length === 2 && inv.inputs[0].id === 'drv-user' && inv.inputs[1].id === 'drv-pass' && inv.inputs[1].type === 'password', `${tag}: fields ${JSON.stringify(inv.inputs)}`);
  ok(inv.inputs.every((i) => i.aria && i.ph), `${tag}: a field has no placeholder/aria-label`);
  ok(JSON.stringify(inv.buttons) === JSON.stringify(['Sign in', 'Install']), `${tag}: buttons ${JSON.stringify(inv.buttons)}`);
  ok(inv.labels === 0 && inv.headings === 0, `${tag}: still ${inv.labels} labels / ${inv.headings} text blocks`);
  // The only words on the page are the button names and the placeholders' own words.
  ok(/^Sign in Install$/.test(inv.pageText), `${tag}: page text is "${inv.pageText}"`);
  ok(inv.over <= 0, `${tag}: page grew sideways`);
  ok(errs.length === 0, `${tag}: errors ${errs.slice(0, 2).join('|')}`);
  await ctx.close();
}

// Android: one tap = the browser's own prompt, no popup.
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.goto(DASH + '/driver/login', { waitUntil: 'networkidle' });
  const fired = await page.evaluate(() => {
    window.__installCalls = 0;
    const e = new Event('beforeinstallprompt', { cancelable: true });
    e.prompt = () => { window.__installCalls += 1; return Promise.resolve(); };
    e.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(e);
    return e.defaultPrevented;
  });
  ok(fired, 'android: beforeinstallprompt was not captured');
  await page.click('[data-install-btn]'); await sleep(300);
  ok(await page.evaluate(() => window.__installCalls) === 1, 'android: Install did not trigger the native prompt');
  ok(await page.locator('[data-install-sheet]').count() === 0, 'android: a popup opened over the native prompt');
  // a second tap with the (used) prompt gone falls back to the steps, it never does nothing
  await page.click('[data-install-btn]'); await sleep(300);
  ok(await page.locator('[data-install-sheet]').count() === 1, 'android: second tap did nothing');
  await ctx.close();
}

// iPhone: no one-tap install exists, so Install opens the steps.
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, userAgent: IPHONE });
  const page = await ctx.newPage();
  await page.goto(DASH + '/driver/login', { waitUntil: 'networkidle' }); await sleep(400);
  ok(await page.locator('[data-install-sheet]').count() === 0, 'ios: popup open before the tap');
  await page.click('[data-install-btn]'); await sleep(300);
  const sheet = page.locator('[data-install-sheet]');
  ok(await sheet.count() === 1, 'ios: Install did not open the instructions');
  const t = await sheet.innerText().catch(() => '');
  ok(/Share/.test(t) && /Add to Home Screen/.test(t), `ios: steps text "${t}"`);
  ok(await page.evaluate(() => getComputedStyle(document.body).overflow) === 'hidden', 'ios: page scrolls behind the popup');
  const r = await page.locator('[data-install-sheet] [role=dialog]').evaluate((e) => { const x = e.getBoundingClientRect(); return { l: x.left, r: x.right, t: x.top, b: x.bottom }; });
  ok(r.l >= 0 && r.r <= 390 && r.t >= 0 && r.b <= 844, `ios: popup leaves the screen ${JSON.stringify(r)}`);
  await page.keyboard.press('Escape'); await sleep(200);
  ok(await sheet.count() === 0, 'ios: Escape did not close the popup');
  ok(await page.evaluate(() => getComputedStyle(document.body).overflow) !== 'hidden', 'ios: page stayed locked after closing');
  await page.click('[data-install-btn]'); await sleep(200);
  await page.locator('[data-install-sheet]').click({ position: { x: 5, y: 5 } }); await sleep(200);
  ok(await sheet.count() === 0, 'ios: tapping outside did not close the popup');
  // signing in does not need the app installed
  await fetch(API + '/admin/drivers', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: BASIC }, body: JSON.stringify({ name: 'Login Twelve', phone: '+62 8', username: 'twelve', password: 'twelve-pass-1' }) });
  await page.fill('#drv-user', 'twelve'); await page.fill('#drv-pass', 'twelve-pass-1'); await page.click('button[type=submit]');
  await page.waitForURL((u) => new URL(u).pathname === '/driver', { timeout: 10000 }).catch(() => {});
  ok(new URL(page.url()).pathname === '/driver', `signing in from a plain tab (not installed) went to ${page.url()}`);
  await ctx.close();
}
// Installed app: no Install button.
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await ctx.addInitScript(() => { Object.defineProperty(navigator, 'standalone', { get: () => true }); });
  const page = await ctx.newPage();
  await page.goto(DASH + '/driver/login', { waitUntil: 'networkidle' }); await sleep(400);
  ok(await page.locator('[data-install-btn]').count() === 0, 'installed: Install button still shown');
  ok(await page.locator('#drv-user').count() === 1, 'installed: sign-in form missing');
  await ctx.close();
}

// ===== Part 2: Dispatch on past trips =====
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await fetch(API + '/admin/drivers', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: BASIC }, body: JSON.stringify({ name: 'Made Past', phone: '+62 8 1', username: 'madepast', password: 'madepast-pass-1' }) });
  await page.goto(DASH + '/login', { waitUntil: 'networkidle' });
  await page.fill('#adm-user', 'owner'); await page.fill('#adm-pass', 'pw'); await page.click('button[type=submit]');
  await page.waitForURL((u) => new URL(u).pathname === '/', { timeout: 10000 });
  await page.goto(DASH + '/cue?tab=dispatch', { waitUntil: 'networkidle' });
  await page.locator('[data-dispatch]').waitFor({ timeout: 8000 });
  const needBefore = await page.locator('[data-filter=open]').innerText();
  ok(await page.locator('[data-dispatch-group="CUE-904"]').count() === 0, 'a past trip showed up under "Needs a driver"');
  ok(/Past trips\s*1/.test(await page.locator('[data-filter=past]').innerText()), `past chip: "${await page.locator('[data-filter=past]').innerText()}"`);
  await page.click('[data-filter=past]'); await sleep(300);
  const card = page.locator('[data-dispatch-group="CUE-904"]');
  ok(await card.count() === 1, 'past trip CUE-904 not listed under Past trips');
  ok(await card.locator('[data-past-tag]').count() === 1, 'past card is not marked Past');
  ok(/unassigned/i.test(await card.locator('[data-row-status]').first().innerText()), 'past trip should start Unassigned');
  const opt = await card.locator('[data-group-driver] option', { hasText: 'Made Past' }).first().getAttribute('value');
  await card.locator('[data-group-driver]').selectOption(opt);
  await card.locator('[data-group-assign]').click();
  await page.locator('[role=status]').filter({ hasText: 'past trip' }).waitFor({ timeout: 6000 }).catch(() => {});
  const msg = await page.locator('[role=status]').first().innerText().catch(() => '');
  ok(/No alert was sent/.test(msg), `past assign message "${msg}"`);
  const card2 = page.locator('[data-dispatch-group="CUE-904"]');
  await page.waitForFunction(() => /accepted - made past/i.test(document.querySelector('[data-dispatch-group="CUE-904"] [data-row-status]')?.innerText || ''), null, { timeout: 5000 }).catch(() => {});
  ok(/accepted - made past/i.test(await card2.locator('[data-row-status]').first().innerText()), 'past trip is not marked Accepted for the driver');
  // change it, then clear it
  const w = await card2.locator('[data-group-driver] option', { hasText: 'Made Wirawan' }).count();
  await card2.locator('[data-group-driver]').selectOption('');
  await card2.locator('[data-group-assign]').click();
  await page.locator('[role=status]').filter({ hasText: 'no driver' }).waitFor({ timeout: 6000 }).catch(() => {});
  ok(/unassigned/i.test(await page.locator('[data-dispatch-group="CUE-904"] [data-row-status]').first().innerText()), 'past trip could not be cleared');
  await page.click('[data-filter=open]'); await sleep(300);
  ok(await page.locator('[data-filter=open]').innerText() === needBefore, 'Needs a driver count moved because of a past trip');
  // the sidebar badge ignores past trips too
  const badge = await page.locator('aside button', { hasText: 'Dispatch' }).first().innerText();
  const nOpen = Number((needBefore.match(/(\d+)\s*$/) || [])[1]);
  const nBadge = Number((badge.match(/(\d+)\s*$/) || [])[1]);
  ok(nOpen > 0 && nBadge === nOpen, `sidebar badge ${nBadge} vs Needs a driver ${nOpen}`);
  await ctx.close();
}
// ===== Part 3: Share a driver's login =====
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await ctx.addInitScript(() => {
    window.__shared = [];
    window.__shareMode = 'ok';
    navigator.share = async (d) => {
      if (window.__shareMode === 'cancel') { const e = new Error('x'); e.name = 'AbortError'; throw e; }
      window.__shared.push(d);
    };
    window.__clip = [];
    try { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (t) => { window.__clip.push(t); } } }); } catch {}
  });
  const page = await ctx.newPage();
  await page.goto(DASH + '/login', { waitUntil: 'networkidle' });
  await page.fill('#adm-user', 'owner'); await page.fill('#adm-pass', 'pw'); await page.click('button[type=submit]');
  await page.waitForURL((u) => new URL(u).pathname === '/', { timeout: 10000 });
  await page.goto(DASH + '/cue?tab=drivers', { waitUntil: 'networkidle' });
  await page.locator('[data-driver-create]').waitFor({ timeout: 8000 });
  await page.fill('#drv-name', 'Share Tester'); await page.fill('#drv-phone', '+62 8 99'); await page.fill('#drv-user', 'sharer'); await page.fill('#drv-pass', 'share-pass-123');
  await page.click('[data-driver-create] button[type=submit]');
  await page.locator('[data-new-password]').waitFor({ timeout: 8000 });
  const origin = new URL(page.url()).origin;
  const last = () => page.evaluate(() => window.__shared[window.__shared.length - 1] || null);
  // 1. right after creating
  await page.click('[data-share-secret]'); await sleep(300);
  let d = await last();
  ok(d && d.text === `Cahyana driver app\nLink: ${origin}/driver\nUsername: sharer\nPassword: share-pass-123`, `share after create: ${JSON.stringify(d)}`);
  ok(d && /Share Tester/.test(d.title || ''), 'share title lacks the driver name');
  await page.locator('[data-new-password] button', { hasText: 'Done' }).click();
  // 2. from the card, same page session: password still known
  const card = page.locator('[data-driver="sharer"]');
  await card.locator('[data-share-driver]').click(); await sleep(300);
  d = await last();
  ok(d && /Password: share-pass-123/.test(d.text) && /Username: sharer/.test(d.text), `card share: ${JSON.stringify(d)}`);
  ok(await card.locator('[data-share-msg]').count() === 0, 'a successful share printed a message');
  // 3. after a reload the password is gone: link + username only, and it says so
  await page.goto(DASH + '/cue?tab=drivers', { waitUntil: 'networkidle' });
  await page.locator('[data-driver="sharer"]').waitFor({ timeout: 8000 });
  await page.locator('[data-driver="sharer"] [data-share-driver]').click(); await sleep(300);
  d = await last();
  ok(d && !/Password/.test(d.text) && /Username: sharer/.test(d.text) && d.text.includes(origin + '/driver'), `reloaded share: ${JSON.stringify(d)}`);
  ok(/never stored/.test(await page.locator('[data-driver="sharer"] [data-share-msg]').innerText().catch(() => '')), 'no note that the password was left out');
  // 4. set a new password -> the card can share that one
  await page.locator('[data-driver="sharer"] [data-reset]').click();
  const pwInput = page.locator('[data-driver="sharer"] input[autocomplete="new-password"]');
  await pwInput.fill('brand-new-pass-9'); await page.locator('[data-reset-save]').click();
  await page.locator('[data-new-password]').waitFor({ timeout: 8000 });
  await page.click('[data-share-secret]'); await sleep(300);
  d = await last();
  ok(d && /Password: brand-new-pass-9/.test(d.text), `share after reset: ${JSON.stringify(d)}`);
  // 5. closing the share sheet is not an error
  await page.evaluate(() => { window.__shareMode = 'cancel'; });
  const n = await page.evaluate(() => window.__shared.length);
  await page.click('[data-share-secret]'); await sleep(300);
  ok(await page.evaluate(() => window.__shared.length) === n && await page.locator('[data-new-password] [data-share-msg]').count() === 0, 'cancelling the share sheet showed a message or shared anyway');
  // 6. no share sheet (desktop): copies instead and says so
  await page.evaluate(() => { delete navigator.share; Object.defineProperty(navigator, 'share', { configurable: true, value: undefined }); });
  await page.click('[data-share-secret]'); await sleep(300);
  ok(/Password: brand-new-pass-9/.test(await page.evaluate(() => window.__clip.slice(-1)[0] || '')), 'no share sheet: nothing was copied');
  ok(/Copied/.test(await page.locator('[data-new-password] [data-share-msg]').first().innerText().catch(() => '')), 'no share sheet: no "Copied" note');
  ok(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 0, 'drivers page grew sideways');
  await ctx.close();
}
await b.close();
console.log(`${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
