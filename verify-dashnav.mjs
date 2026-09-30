import { chromium } from '/home/user/CUE/node_modules/playwright-core/index.mjs';

// DASHBOARD BRIEF #1/#2: navbar, phone drawer and bottom tab bar measured
// AGAINST THE PUBLIC SITE, not against numbers typed in here. Every "same as
// CUE" value is read from CUE's own built pages in the same browser at the same
// width, so this file cannot agree with itself by accident.
//
// Needs two servers:
//   CUE:       cd ../CUE && npm run build && node tools/serve-out.js      (port 4000)
//   dashboard: DEMO_ENABLED=true DEMO_USER=demo DEMO_PASS=demo npx next start -p 3100
// RESTART the dashboard before every run: sign-in is rate limited per process.
const DASH = process.env.BASE || 'http://localhost:3100';
const CUE = process.env.CUE || 'http://localhost:4000';
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log('  FAIL:', m)); };
const near = (a, b, t = 0.6) => a != null && b != null && Math.abs(a - b) <= t;

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

// Sign in once, reuse the cookie everywhere (5 sign-ins per 15 min per process).
let SESSION;
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(DASH + '/login', { waitUntil: 'networkidle' });
  await page.fill('#adm-user', 'demo');
  await page.fill('#adm-pass', 'demo');
  await page.click('button[type=submit]');
  const landed = await page.waitForURL((u) => new URL(u).pathname === '/', { timeout: 20000 }).then(() => true).catch(() => false);
  if (!landed) { console.log('  FAIL: could not sign in - restart the dashboard server'); process.exit(1); }
  SESSION = await ctx.storageState();
  await ctx.close();
}

const appMode = (page) => page.addInitScript(() => {
  const mark = () => { document.documentElement.dataset.standalone = '1'; };
  if (document.documentElement) mark();
  else document.addEventListener('readystatechange', mark, { once: true });
});

// Everything the two headers are compared on, read the same way on both sides.
// `row` is the nav row (the site puts its trip bar above it inside <header>).
const measure = (page, sel) => page.evaluate((S) => {
  const q = (s) => (s ? document.querySelector(s) : null);
  const rect = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, r: r.right, b: r.bottom }; };
  const cs = (el) => (el ? getComputedStyle(el) : null);
  const header = q('header');
  const row = q(S.row);
  const burger = q('#hamburger');
  const bars = burger ? [...burger.children].map((s) => rect(s)) : [];
  const logo = q('header a img');
  const chat = q(S.chat);
  const chatSvg = chat && chat.querySelector('svg');
  const drawer = q('#nav-menu');
  const head = drawer && drawer.firstElementChild;
  const x = head && head.querySelector('button');
  const rowOn = q(S.rowOn);
  const rowOff = q(S.rowOff);
  const pick = (el) => { const c = cs(el); return c && { fs: c.fontSize, fw: c.fontWeight, pad: c.padding, rad: c.borderRadius, bg: c.backgroundColor, color: c.color, h: el.getBoundingClientRect().height }; };
  return {
    headerShadow: cs(header).boxShadow, headerBg: cs(header).backgroundColor,
    headerBottom: header.getBoundingClientRect().bottom,
    rowPadL: parseFloat(cs(row).paddingLeft), rowPadR: parseFloat(cs(row).paddingRight),
    rowPadT: parseFloat(cs(row).paddingTop), rowH: row.getBoundingClientRect().height,
    burger: burger && cs(burger).display !== 'none' ? rect(burger) : null,
    bars, barBg: bars.length ? cs(burger.children[0]).backgroundColor : null,
    logoH: logo ? logo.getBoundingClientRect().height : null,
    chat: chatSvg ? { ...rect(chatSvg), color: cs(chat).color } : null,
    chatInDrawer: !!(chat && drawer && drawer.contains(chat)),
    drawer: drawer ? { ...rect(drawer), display: cs(drawer).display, bg: cs(drawer).backgroundColor, padL: cs(drawer).paddingLeft } : null,
    head: head ? { h: head.getBoundingClientRect().height, bb: cs(head).borderBottom } : null,
    x: x ? { ...rect(x), rad: cs(x).borderRadius, border: cs(x).border } : null,
    rowOn: pick(rowOn), rowOff: pick(rowOff),
    slotRight: q('[data-account-slot]')?.getBoundingClientRect().right ?? null,
  };
}, sel);

