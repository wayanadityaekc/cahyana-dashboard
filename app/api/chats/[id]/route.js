import { NextResponse } from 'next/server';
import { upstream, withSession, Unauthorized } from '@/lib/upstream.js';
import { clearedCookie } from '@/lib/session.js';
import { demoThread } from '@/lib/demoData.js';
import { readChatPatch } from '@/lib/demo.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function expired() {
  const res = NextResponse.json({ status: 'error', detail: 'Session expired.' }, { status: 401 });
  res.cookies.set(clearedCookie());
  return res;
}

export async function GET(req, { params }) {
  let s;
  try { s = await withSession(); } catch { return expired(); }
  const { id } = await params;

  if (s.demo) {
    const t = demoThread(id, await readChatPatch());
    if (!t) return NextResponse.json({ status: 'error', detail: 'No such conversation.' }, { status: 404 });
    return NextResponse.json({ status: 'ok', thread: t }, { headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    const out = await upstream(`/admin/chats/${encodeURIComponent(id)}`, { token: s.token });
    return NextResponse.json(out.json, { status: out.status, headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    if (e instanceof Unauthorized) return expired();
    return NextResponse.json({ status: 'error', detail: 'Could not reach the API.' }, { status: 502 });
  }
}
