import { NextResponse } from 'next/server';
import { upstream, withSession, Unauthorized } from '@/lib/upstream.js';
import { clearedCookie } from '@/lib/session.js';
import { demoBookings } from '@/lib/demoData.js';

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

export async function GET() {
  let s;
  try { s = await withSession(); } catch { return expired(); }

  if (s.demo) return NextResponse.json(demoBookings());

  try {
    const out = await upstream('/admin/bookings', { token: s.token });
    return NextResponse.json(out.json, { status: out.status });
  } catch (e) {
    if (e instanceof Unauthorized) return expired();
    return NextResponse.json({ status: 'error', detail: 'Could not reach the API.' }, { status: 502 });
  }
}
