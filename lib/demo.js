// The demo account. It exists so a recruiter can click through this dashboard
// without an account, and its rule is absolute: a demo request NEVER reaches
// cahyana-api. Its password is printed in the README - forwarding it would put
// a public password against the real door and spend the real rate limit.
import { cookies } from 'next/headers';
import { demoPrices, demoBaseIdr, demoBookings, demoCoinLedger, DEMO_COIN_EARN, DEMO_COIN_PCT, DEMO_COIN_MENU } from './demoData.js';
import { COIN_CATEGORIES, COIN_VILLAS, isLive } from './coinLabels.js';

// Off unless the deployment says otherwise, so a copy of this repo started
// locally without an env file has no open door at all.
export function demoEnabled() {
  return String(process.env.DEMO_ENABLED || '') === 'true';
}

export function demoCredsMatch(user, pass) {
  const u = process.env.DEMO_USER || '';
  const p = process.env.DEMO_PASS || '';
  return Boolean(u) && Boolean(p) && user === u && pass === p;
}

// Demo price edits are real edits - they just live in the visitor's own cookie
// instead of a database. Two people on the demo at once never see each other's
// changes, and nothing is written anywhere. Save and Reset behave exactly as
// they do on the live panel, which is the point: a demo that cannot be typed
// into is a screenshot.
const PATCH = 'cue_dash_demo_prices';
const MAX_BYTES = 3000;

export async function readPatch() {
  const jar = await cookies();
  const raw = jar.get(PATCH)?.value;
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw);
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {};
  } catch { return {}; }
}

export function patchCookie(patch) {
  const value = JSON.stringify(patch);
  return {
    name: PATCH,
    // Too big to store is a bug in the caller, not something to silently trim.
    value: value.length > MAX_BYTES ? '{}' : value,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24,
  };
}

export async function demoPricesFor() {
  return demoPrices(await readPatch());
}

// Same validation the live route applies, so the demo teaches the real rules:
// integers only, IDR only, and a move of 3x or more has to be confirmed.
export const BIG_MOVE = 3;
const MAX_IDR = 100000000;

export function applyDemoEdit(patch, { name, idr, clear, confirm }) {
  const base = demoBaseIdr(name);
  if (base == null) return { error: { http: 400, body: { status: 'error', detail: 'Unknown item.' } } };

  const next = { ...patch };
  if (clear) { delete next[name]; return { patch: next }; }

  if (!Number.isInteger(idr) || idr <= 0 || idr > MAX_IDR) {
    return { error: { http: 400, body: { status: 'error', detail: 'Price must be a whole number of rupiah.' } } };
  }
  // Same sentence and same body shape as the live route, so the panel needs
  // no branch for "is this the demo".
  const ratio = idr > base ? idr / base : base / idr;
  if (ratio >= BIG_MOVE && !confirm) {
    return {
      error: {
        http: 409,
        body: {
          status: 'confirm',
          detail: 'That is ' + ratio.toFixed(1) + 'x the current price. Confirm to save it.',
          base, idr,
        },
      },
    };
  }
  next[name] = idr;
  return { patch: next };
}

// ---- demo chat replies ---------------------------------------------------
// The demo's own replies, in the demo visitor's cookie. Same bargain as the
// demo price edits: they are real edits, they just live in that browser. A
// reply box that does nothing is a screenshot, not a demo.
const CHAT = 'cue_dash_demo_chat';

export async function readChatPatch() {
  const jar = await cookies();
  const raw = jar.get(CHAT)?.value;
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw);
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {};
  } catch { return {}; }
}

export function chatPatchCookie(patch) {
  const value = JSON.stringify(patch);
  return {
    name: CHAT,
    value: value.length > MAX_BYTES ? '{}' : value,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24,
  };
}

// Mirrors the real route's cap so the demo teaches the real limit.
const MAX_REPLY = 2000;

export function appendDemoReply(patch, id, text) {
  const body = String(text).slice(0, MAX_REPLY);
  const next = { ...patch };
  const list = [...(next[id] || [])];
  const message = { id: Date.now(), sender: 'owner', body, created_at: new Date().toISOString() };
  list.push({ sender: 'owner', body, created_at: message.created_at });
  next[id] = list;
  return { patch: next, message };
}

// --- the demo's own seasonal sale ------------------------------------------
// Same shape and the SAME RULES the API enforces, so the demo teaches what the
// live panel does rather than a simplified version of it. It lives in the
// visitor's cookie: nothing is written anywhere and two people on the demo at
// once never see each other's sale.
const PROMO = 'cue_dash_demo_promo';
// Mirrors promo.MIN_PCT in cahyana-api, which is payment.REFERRAL_DISCOUNT_PCT.
// A sale smaller than the referral discount would leave a code holder worse off
// than before, so it is refused at the door there and here.
export const DEMO_MIN_PCT = 5;
export const DEMO_MAX_PCT = 50;

function baliToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Makassar', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}