const CUE_SEL = { row: 'header > div:nth-child(2)', chat: 'header button[aria-label="Chat with us"]', rowOn: '#nav-menu a[href="/"]', rowOff: '#nav-menu a[href="/bali-guide.html"]' };
const DASH_SEL = { row: 'header > div:first-child', chat: '[data-nav-chat]', rowOn: '[data-drawer-row="upcoming"]', rowOff: '[data-drawer-row="attention"]' };

const openDrawer = async (page) => {
  await page.click('#hamburger');
  await page.waitForTimeout(450);
};

for (const w of [320, 390, 768, 1280]) {
  const phone = w <= 992;
  const cctx = await b.newContext({ viewport: { width: w, height: 844 } });
  const cpage = await cctx.newPage();
  await cpage.goto(CUE + '/', { waitUntil: 'networkidle' });
  const cue = await measure(cpage, CUE_SEL);
  let cueOpen = null;
  if (phone) { await openDrawer(cpage); cueOpen = await measure(cpage, CUE_SEL); }

  const ctx = await b.newContext({ viewport: { width: w, height: 844 }, storageState: SESSION });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(DASH + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const d = await measure(page, DASH_SEL);

  // Header shell.
  ok(d.headerShadow === 'none', `${w}: navbar has a shadow (${d.headerShadow}); the site has none`);
  ok(d.headerBg === cue.headerBg, `${w}: navbar bg ${d.headerBg} vs site ${cue.headerBg}`);
  ok(near(d.rowPadL, cue.rowPadL) && near(d.rowPadR, cue.rowPadR), `${w}: nav gutter ${d.rowPadL}/${d.rowPadR} vs site ${cue.rowPadL}/${cue.rowPadR}`);
  ok(near(d.rowPadT, cue.rowPadT), `${w}: nav row padding-top ${d.rowPadT} vs site ${cue.rowPadT}`);
  ok(near(d.logoH, cue.logoH), `${w}: logo ${d.logoH}px tall vs site ${cue.logoH}`);

  // Hamburger: phones only, same place, same bars.
  if (phone) {
    ok(!!d.burger, `${w}: no hamburger on a phone`);
    if (d.burger && cue.burger) {
      ok(near(d.burger.x, cue.burger.x) && near(d.burger.w, cue.burger.w) && near(d.burger.h, cue.burger.h),
        `${w}: hamburger box ${JSON.stringify([d.burger.x, d.burger.w, d.burger.h])} vs site ${JSON.stringify([cue.burger.x, cue.burger.w, cue.burger.h])}`);
      ok(d.bars.length === 3 && d.bars.every((r, i) => near(r.w, cue.bars[i].w) && near(r.h, cue.bars[i].h) && near(r.y - d.burger.y, cue.bars[i].y - cue.burger.y)),
        `${w}: hamburger bars differ from the site's`);
      ok(d.barBg === cue.barBg, `${w}: hamburger colour ${d.barBg} vs site ${cue.barBg}`);
    }
  } else {
    ok(!d.burger, `${w}: hamburger showing on desktop - the rail is desktop's menu`);
  }

  // Chat: its own icon in the bar, never in the drawer, same icon as the site's.
  ok(!!d.chat, `${w}: no chat icon in the navbar`);
  ok(!d.chatInDrawer, `${w}: chat is inside the drawer`);
  if (d.chat && cue.chat) {
    ok(near(d.chat.w, cue.chat.w) && near(d.chat.h, cue.chat.h), `${w}: chat icon ${d.chat.w}x${d.chat.h} vs site ${cue.chat.w}x${cue.chat.h}`);
    ok(d.chat.color === cue.chat.color, `${w}: chat icon colour ${d.chat.color} vs site ${cue.chat.color}`);
  }

  // Header never covers the page's first line.
  const h1 = await page.evaluate(() => document.querySelector('h1')?.getBoundingClientRect().top);
  ok(h1 >= d.headerBottom, `${w}: navbar (bottom ${d.headerBottom}) covers the h1 (top ${h1})`);

  // Sign out: in the account slot at every width, not in the content toolbar.
  const strayOut = await page.evaluate(() => [...document.querySelectorAll('main button')].some((x) => /sign out/i.test(x.textContent)));
  ok(!strayOut, `${w}: Sign out is still in the content toolbar`);
  await page.click('[data-account-slot] > button');
  await page.waitForTimeout(150);
  const acct = await page.evaluate(() => {
    const slot = document.querySelector('[data-account-slot]');
    const btn = [...slot.querySelectorAll('button')].find((x) => /sign out/i.test(x.textContent));
    const r = slot.getBoundingClientRect();
    return { visible: !!btn && btn.getBoundingClientRect().height > 0, right: r.right };
  });
  ok(acct.visible, `${w}: account menu has no visible Sign out`);
  // Same right edge as the site's account slot (the site's row caps at 1200px too).
  ok(near(acct.right, cue.slotRight), `${w}: account slot ends at ${acct.right}, site's at ${cue.slotRight}`);
  await page.keyboard.press('Escape');

  // Chat icon opens the Chat section.
  await page.click('[data-nav-chat]');
  await page.waitForTimeout(300);
  const onChat = await page.evaluate(() => document.querySelector('[data-nav-chat]').getAttribute('aria-current'));
  ok(onChat === 'page', `${w}: tapping the chat icon did not open Chat`);

  if (phone) {
    ok(d.drawer && d.drawer.x < 0, `${w}: drawer is on screen before it was opened`);
    // Back to Upcoming so the active row is known.
    await openDrawer(page);
    await page.click('[data-drawer-row="upcoming"]');
    await page.waitForTimeout(450);
    await openDrawer(page);
    const o = await measure(page, DASH_SEL);
    ok(near(o.drawer.x, 0), `${w}: open drawer starts at x=${o.drawer.x}, expected the LEFT edge`);
    ok(near(o.drawer.w, cueOpen.drawer.w) && o.drawer.padL === cueOpen.drawer.padL, `${w}: drawer ${o.drawer.w}px/${o.drawer.padL} vs site ${cueOpen.drawer.w}px/${cueOpen.drawer.padL}`);
    ok(near(o.head.h, cueOpen.head.h) && o.head.bb === cueOpen.head.bb, `${w}: drawer head ${o.head.h}/${o.head.bb} vs site ${cueOpen.head.h}/${cueOpen.head.bb}`);
    ok(o.x && near(o.x.w, cueOpen.x.w) && o.x.rad === cueOpen.x.rad && o.x.border === cueOpen.x.border, `${w}: close button differs from the site's`);
    for (const k of ['fs', 'fw', 'pad', 'rad', 'bg']) {
      ok(o.rowOn[k] === cueOpen.rowOn[k], `${w}: active drawer row ${k} ${o.rowOn[k]} vs site ${cueOpen.rowOn[k]}`);
      ok(o.rowOff[k] === cueOpen.rowOff[k], `${w}: drawer row ${k} ${o.rowOff[k]} vs site ${cueOpen.rowOff[k]}`);
    }
    ok(near(o.rowOff.h, cueOpen.rowOff.h), `${w}: drawer row ${o.rowOff.h}px tall vs site ${cueOpen.rowOff.h}`);
    const content = await page.evaluate(() => {
      const m = document.querySelector('#nav-menu');
      return {
        rows: [...m.querySelectorAll('[data-drawer-row]')].map((x) => x.dataset.drawerRow),
        chatText: /\bchat\b/i.test(m.textContent),
        site: m.querySelector('[data-drawer-site]')?.getAttribute('href') || '',
        out: !!m.querySelector('[data-drawer-signout]'),
      };
    });
    ok(content.rows.join() === 'attention,upcoming,past,undated,prices,promo,content,reviews', `${w}: drawer sections are ${content.rows.join()}`);
    ok(!content.chatText, `${w}: the drawer mentions Chat`);
    ok(/^https:\/\/cahyanaubudexperience\.com/.test(content.site), `${w}: drawer live-site link is "${content.site}"`);
    ok(content.out, `${w}: drawer has no Sign out`);
    // Picking a section closes the drawer and opens it.
    await page.click('[data-drawer-row="prices"]');
    await page.waitForTimeout(450);
    const after = await page.evaluate(() => ({ x: document.querySelector('#nav-menu').getBoundingClientRect().x, h1: !!document.querySelector('h1') }));
    ok(after.x < 0, `${w}: picking a section left the drawer open`);
    const onPrices = await page.locator('input[placeholder="Search a tour, place or transfer"]').first().isVisible().catch(() => false);
    ok(onPrices, `${w}: picking Prices in the drawer did not open Prices`);
    // The x closes it.
    await openDrawer(page);
    await page.click('#nav-menu button[aria-label="Close menu"]');
    await page.waitForTimeout(450);
    const shut = await page.evaluate(() => document.querySelector('#nav-menu').getBoundingClientRect().right);
    ok(shut <= 0, `${w}: the x did not close the drawer (right edge ${shut})`);
    // No phone list screen and no back row any more.
    const back = await page.evaluate(() => [...document.querySelectorAll('main button')].some((x) => x.getBoundingClientRect().height > 0 && x.textContent.trim() === 'Bookings'));
    ok(!back, `${w}: the old phone back row is still showing`);
  } else {
    ok(!d.drawer || d.drawer.display === 'none', `${w}: drawer rendered on desktop`);
    const rail = await page.evaluate(() => { const a = document.querySelector('aside'); return a ? { w: a.getBoundingClientRect().width, bg: getComputedStyle(a).backgroundColor } : null; });
    ok(rail && near(rail.w, 248) && rail.bg === 'rgb(248, 248, 248)', `${w}: the cream rail changed (${JSON.stringify(rail)})`);
    const frame = await page.evaluate(() => document.querySelector('aside').parentElement.getBoundingClientRect().bottom);
    ok(frame <= 844 + 0.5, `${w}: rail frame runs past the screen (bottom ${frame})`);
  }

  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok(over <= 0, `${w}: page overflows by ${over}px`);
  ok(errs.length === 0, `${w}: page errors ${errs.join(' | ')}`);
  await cctx.close();
  await ctx.close();
}

// ---- tab bar: CUE's book-bar shell, measured off a real book bar ----
{
  const cctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const cpage = await cctx.newPage();
  await cpage.goto(CUE + '/ubud-tour.html', { waitUntil: 'networkidle' });
  const shell = (page, sel) => page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return null;
    const c = getComputedStyle(el);
    return { bt: c.borderTop, bl: c.borderLeftWidth, rtl: c.borderTopLeftRadius, rtr: c.borderTopRightRadius, rbl: c.borderBottomLeftRadius,
      shadow: c.boxShadow, bg: c.backgroundColor, pt: c.paddingTop, pl: c.paddingLeft, pr: c.paddingRight, pb: c.paddingBottom };
  }, sel);
  const ref = await shell(cpage, '.bookbar');
  ok(!!ref, 'site: no .bookbar on /ubud-tour.html to measure against');
  await cctx.close();

  // DASHBOARD BRIEF #3: the bar shows on every phone-sized screen, installed
  // (app) or in a normal browser tab - and never on desktop, in either mode.
  for (const [mode, w] of [['app', 320], ['app', 390], ['app', 768], ['tab', 320], ['tab', 390], ['tab', 768], ['tab', 992], ['app', 1280], ['tab', 1280]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 844 }, storageState: SESSION });
    const page = await ctx.newPage();
    if (mode === 'app') await appMode(page);
    await page.goto(DASH + '/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const shown = await page.evaluate(() => getComputedStyle(document.querySelector('[data-appnav]')).display !== 'none');
    if (w > 992) {
      ok(!shown, `${mode} ${w}: tab bar showing on desktop`);
      await ctx.close();
      continue;
    }
    ok(shown, `${mode} ${w}: no tab bar on a phone-sized screen`);
    const burger = await page.evaluate(() => getComputedStyle(document.querySelector('#hamburger')).display !== 'none');
    ok(burger === shown, `${mode} ${w}: tab bar and hamburger disagree about "phone" (bar ${shown}, burger ${burger})`);
    const bar = await shell(page, '[data-appnav]');
    for (const k of ['bt', 'bl', 'rtl', 'rtr', 'rbl', 'shadow', 'bg', 'pt', 'pl', 'pr', 'pb']) {
      ok(bar && ref && bar[k] === ref[k], `${mode} ${w}: tab bar ${k} "${bar && bar[k]}" vs site book bar "${ref && ref[k]}"`);
    }
    const cells = await page.$$eval('[data-appnav] > button', (e) => e.map((x) => x.textContent.replace(/\d+/g, '').trim()));
    ok(cells.join() === 'Attention,Upcoming,Past,Prices', `${mode} ${w}: tab bar cells are ${cells.join()}`);
    const r = await page.evaluate(() => { const n = document.querySelector('[data-appnav]').getBoundingClientRect(); return { b: n.bottom, h: n.height, pad: parseFloat(getComputedStyle(document.body).paddingBottom) }; });
    ok(near(r.b, 844), `${mode} ${w}: tab bar not flush at the bottom (${r.b})`);
    ok(r.pad >= r.h && r.pad - r.h <= 14, `${mode} ${w}: body reserves ${r.pad}px for a ${r.h}px bar`);
    await ctx.close();
  }
}

