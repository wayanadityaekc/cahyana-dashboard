import { NextResponse } from 'next/server';
import { upstream, withSession, Unauthorized } from '@/lib/upstream.js';
import { clearedCookie } from '@/lib/session.js';
import { readChatPatch, chatPatchCookie, appendDemoReply } from '@/lib/demo.js';
import { demoThreadExists } from '@/lib/demoData.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function expired() {
  const res = NextResponse.json({ status: 'error', detail: 'Session expired.' }, { status: 401 });
  res.cookies.set(clearedCookie());
  return res;
}

export async function POST(req, { params }) {
  let s;
  try { s = await withSession(); } catch { return expired(); }
  const { id } = await params;

  let body = {};
  try { body = await req.json(); } catch { /* validated below */ }
  const text = typeof body.body === 'string' ? body.body.trim() : '';
  if (!text) return NextResponse.json({ status: 'error', detail: 'Nothing to send.' }, { status: 400 });

  // The demo replies for real - it just keeps the reply in the visitor's own
  // cookie. Same reason the demo price edits do: a reply box that does nothing
  // is a screenshot, not a demo.
  if (s.demo) {
    if (!demoThreadExists(id)) {
      return NextResponse.json({ status: 'error', detail: 'No such conversation.' }, { status: 404 });
    }
    const { patch, message } = appendDemoReply(await readChatPatch(), id, text);
    const out = NextResponse.json({ status: 'ok', message });
    out.cookies.set(chatPatchCookie(patch));
    return out;
  }

  try {
    const out = await upstream(`/admin/chats/${encodeURIComponent(id)}/reply`, {
      method: 'POST', token: s.token, body: { body: text },
    });
    return NextResponse.json(out.json, { status: out.status });
  } catch (e) {
    if (e instanceof Unauthorized) return expired();
    return NextResponse.json({ status: 'error', detail: 'Could not reach the API.' }, { status: 502 });
  }
}
