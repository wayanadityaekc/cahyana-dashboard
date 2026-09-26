import { NextResponse } from 'next/server';
import { upstream, withSession, Unauthorized } from '@/lib/upstream.js';
import { clearedCookie } from '@/lib/session.js';
import { demoContent } from '@/lib/demoData.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function expired() {
  const res = NextResponse.json({ status: 'error', detail: 'Session expired.' }, { status: 401 });
  res.cookies.set(clearedCookie());
  return res;
}

const KINDS = ['legal', 'tours'];
const kindOf = (req) => {
  const k = new URL(req.url).searchParams.get('kind') || 'legal';
  return KINDS.includes(k) ? k : null;
};

export async function GET(req) {
  let s;
  try { s = await withSession(); } catch { return expired(); }
  const kind = kindOf(req);
  if (!kind) return NextResponse.json({ status: 'error', detail: 'Unknown content.' }, { status: 404 });

  // The demo shows the editor against a small fixture. It never reaches the API
  // and it cannot publish - see POST.
  if (s.demo) return NextResponse.json(demoContent(kind), { headers: { 'Cache-Control': 'no-store' } });

  try {
    const out = await upstream(`/admin/content/${kind}`, { token: s.token });
    return NextResponse.json(out.json, { status: out.status, headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    if (e instanceof Unauthorized) return expired();
    return NextResponse.json({ status: 'error', detail: 'Could not reach the API.' }, { status: 502 });
  }
}

export async function POST(req) {
  let s;
  try { s = await withSession(); } catch { return expired(); }
  const kind = kindOf(req);
  if (!kind) return NextResponse.json({ status: 'error', detail: 'Unknown content.' }, { status: 404 });

  let body = {};
  try { body = await req.json(); } catch { /* validated below either way */ }
  const action = ['draft', 'publish', 'discard'].includes(body.action) ? body.action : null;
  if (!action) return NextResponse.json({ status: 'error', detail: 'Unknown action.' }, { status: 400 });

  if (s.demo) {
    // Editing is worth showing; publishing is not something a demo may do. Said
    // plainly rather than pretending to succeed - a demo that lies about what it
    // did is worse than one that does nothing.
    if (action === 'publish') {
      // 400, NOT 403. In this app 401 and 403 mean ONE thing - the session is
      // gone - and lib/api.js turns either into Unauthorized, which sends the
      // visitor to /login. Answering 403 here logged the demo out mid-edit and
      // the panel vanished instead of explaining itself. Measured, not guessed.
      return NextResponse.json({ status: 'error', detail: 'The demo cannot publish to the live site.' }, { status: 400 });
    }
    return NextResponse.json({ status: 'ok', demo: true, changed: [] });
  }

  const path = action === 'draft'
    ? `/admin/content/${kind}/draft`
    : `/admin/content/${kind}/${action}`;

  try {
    const out = await upstream(path, { method: 'POST', token: s.token, body: action === 'draft' ? { json: body.json } : {} });
    return NextResponse.json(out.json, { status: out.status });
  } catch (e) {
    if (e instanceof Unauthorized) return expired();
    return NextResponse.json({ status: 'error', detail: 'Could not reach the API.' }, { status: 502 });
  }
}
