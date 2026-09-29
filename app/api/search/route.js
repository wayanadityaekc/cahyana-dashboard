import { NextResponse } from 'next/server';
import { upstream, withSession, Unauthorized } from '@/lib/upstream.js';
import { clearedCookie } from '@/lib/session.js';
import { demoSearch } from '@/lib/demoData.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function expired() {
  const res = NextResponse.json({ status: 'error', detail: 'Session expired.' }, { status: 401 });
  res.cookies.set(clearedCookie());
  return res;
}

// Search Console's own period choices. Checked here as well as upstream: a
// number from the query string is not forwarded as-is.
const PERIODS = [7, 28, 90];

export async function GET(req) {
  let s;
  try { s = await withSession(); } catch { return expired(); }

  const params = new URL(req.url).searchParams;
  const want = Number(params.get('days'));
  const days = PERIODS.includes(want) ? want : 28;
  const refresh = params.get('refresh') === '1';

  // The demo never reaches the API, and so never reaches Google.
  if (s.demo) return NextResponse.json(demoSearch(days), { headers: { 'Cache-Control': 'no-store' } });

  try {
    const out = await upstream(`/admin/gsc?days=${days}${refresh ? '&refresh=1' : ''}`, { token: s.token });
    // Passed through with its status: a 503 "not connected" and a 502 "Google
    // said no" both carry a hint the panel shows as the next step.
    return NextResponse.json(out.json, { status: out.status, headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    if (e instanceof Unauthorized) return expired();
    return NextResponse.json({ status: 'error', detail: 'Could not reach the API.' }, { status: 502 });
  }
}
