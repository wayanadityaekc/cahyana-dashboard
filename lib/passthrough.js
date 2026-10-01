// Shared by the brief #7 routes (drivers, dispatch, driver chats, driver app):
// call cahyana-api, answer with what it said, and turn a dead session into a
// cleared cookie + 401 so the page goes back to its sign-in.
import { NextResponse } from 'next/server';
import { upstream, withSession, withDriver, Unauthorized } from './upstream.js';
import { clearedCookie } from './session.js';
import { clearedDriverCookie } from './driverSession.js';

const NO_STORE = { 'Cache-Control': 'no-store' };

function expired(cookie) {
  const res = NextResponse.json({ status: 'error', detail: 'Session expired.' }, { status: 401 });
  res.cookies.set(cookie);
  return res;
}

async function pass(path, opts, cookie) {
  try {
    const out = await upstream(path, opts);
    return NextResponse.json(out.json ?? {}, { status: out.status, headers: NO_STORE });
  } catch (e) {
    if (e instanceof Unauthorized) return expired(cookie);
    return NextResponse.json({ status: 'error', detail: 'Could not reach the API.' }, { status: 502 });
  }
}

export async function readBody(req) {
  try { return await req.json(); } catch { return {}; }
}

// Owner routes. The demo never reaches the API: drivers are real people with
// real phones (Wayan, brief #7 Q6: "no demo"), so the demo gets an empty,
// read-only answer and a 409 for anything that would write.
export async function owner(path, { method = 'GET', body, demoEmpty } = {}) {
  let s;
  try { s = await withSession(); } catch { return expired(clearedCookie()); }
  if (s.demo) {
    if (method === 'GET' && demoEmpty) return NextResponse.json({ status: 'ok', demo: true, ...demoEmpty }, { headers: NO_STORE });
    return NextResponse.json({ status: 'error', detail: 'Drivers are not part of the demo.' }, { status: 409 });
  }
  return pass(path, { method, body, token: s.token }, clearedCookie());
}

// Driver routes: the driver cookie, never the owner's.
export async function driver(path, { method = 'GET', body } = {}) {
  let t;
  try { t = await withDriver(); } catch { return expired(clearedDriverCookie()); }
  return pass(path, { method, body, token: t }, clearedDriverCookie());
}