function shape(stored) {
  const live = stored && (!stored.endsOn || stored.endsOn >= baliToday()) ? stored : null;
  return {
    status: 'ok',
    stored: stored || null,
    live,
    today: baliToday(),
    categories: ['tour', 'place', 'experience', 'performance', 'combo'],
    minPct: DEMO_MIN_PCT,
    maxPct: DEMO_MAX_PCT,
    note: live ? 'Referral codes are superseded while a sale runs - the sale is the bigger discount.' : '',
  };
}

export async function readPromo() {
  const jar = await cookies();
  const raw = jar.get(PROMO)?.value;
  if (!raw) return shape(null);
  try {
    const obj = JSON.parse(raw);
    return shape(obj && typeof obj === 'object' && obj.pct ? obj : null);
  } catch { return shape(null); }
}

export function promoCookie(state) {
  return {
    name: PROMO,
    value: JSON.stringify(state.stored || null),
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24,
  };
}

export function applyDemoPromo(body) {
  if (body && body.stop === true) return { state: shape(null) };
  const pct = Math.round(Number(body && body.pct));
  const endsOn = body && body.endsOn ? String(body.endsOn) : '';
  if (!Number.isFinite(pct) || pct < DEMO_MIN_PCT || pct > DEMO_MAX_PCT) {
    return { error: { http: 400, body: { status: 'error', detail: `pct must be a whole number between ${DEMO_MIN_PCT} and ${DEMO_MAX_PCT}` } } };
  }
  if (endsOn && !/^\d{4}-\d{2}-\d{2}$/.test(endsOn)) {
    return { error: { http: 400, body: { status: 'error', detail: 'endsOn must be YYYY-MM-DD' } } };
  }
  if (endsOn && endsOn < baliToday()) {
    return { error: { http: 400, body: { status: 'error', detail: 'endsOn is already in the past in Bali' } } };
  }
  return { state: shape({ pct, endsOn: endsOn || null, label: String((body && body.label) || '').slice(0, 80) }) };
}

// --- the demo's own coins ---------------------------------------------------
// Same bargain as the demo sale: the same rules the API enforces, the edits held
// in the visitor's own cookie, nothing written anywhere. The patch keeps only
// what changed: rules, the perk menu, ledger rows added here, refs refunded here.
const COINS = 'cue_dash_demo_coins';

export async function readCoinPatch() {
  const jar = await cookies();
  const raw = jar.get(COINS)?.value;
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw);
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {};
  } catch (e) { return {}; }
}

export function coinPatchCookie(patch) {
  return {
    name: COINS,
    value: JSON.stringify(patch),
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24,
  };
}

