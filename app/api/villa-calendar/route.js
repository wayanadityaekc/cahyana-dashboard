import { NextResponse } from 'next/server';
import { upstream, withSession, Unauthorized } from '@/lib/upstream.js';
import { clearedCookie } from '@/lib/session.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Villas > Calendar (DASHBOARD BRIEF #8). Two answers from cahyana-api, merged:
//  - /villas/ical-check (admin): is each villa's Airbnb link set, reachable and
//    shaped like Airbnb. The link itself never comes back - only its host.
//  - /villas/availability (public): the taken nights, so the owner can see what
//    the booking form is going to refuse.
// A calendar that is "unknown" must read as unknown here, never as empty: that is
// the failure mode that sells one night twice.
function expired() {
  const res = NextResponse.json({ status: 'error', detail: 'Session expired.' }, { status: 401 });
  res.cookies.set(clearedCookie());
  return res;
}

export async function GET() {
  let s;
  try { s = await withSession(); } catch { return expired(); }
  // Villas have no demo data, and the demo never reaches the API.
  if (s.demo) return NextResponse.json({ status: 'ok', demo: true, villas: {} }, { headers: { 'Cache-Control': 'no-store' } });
  try {
    const check = await upstream('/villas/ical-check', { token: s.token });
    const avail = await upstream('/villas/availability', {});
    const merged = {};
    const a = (avail.json && avail.json.villas) || {};
    for (const [slug, v] of Object.entries((check.json && check.json.villas) || {})) {
      const t = a[slug] || {};
      merged[slug] = { ...v, busy: t.busy || [], known: !!t.known, stale: !!t.stale, updated: t.updated || null };
    }
    return NextResponse.json({ status: 'ok', villas: merged }, { status: check.status, headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    if (e instanceof Unauthorized) return expired();
    return NextResponse.json({ status: 'error', detail: 'Could not reach the API.' }, { status: 502 });
  }
}
