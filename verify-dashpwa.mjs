import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '/home/user/CUE/node_modules/playwright-core/index.mjs';

// RESTART THE SERVER BEFORE EVERY RUN - sign-in is rate limited to 5 tries per
// IP per 15 minutes and the counter lives in the process, so a repeat run fails
// as a navigation timeout that reads like a broken page.
const BASE = process.env.BASE || 'http://localhost:3100';
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log('  FAIL:', m)); };

// Only the attribute branch can be driven here: this Chromium ignores
// Emulation.setEmulatedMedia for display-mode (it honours prefers-color-scheme,
// so the mechanism works - the feature is missing) and a headless --app window
// exposes no page. The media branch is covered by the CSS check below instead,
// the same way the site's harness covers it.
const appMode = (page) => page.addInitScript(() => {
  const mark = () => { document.documentElement.dataset.standalone = '1'; };
  if (document.documentElement) mark();
  else document.addEventListener('readystatechange', mark, { once: true });
});

// SIGN IN ONCE, then hand the session to every other context. This harness needs
// seven browser contexts and the limiter allows FIVE sign-ins per IP per fifteen
// minutes - signing in per context blew the bucket on the sixth and failed as a
// navigation timeout, which reads like a broken page rather than a full bucket.
// The first version of this file did exactly that.
let SESSION = null;
const bootstrap = async (browser) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('#adm-user', 'demo');
  await page.fill('#adm-pass', 'demo');
  await page.click('button[type=submit]');
  const landed = await page.waitForURL((u) => new URL(u).pathname === '/', { timeout: 20000 })
    .then(() => true).catch(() => false);
  if (!landed) {
    // Say which of the two it is. A raw timeout here reads like a broken page,
    // and four times out of five it is the limiter: 5 sign-ins per IP per 15
    // minutes, counted in the server process, so a fourth run in a row against
    // the same process cannot get in.
    console.log("  FAIL: could not sign in - RESTART THE SERVER (login is rate limited per process), or the demo env is not set");
    process.exit(1);
  }
  SESSION = await ctx.storageState();
  await ctx.close();
};
const signIn = async (page) => {
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
};

const box = (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s);
  if (!el) return null;
  const cs = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  return { display: cs.display, h: Math.round(r.height), bottom: Math.round(r.bottom) };
}, sel);

// ---- 1. the two CSS branches must agree ----
{
  const walk = (d) => readdirSync(d).flatMap((f) => {
    const p = join(d, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
  const css = walk('.next/static').filter((p) => p.endsWith('.css')).map((p) => readFileSync(p, 'utf8')).join('\n');
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const classes = [...new Set(css.match(/\.standalone\\:[^{\s,]+/g) || [])];
  // Since DASHBOARD BRIEF #3 nothing depends on app mode (the tab bar shows on
  // every phone), so zero standalone utilities is correct now. Any that come
  // back must still carry both branches.
  for (const c of classes) {
    const re = new RegExp(`${esc(c)}(?:[^{,]*)\\{([^}]*)\\}`, 'g');
    let m; const media = []; const attr = [];
    while ((m = re.exec(css)) !== null) {
      const before = css.slice(Math.max(0, m.index - 260), m.index);
      (/html\[data-standalone\]\s$/.test(before) ? attr : media).push({ decl: m[1], before });
    }
    const mediaHit = media.find((x) => x.before.includes('display-mode:standalone'));
    ok(!!mediaHit, `css ${c}: no (display-mode: standalone) rule - Android and iOS 16.4+ would get nothing`);
    ok(!!attr[0], `css ${c}: no html[data-standalone] rule - older iPhones would get nothing`);
    if (mediaHit && attr[0]) ok(mediaHit.decl === attr[0].decl, `css ${c}: branches declare different things`);
  }
}

const b = await chromium.launch({ executablePath: process.env.PW_BIN || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
await bootstrap(b);

// ---- 2. manifest, icons, worker ----
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, storageState: SESSION });
  const page = await ctx.newPage();
  await signIn(page);

  const head = await page.evaluate(() => ({
    manifest: document.querySelector('link[rel=manifest]')?.getAttribute('href') || '',
    apple: document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href') || '',
    cap: document.querySelector('meta[name=apple-mobile-web-app-capable]')?.content || '',
    title: document.querySelector('meta[name=apple-mobile-web-app-title]')?.content || '',
  }));
  ok(head.manifest === '/manifest.webmanifest', `head: manifest link is "${head.manifest}"`);
  ok(head.apple === '/icons/apple-touch-icon.png', `head: apple-touch-icon is "${head.apple}"`);
  ok(head.cap === 'yes', 'head: web-app-capable missing');
  ok(head.title === 'Dashboard', `head: home-screen label is "${head.title}", which would not tell the two apps apart`);

  const mf = await page.evaluate(async () => {
    const r = await fetch('/manifest.webmanifest');
    const j = await r.json();
    const by = (p) => (j.icons || []).filter((i) => i.purpose === p).map((i) => i.sizes).sort().join(',');
    return { status: r.status, display: j.display, name: j.short_name, any: by('any'), maskable: by('maskable') };
  });
  ok(mf.status === 200 && mf.display === 'standalone', `manifest: HTTP ${mf.status}, display ${mf.display}`);
  ok(mf.name === 'Dashboard', `manifest: short_name is "${mf.name}"`);
  ok(mf.any === '192x192,512x512', `manifest: "any" icons are ${mf.any}`);
  ok(mf.maskable === '192x192,512x512', `manifest: "maskable" icons are ${mf.maskable}`);

  // The icons must actually be reachable AND must not be the site's gold tile.
  const icon = await page.evaluate(async () => {
    const r = await fetch('/icons/icon-192.png');
    if (!r.ok) return { status: r.status };
    const buf = new Uint8Array(await r.arrayBuffer());
    return { status: r.status, bytes: buf.length };
  });
  ok(icon.status === 200 && icon.bytes > 300, `icon-192: HTTP ${icon.status}, ${icon.bytes} bytes`);
  const site = readFileSync('/home/user/CUE/public/assets/icons/icon-192.png');
  const mine = readFileSync('public/icons/icon-192.png');
  ok(!site.equals(mine), 'icon-192 is byte-identical to the site\'s - two identical tiles on one home screen');

  const sw = await page.evaluate(async () => {
    for (let i = 0; i < 40; i += 1) {
      const r = await navigator.serviceWorker.getRegistration();
      if (r) return true;
      await new Promise((f) => setTimeout(f, 150));
    }
    return false;
  });
  ok(sw, 'service worker never registered');

  // The rule this worker exists to honour: nothing from the server is cached.
  const src = readFileSync('public/sw.js', 'utf8');
  ok(src.includes("url.pathname.startsWith('/api/')") && /\/api\/[^\n]*return;/.test(src),
     'sw: /api/ is not excluded - live bookings and prices could be served from cache');
  await page.close();
  await ctx.close();
}

// ---- 3. browser tab: the bar shows on phones, not on desktop (BRIEF #3) ----
for (const w of [390, 768, 1280]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 844 }, storageState: SESSION });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await signIn(page);
  const nav = await box(page, '[data-appnav]');
  if (w > 992) ok(nav && nav.display === 'none', `tab ${w}: bottom bar is showing on desktop`);
  else ok(nav && nav.display !== 'none', `tab ${w}: no bottom bar on a phone in a browser tab`);
  ok(errs.length === 0, `tab ${w}: page errors ${errs.join(' | ')}`);
  await page.close();
  await ctx.close();
}

