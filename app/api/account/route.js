import { NextResponse } from 'next/server';
import { upstream, withSession, Unauthorized } from '@/lib/upstream.js';
import { clearedCookie } from '@/lib/session.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Settings > Account (DASHBOARD BRIEF #5): who is signed in, until when, and
// sign out on every device.

function expired() {
  const res = NextResponse.json({ status: 'error', detail: 'Session expired.' }, { status: 401 });
  res.cookies.set(clearedCookie());
  return res;
}

export async function GET() {
  let s;
  try { s = await withSession(); } catch { return expired(); }
  if (s.demo) return NextResponse.json({ status: 'ok', user: 'demo', expiresAt: null, demo: true });
  try {
    const out = await upstream('/admin/me', { token: s.token });
    return NextResponse.json(out.json, { status: out.status, headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    if (e instanceof Unauthorized) return expired();
    return NextResponse.json({ status: 'error', detail: 'Could not reach the API.' }, { status: 502 });
  }
}

// { action: 'logout-all' }. Ends every admin session upstream - this device's
// included - so the cookie is cleared here too.
export async function POST(req) {
  let s;
  try { s = await withSession(); } catch { return expired(); }
  let body = {};
  try { body = await req.json(); } catch { /* checked below */ }
  if (body.action !== 'logout-all') {
    return NextResponse.json({ status: 'error', detail: 'Unknown action.' }, { status: 400 });
  }
  let out = { status: 200, json: { status: 'ok', ended: 1 } };
  if (!s.demo) {
    try { out = await upstream('/admin/logout-all', { method: 'POST', token: s.token }); }
    catch (e) {
      if (e instanceof Unauthorized) return expired();
      return NextResponse.json({ status: 'error', detail: 'Could not reach the API.' }, { status: 502 });
    }
  }
  const res = NextResponse.json(out.json, { status: out.status });
  if (out.status === 200) res.cookies.set(clearedCookie());
  return res;
}
