import { NextResponse } from 'next/server';
import { upstream, withSession, Unauthorized } from '@/lib/upstream.js';
import { clearedCookie } from '@/lib/session.js';
import { demoBookings } from '@/lib/demoData.js';
import { scopeOf, withScope } from '@/lib/scope.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// A session that the API no longer recognises is not an error to display - it
// is a sign-in that expired. Clear the cookie on the way out so the next page
// load lands on /login instead of an empty dashboard.
function expired() {
  const res = NextResponse.json({ status: 'error', detail: 'Session expired.' }, { status: 401 });
  res.cookies.set(clearedCookie());
  return res;
}

export async function GET(req) {
  const scope = scopeOf(req);
  let s;
  try { s = await withSession(); } catch { return expired(); }

  // The demo is all tours: the Villas side of it is simply empty.
  if (s.demo) {
    if (scope === 'villa') return NextResponse.json({ today: demoBookings().today, attention: [], upcoming: [], past: [], undated: [] });
    return NextResponse.json(demoBookings());
  }

  try {
    const out = await upstream(withScope('/admin/bookings', scope), { token: s.token });
    return NextResponse.json(out.json, { status: out.status });
  } catch (e) {
    if (e instanceof Unauthorized) return expired();
    return NextResponse.json({ status: 'error', detail: 'Could not reach the API.' }, { status: 502 });
  }
}
