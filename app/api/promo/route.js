import { NextResponse } from 'next/server';
import { upstream, withSession, Unauthorized } from '@/lib/upstream.js';
import { clearedCookie } from '@/lib/session.js';
import { readPromo, promoCookie, applyDemoPromo } from '@/lib/demo.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function expired() {
  const res = NextResponse.json({ status: 'error', detail: 'Session expired.' }, { status: 401 });
  res.cookies.set(clearedCookie());
  return res;
}

export async function GET() {
  let s;
  try { s = await withSession(); } catch { return expired(); }

  // The demo never reaches the real API - its sale lives in the visitor's own
  // cookie, the same way its price edits do.
  if (s.demo) return NextResponse.json(await readPromo(), { headers: { 'Cache-Control': 'no-store' } });

  try {
    const out = await upstream('/admin/promo', { token: s.token });
    return NextResponse.json(out.json, { status: out.status, headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    if (e instanceof Unauthorized) return expired();
    return NextResponse.json({ status: 'error', detail: 'Could not reach the API.' }, { status: 502 });
  }
}

export async function POST(req) {
  let s;
  try { s = await withSession(); } catch { return expired(); }

  let body = {};
  try { body = await req.json(); } catch { /* validated below either way */ }

  if (s.demo) {
    const { error, state } = applyDemoPromo(body);
    if (error) return NextResponse.json(error.body, { status: error.http });
    const res = NextResponse.json({ status: 'ok', ...state });
    res.cookies.set(promoCookie(state));
    return res;
  }

  try {
    const out = await upstream('/admin/promo', { method: 'POST', token: s.token, body });
    return NextResponse.json(out.json, { status: out.status });
  } catch (e) {
    if (e instanceof Unauthorized) return expired();
    return NextResponse.json({ status: 'error', detail: 'Could not reach the API.' }, { status: 502 });
  }
}
