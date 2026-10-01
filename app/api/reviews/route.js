import { NextResponse } from 'next/server';
import { upstream, withSession, Unauthorized } from '@/lib/upstream.js';
import { clearedCookie } from '@/lib/session.js';
import { demoReviews } from '@/lib/demoData.js';
import { scopeOf } from '@/lib/scope.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function expired() {
  const res = NextResponse.json({ status: 'error', detail: 'Session expired.' }, { status: 401 });
  res.cookies.set(clearedCookie());
  return res;
}

const STATUSES = ['approved', 'hidden', 'pending'];

export async function GET(req) {
  let s;
  try { s = await withSession(); } catch { return expired(); }

  const want = new URL(req.url).searchParams.get('status') || '';
  // Checked against a list rather than forwarded: this value reaches a SQL
  // parameter upstream, and an allowlist costs nothing next to trusting it.
  const status = STATUSES.includes(want) ? want : '';

  if (s.demo) return NextResponse.json(demoReviews(status), { headers: { 'Cache-Control': 'no-store' } });

  try {
    const qs = [status && `status=${status}`, scopeOf(req) === 'cue' && 'scope=cue'].filter(Boolean).join('&');
    const out = await upstream(`/admin/reviews${qs ? `?${qs}` : ''}`, { token: s.token });
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
  const action = ['hide', 'unhide'].includes(body.action) ? body.action : null;
  const id = Number(body.id);
  if (!action) return NextResponse.json({ status: 'error', detail: 'Unknown action.' }, { status: 400 });
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ status: 'error', detail: 'Which review?' }, { status: 400 });
  }

  // The demo lets the flow be seen and changes nothing - the panel's banner says
  // so. 200 rather than a refusal: unlike publishing a commit, hiding a sample
  // review has nothing real behind it to protect.
  if (s.demo) return NextResponse.json({ status: 'ok', demo: true });

  try {
    const out = await upstream(`/reviews/${id}/${action}`, { method: 'POST', token: s.token, body: {} });
    return NextResponse.json(out.json, { status: out.status });
  } catch (e) {
    if (e instanceof Unauthorized) return expired();
    return NextResponse.json({ status: 'error', detail: 'Could not reach the API.' }, { status: 502 });
  }
}
