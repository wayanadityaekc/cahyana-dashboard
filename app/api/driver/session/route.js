import { NextResponse } from 'next/server';
import { upstream, Unauthorized } from '@/lib/upstream.js';
import { readDriverToken, driverCookie, clearedDriverCookie } from '@/lib/driverSession.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The driver sign-in. Same shape as the owner's /api/session: a door of our own
// in front of cahyana-api's, because every call from here reaches the API from
// ONE IP (this server's). The API limits per username; this limits per visitor.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_TRIES = 10;
const tries = new Map();

function tooMany(req) {
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
  const now = Date.now();
  const hits = (tries.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  hits.push(now);
  tries.set(ip, hits);
  if (tries.size > 5000) tries.clear();
  return hits.length > MAX_TRIES;
}

export async function POST(req) {
  let body = {};
  try { body = await req.json(); } catch { /* an empty body is a bad sign-in */ }
  if (tooMany(req)) {
    return NextResponse.json({ status: 'error', detail: 'Too many attempts. Try again in 15 minutes.' }, { status: 429 });
  }
  let out;
  try {
    out = await upstream('/driver/login', { method: 'POST', body: { username: String(body.username || ''), password: String(body.password || '') } });
  } catch (e) {
    // upstream() throws Unauthorized on 401: that IS the wrong-password answer.
    if (e instanceof Unauthorized) {
      return NextResponse.json({ status: 'error', detail: 'Wrong username or password.' }, { status: 401 });
    }
    return NextResponse.json({ status: 'error', detail: 'Could not reach the server. Try again in a moment.' }, { status: 502 });
  }
  const token = out.json && out.json.token;
  if (out.status !== 200 || !token) {
    return NextResponse.json({ status: 'error', detail: (out.json && out.json.detail) || 'Could not sign in.' }, { status: out.status === 429 ? 429 : 401 });
  }
  const res = NextResponse.json({ status: 'ok' });
  res.cookies.set(driverCookie(token));
  return res;
}

// Signing out revokes the row upstream too, not just the cookie here.
export async function DELETE() {
  const t = await readDriverToken();
  if (t) {
    try { await upstream('/driver/logout', { method: 'POST', token: t }); } catch { /* the cookie goes either way */ }
  }
  const res = NextResponse.json({ status: 'ok' });
  res.cookies.set(clearedDriverCookie());
  return res;
}
