// The demo account. It exists so a recruiter can click through this dashboard
// without an account, and its rule is absolute: a demo request NEVER reaches
// cahyana-api. Its password is printed in the README - forwarding it would put
// a public password against the real door and spend the real rate limit.
import { cookies } from 'next/headers';
import { demoPrices, demoBaseIdr } from './demoData.js';

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
