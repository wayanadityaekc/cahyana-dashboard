import { NextResponse } from 'next/server';
import { upstream, withSession, Unauthorized } from '@/lib/upstream.js';
import { clearedCookie } from '@/lib/session.js';
import { DEMO_PUSH_EVENTS } from '@/lib/pushEvents.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Settings > Notifications (DASHBOARD BRIEF #5). A thin pass-through to
// cahyana-api's /admin/push/*, carrying the httpOnly session like every other
// route here. Only these names go through - the path is never built from
// whatever the browser sends.
const POSTS = new Set(['status', 'subscribe', 'prefs', 'unsubscribe', 'test']);

function expired() {
  const res = NextResponse.json({ status: 'error', detail: 'Session expired.' }, { status: 401 });
  res.cookies.set(clearedCookie());
  return res;
}

async function pass(path, opts) {
  try {
    const out = await upstream(path, opts);
    return NextResponse.json(out.json, { status: out.status, headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    if (e instanceof Unauthorized) return expired();
    return NextResponse.json({ status: 'error', detail: 'Could not reach the API.' }, { status: 502 });
  }
}

export async function GET(req, { params }) {
  const { action } = await params;
  if (action !== 'config') return NextResponse.json({ status: 'error', detail: 'Not found.' }, { status: 404 });
  let s;
  try { s = await withSession(); } catch { return expired(); }
  // The demo never reaches the API, so it can never receive a push.
  if (s.demo) return NextResponse.json({ status: 'ok', configured: false, demo: true, publicKey: '', events: DEMO_PUSH_EVENTS });
  return pass('/admin/push/config', { token: s.token });
}

export async function POST(req, { params }) {
  const { action } = await params;
  if (!POSTS.has(action)) return NextResponse.json({ status: 'error', detail: 'Not found.' }, { status: 404 });
  let s;
  try { s = await withSession(); } catch { return expired(); }
  if (s.demo) return NextResponse.json({ status: 'error', detail: 'Push is off in the demo.' }, { status: 409 });
  let body = {};
  try { body = await req.json(); } catch { /* upstream validates */ }
  return pass(`/admin/push/${action}`, { method: 'POST', token: s.token, body });
}
