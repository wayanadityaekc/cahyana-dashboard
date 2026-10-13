// The coin routes' one door. Owner cookie only (withSession reads cue_dash; the
// driver cookie is a different name and never opens these). A live session goes
// to cahyana-api through pass(); the demo is answered from lib/demo.js and never
// leaves this server.
import { NextResponse } from 'next/server';
import { withSession } from './upstream.js';
import { clearedCookie } from './session.js';
import { expired, pass } from './passthrough.js';

export { readBody } from './passthrough.js';
import { demoCoins, readCoinPatch, coinPatchCookie, coinPatchTooBig } from './demo.js';

const NO_STORE = { 'Cache-Control': 'no-store' };

export function notFound() {
  return NextResponse.json({ status: 'error', detail: 'Not found.' }, { status: 404 });
}

export function badRequest(detail) {
  return NextResponse.json({ status: 'error', detail }, { status: 400 });
}

// path: the cahyana-api path (base already ends in /api). demo: [kind, args] for demoCoins.
export async function coinRoute(path, { method = 'GET', body, demo }) {
  let session;
  try { session = await withSession(); } catch (e) { return expired(clearedCookie()); }

  if (!session.demo) return pass(path, { method, body, token: session.token }, clearedCookie());

  const [kind, args = {}] = demo;
  const patch = await readCoinPatch();
  const out = demoCoins(kind, { ...args, body: body || {}, patch });
  if (out.patch && coinPatchTooBig(out.patch)) {
    return NextResponse.json({ status: 'error', detail: 'The demo keeps only a few coin edits. Sign out and in again to start fresh.' }, { status: 409 });
  }
  const res = NextResponse.json(out.body, { status: out.http || 200, headers: NO_STORE });
  if (out.patch) res.cookies.set(coinPatchCookie(out.patch));
  return res;
}

// Booking refs are CUE-123 or UPV-AB12CD; nothing else is forwarded into a path.
export const REF_RE = /^[A-Za-z0-9-]{1,40}$/;
