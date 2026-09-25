import { NextResponse } from 'next/server';
import { upstream, Unauthorized } from '@/lib/upstream.js';
import { readSession, cookieFor, clearedCookie, packLive, packDemo } from '@/lib/session.js';
import { demoEnabled, demoCredsMatch } from '@/lib/demo.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// A door of our own in front of cahyana-api's. Its limiter counts by IP, and
// every call from here arrives on the SAME IP (this server's), so without this
// one impatient visitor spends the shared allowance for everyone.
//
// In-memory, so it resets on redeploy and is per-instance. That is honest about
// what it is: a speed bump that stops a script, not a vault. The real defence
// is that the password is long and the upstream limiter exists.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_TRIES = 5;
const tries = new Map();

function clientIp(req) {
  const xff = req.headers.get('x-forwarded-for') || '';
  return xff.split(',')[0].trim() || 'unknown';
}

function tooMany(ip) {
  const now = Date.now();
  const hits = (tries.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  hits.push(now);
  tries.set(ip, hits);
  if (tries.size > 5000) tries.clear();   // no unbounded growth
  return hits.length > MAX_TRIES;
}

export async function POST(req) {
  let body = {};
  try { body = await req.json(); } catch { /* empty body is just a bad login */ }
  const user = String(body.user || '');
  const pass = String(body.pass || '');

  if (tooMany(clientIp(req))) {
    return NextResponse.json(
      { status: 'error', detail: 'Too many attempts. Try again in 15 minutes.' },
      { status: 429 },
    );
  }

  // The demo account is answered HERE and never forwarded. Its password is
  // printed in the README - letting it reach cahyana-api would mean a public
  // password knocking on the real door, and filling the real limiter.
  if (demoEnabled() && demoCredsMatch(user, pass)) {
    const res = NextResponse.json({ status: 'ok', demo: true });
    res.cookies.set(cookieFor(packDemo()));
    return res;
  }

  let out;
  try {
    out = await upstream('/admin/login', { method: 'POST', body: { user, pass } });
  } catch (e) {
    // A refused password and an API that is down are DIFFERENT answers. Saying
    // "wrong password" when the API is unreachable sends the owner looking for
    // a typo in a password that was right.
    if (e instanceof Unauthorized) {
      return NextResponse.json(
        { status: 'error', detail: 'Wrong username or password.' },
        { status: 401 },
      );
    }
    return NextResponse.json(
      { status: 'error', detail: 'Could not reach the API. Try again in a moment.' },
      { status: 502 },
    );
  }

  const token = out.json && out.json.token;
  if (out.status !== 200 || !token) {
    return NextResponse.json(
      { status: 'error', detail: (out.json && out.json.detail) || 'Could not sign in.' },
      { status: out.status === 503 ? 503 : 401 },
    );
  }

  const res = NextResponse.json({ status: 'ok', demo: false });
  res.cookies.set(cookieFor(packLive(token)));
  return res;
}

// Signing out revokes the row upstream, not just the cookie here. A token that
// is only forgotten on the device is a token that still opens the data if it
// was ever copied.
export async function DELETE() {
  const s = await readSession();
  if (s && !s.demo) {
    try { await upstream('/admin/logout', { method: 'POST', token: s.token }); }
    catch { /* the cookie goes either way */ }
  }
  const res = NextResponse.json({ status: 'ok' });
  res.cookies.set(clearedCookie());
  return res;
}