function wholeIn(value, min, max) {
  const n = Number(value);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

function demoError(http, detail) {
  return { http, body: { status: 'error', detail } };
}

function demoToday() {
  return new Date().toISOString().slice(0, 10);
}

function coinRules(patch) {
  return { earn: { ...DEMO_COIN_EARN, ...(patch.earn || {}) }, pct: { ...DEMO_COIN_PCT, ...(patch.pct || {}) } };
}

function coinMenu(patch) {
  return patch.menu || DEMO_COIN_MENU;
}

// Seed rows plus rows added in this session, with this session's refunds applied
// only to the rows that existed when the refund was recorded.
function coinLedger(patch) {
  const rows = [...demoCoinLedger(), ...(patch.extra || [])];
  return (patch.rev || []).reduce((acc, { ref, upTo }) => acc.map((row, index) => {
    if (row.ref !== ref || index >= upTo) return row;
    if (row.delta > 0 && row.status === 'posted') return { ...row, status: 'reversed', note: 'Refunded' };
    if (row.delta < 0 && isLive(row.status)) return { ...row, status: 'released', note: 'Refunded' };
    return row;
  }), rows);
}

function coinSummary(patch, email) {
  const mine = coinLedger(patch).filter((row) => row.email === email);
  const live = mine.filter((row) => isLive(row.status));
  const balance = live.reduce((sum, row) => sum + row.delta, 0);
  // Same shape as the API ({ date, coins }); the demo does not age spends against buckets.
  const soonest = live.filter((row) => row.delta > 0 && row.expires).map((row) => row.expires).sort()[0];
  const expiring = live.filter((row) => row.delta > 0 && row.expires === soonest).reduce((sum, row) => sum + row.delta, 0);
  return {
    balance: Math.max(0, balance),
    nextExpiry: soonest ? { date: soonest, coins: Math.min(expiring, Math.max(0, balance)) } : null,
    history: [...mine].reverse().map(({ delta, source, ref, status, date, expires }) => ({ delta, source, ref, status, date, expires })),
  };
}

function demoAccount(email) {
  const wanted = String(email || '').trim().toLowerCase();
  const guests = [...new Set(Object.values(demoBookings()).flat().filter((g) => g && g.email).map((g) => g.email))];
  const found = guests.find((guest) => guest.toLowerCase() === wanted);
  return found ? { id: 9000 + guests.indexOf(found), email: found } : null;
}

// One answer per coin route, same shapes and the same refusals as the API.
export function demoCoins(kind, { patch = {}, body = {}, email = '', ref = '' } = {}) {
  if (kind === 'rules') return { body: { status: 'ok', demo: true, ...coinRules(patch), menu: coinMenu(patch) } };

  if (kind === 'saveRules') {
    const earn = body.earn && typeof body.earn === 'object' ? body.earn : {};
    const pct = body.pct && typeof body.pct === 'object' ? body.pct : {};
    const badEarn = Object.keys(earn).find((cat) => !COIN_CATEGORIES.includes(cat) || wholeIn(earn[cat], 0, 50) == null);
    const badPct = Object.keys(pct).find((cat) => !COIN_CATEGORIES.includes(cat) || wholeIn(pct[cat], 1, 100) == null);
    if (badEarn) return demoError(400, `earn.${badEarn} must be a whole number 0-50 for a known category`);
    if (badPct) return demoError(400, `pct.${badPct} must be a whole number 1-100 for a known category`);
    const next = { ...patch, earn: { ...(patch.earn || {}), ...earn }, pct: { ...(patch.pct || {}), ...pct } };
    return { patch: next, body: { status: 'ok', demo: true, ...coinRules(next) } };
  }

  if (kind === 'saveMenu') {
    const label = String(body.label || '').trim();
    const cost = wholeIn(body.coins, 1, 100);
    if (!COIN_VILLAS.includes(String(body.property || ''))) return demoError(400, 'Unknown property');
    if (!label || label.length > 120) return demoError(400, 'Label is required (120 characters max)');
    if (cost == null) return demoError(400, 'coins must be a whole number 1-100');
    const menu = coinMenu(patch);
    const id = body.id != null ? wholeIn(body.id, 1, 2147483647) : null;
    const item = { id: id || Math.max(0, ...menu.map((row) => row.id)) + 1, property: body.property, item_label: label, coin_cost: cost, active: body.active !== false, service_id: body.serviceId || null };
    if (id && !menu.some((row) => row.id === id)) return demoError(404, 'No such menu item');
    const nextMenu = id ? menu.map((row) => (row.id === id ? item : row)) : [...menu, item];
    return { patch: { ...patch, menu: nextMenu }, body: { status: 'ok', demo: true, item } };
  }

  if (kind === 'account') {
    const acc = demoAccount(email);
    if (!acc) return demoError(404, 'No account with that email');
    return { body: { status: 'ok', demo: true, account: acc, ...coinSummary(patch, acc.email) } };
  }

  if (kind === 'adjust') {
    const delta = wholeIn(body.delta, -100, 100);
    const note = String(body.note || '').trim().slice(0, 200);
    if (!delta) return demoError(400, 'delta must be a non-zero whole number -100..100');
    if (!note) return demoError(400, 'note is required');
    const acc = demoAccount(body.email);
    if (!acc) return demoError(404, 'No account with that email');
    const { balance } = coinSummary(patch, acc.email);
    if (delta < 0 && balance + delta < 0) return { http: 409, body: { status: 'error', detail: 'Not enough coins', balance } };
    const today = demoToday();
    const expires = delta > 0 ? `${Number(today.slice(0, 4)) + 3}${today.slice(4)}` : null;
    const row = { email: acc.email, delta, source: 'adjust', ref: null, status: 'posted', note, date: today, expires };
    const next = { ...patch, extra: [...(patch.extra || []), row] };
    return { patch: next, body: { status: 'ok', demo: true, ...coinSummary(next, acc.email) } };
  }

  if (kind === 'booking') {
    const rows = coinLedger(patch).filter((row) => row.ref === ref)
      .map(({ delta, source, status, note, date, expires }) => ({ delta, source, status, note, created_at: date, expires_at: expires }));
    return { body: { status: 'ok', demo: true, ref, rows } };
  }

  if (kind === 'redeem') {
    const itemId = wholeIn(body.itemId, 1, 2147483647);
    if (!body.ref || itemId == null) return demoError(400, 'ref and itemId are required');
    const group = Object.values(demoBookings()).flat().find((g) => g && g.ref === body.ref);
    const stay = group && group.lines.find((line) => line.type === 'villa');
    if (!stay) return { http: 409, body: { status: 'error', ok: false, reason: 'no villa stay on this booking', detail: 'no villa stay on this booking' } };
    return demoError(409, 'unknown menu item');
  }

  if (kind === 'reverse') {
    if (!body.ref) return demoError(400, 'ref is required');
    const before = coinLedger(patch);
    const upTo = before.length;
    const next = { ...patch, rev: [...(patch.rev || []), { ref: String(body.ref), upTo }] };
    const after = coinLedger(next);
    const changed = (status) => after.filter((row, index) => row.status === status && before[index].status !== status).length;
    return { patch: next, body: { status: 'ok', demo: true, reversed: changed('reversed'), returned: changed('released') } };
  }

  return demoError(404, 'Not found.');
}

// Writes that would grow the cookie past what a browser keeps are refused, never trimmed.
export function coinPatchTooBig(patch) {
  return JSON.stringify(patch).length > MAX_BYTES;
}
