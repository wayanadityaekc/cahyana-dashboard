import { NextResponse } from 'next/server';
import { upstream, withSession, Unauthorized } from '@/lib/upstream.js';
import { clearedCookie } from '@/lib/session.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The browser's way onto the live chat socket.
//
// WHY A TICKET. A WebSocket cannot carry a header, and the admin token lives in
// an httpOnly cookie on THIS origin - the browser will not send it to the API,
// and this app's own JavaScript cannot read it either. So the exchange happens
// here, server-to-server: the token buys a ticket that is good once, for about
// thirty seconds.
//
// THE URL COMES FROM HERE TOO, not from the browser guessing. CAHYANA_API is a
// server-only variable and it is the single place that says which API this
// deployment talks to; a browser assembling its own socket address is how a
// staging page ends up live-connected to production.
function expired() {
  const res = NextResponse.json({ status: 'error', detail: 'Session expired.' }, { status: 401 });
  res.cookies.set(clearedCookie());
  return res;
}

function socketUrl(ticket) {
  const u = new URL(process.env.CAHYANA_API);
  u.protocol = u.protocol === 'http:' ? 'ws:' : 'wss:';
  u.pathname = '/ws/admin';
  u.search = `?ticket=${encodeURIComponent(ticket)}`;
  return u.toString();
}

export async function POST() {
  let s;
  try { s = await withSession(); } catch { return expired(); }

  // Demo has no API behind it, so there is nothing to be live with. Answered
  // here and never forwarded, the same rule every other route in this app
  // follows - the panel falls back to polling its demo fixtures.
  if (s.demo) {
    return NextResponse.json({ status: 'ok', demo: true }, { headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    const out = await upstream('/admin/ws-ticket', { method: 'POST', token: s.token, body: {} });
    if (out.status !== 200 || !out.json || !out.json.ticket) {
      return NextResponse.json({ status: 'error', detail: 'No ticket.' }, { status: 502 });
    }
    return NextResponse.json(
      { status: 'ok', url: socketUrl(out.json.ticket) },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    if (e instanceof Unauthorized) return expired();
    return NextResponse.json({ status: 'error', detail: 'Could not reach the API.' }, { status: 502 });
  }
}