// ---- 4. app mode ----
for (const w of [390, 768]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 844 }, storageState: SESSION });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await appMode(page);
  await signIn(page);

  const nav = await box(page, '[data-appnav]');
  ok(nav && nav.display !== 'none', `app ${w}: bottom bar is not showing in app mode`);
  if (nav && nav.display !== 'none') {
    ok(nav.bottom === 844, `app ${w}: bar bottom ${nav.bottom}, expected flush at 844`);
    const pad = await page.evaluate(() => parseFloat(getComputedStyle(document.body).paddingBottom));
    ok(pad >= nav.h, `app ${w}: body reserves ${pad}px for a ${nav.h}px bar`);
    ok(pad - nav.h <= 14, `app ${w}: ${Math.round(pad - nav.h)}px of reserved space wasted under a ${nav.h}px bar`);
    const cells = await page.$$eval('[data-appnav] > *', (e) => e.length);
    ok(cells === 4, `app ${w}: bar has ${cells} items, expected 4`);
  }

  // Exactly one item is marked current, and tapping another moves it - the bar
  // and the rail share one piece of state, so this also proves they agree.
  const current = () => page.$$eval('[data-appnav] [aria-current="page"]', (e) => e.map((x) => x.textContent.trim()));
  const before = await current();
  ok(before.length === 1, `app ${w}: ${before.length} items marked current, expected 1`);
  await page.click('[data-appnav] button:has-text("Prices")').catch(() => {});
  await page.waitForTimeout(500);
  const after = await current();
  ok(after.length === 1 && after[0] === 'Prices', `app ${w}: tapping Prices left "${after.join(',')}" current`);
  const onPrices = await page.locator("input[placeholder=\"Search a tour, place or transfer\"]").first().isVisible().catch(() => false);
  ok(onPrices, `app ${w}: tapping Prices did not open the prices section`);

  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok(over <= 0, `app ${w}: page overflows by ${over}px`);
  ok(errs.length === 0, `app ${w}: page errors ${errs.join(' | ')}`);
  await page.close();
  await ctx.close();
}

// ---- 5. desktop app mode keeps the rail and gets no bar ----
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, storageState: SESSION });
  const page = await ctx.newPage();
  await appMode(page);
  await signIn(page);
  const nav = await box(page, '[data-appnav]');
  ok(nav && nav.display === 'none', '1280: bottom bar showing on desktop app mode');
  const rail = await page.locator('aside').first().isVisible().catch(() => false);
  ok(rail, '1280: the rail disappeared in desktop app mode');
  await page.close();
  await ctx.close();
}

await b.close();
console.log(`${pass}/${pass + fail}`);