// ---- phone content card: padded like the site's (DASHBOARD BRIEF #3) ----
// Compared against CUE's own scroll-frame page (My Trips), which keeps the same
// bordered card on phones. The inset is read from both pages, not typed here.
{
  const card = (page) => page.evaluate(() => {
    const frame = document.querySelector('aside')?.parentElement;
    const main = frame && frame.querySelector('main');
    if (!frame || !main) return null;
    const c = getComputedStyle(frame);
    const fr = frame.getBoundingClientRect();
    const h1 = document.querySelector('main h1') || main.firstElementChild;
    const hr = h1.getBoundingClientRect();
    return { pl: c.paddingLeft, pr: c.paddingRight, pt: c.paddingTop, pb: c.paddingBottom, border: c.borderLeft,
      rad: c.borderTopLeftRadius, shadow: c.boxShadow, frameX: fr.left, insetX: hr.left - fr.left, insetY: hr.top - fr.top };
  });
  for (const w of [320, 390, 768]) {
    const cctx = await b.newContext({ viewport: { width: w, height: 844 } });
    const cpage = await cctx.newPage();
    await cpage.goto(CUE + '/my-trips.html', { waitUntil: 'networkidle' });
    await cpage.waitForTimeout(400);
    const ref = await card(cpage);
    ok(!!ref, `site ${w}: no rail frame on /my-trips.html to measure against`);
    await cctx.close();

    const ctx = await b.newContext({ viewport: { width: w, height: 844 }, storageState: SESSION });
    const page = await ctx.newPage();
    await page.goto(DASH + '/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const d = await card(page);
    for (const k of ['pl', 'pr', 'pt', 'pb', 'border', 'rad', 'shadow']) {
      ok(d && ref && d[k] === ref[k], `card ${w}: ${k} "${d && d[k]}" vs site "${ref && ref[k]}"`);
    }
    ok(d && ref && near(d.frameX, ref.frameX), `card ${w}: card starts at x=${d && d.frameX}, site's at ${ref && ref.frameX}`);
    // The actual complaint: the title touched the card edge.
    ok(d && d.insetX >= 16, `card ${w}: title sits ${d && d.insetX}px from the card's left edge`);
    ok(d && d.insetY >= 16, `card ${w}: title sits ${d && d.insetY}px below the card's top edge`);
    await ctx.close();
  }
}

await b.close();
console.log(`${pass}/${pass + fail}`);
process.exit(fail ? 1 : 0);
