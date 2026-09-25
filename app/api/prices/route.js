import { NextResponse } from 'next/server';
import { upstream, withSession, Unauthorized } from '@/lib/upstream.js';
import { clearedCookie } from '@/lib/session.js';
import { demoPricesFor, readPatch, patchCookie, applyDemoEdit } from '@/lib/demo.js';
import { demoPrices } from '@/lib/demoData.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function expired() {
  const res = NextResponse.json({ status: 'error', detail: 'Session expired.' }, { status: 401 });
  res.cookies.set(clearedCookie());
  return res;
}

export async function GET() {
  let s;
  try { s = await withSession(); } catch { return expired(); }

  if (s.demo) return NextResponse.json(await demoPricesFor(), { headers: { 'Cache-Control': 'no-store' } });

  try {
    const out = await upstream('/admin/prices', { token: s.token });
    return NextResponse.json(out.json, { status: out.status, headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    if (e instanceof Unauthorized) return expired();
    return NextResponse.json({ status: 'error', detail: 'Could not reach the API.' }, { status: 502 });
  }
}

export async function POST(req) {
  let s;
  try { s = await withSession(); } catch { return expired(); }

  let body = {};
  try { body = await req.json(); } catch { /* validated below either way */ }

  if (s.demo) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const { error, patch } = applyDemoEdit(await readPatch(), {
      name,
      idr: Number(body.idr),
      clear: Boolean(body.clear),
      confirm: Boolean(body.confirm),
    });
    if (error) return NextResponse.json(error.body, { status: error.http });

    const next = demoPrices(patch);
    const res = NextResponse.json({
      status: 'ok',
      ...(body.clear ? { cleared: true } : {}),
      items: next.items,
      drift: next.drift,
    });
    res.cookies.set(patchCookie(patch));
    return res;
  }

  try {
    const out = await upstream('/admin/prices', { method: 'POST', token: s.token, body });
    return NextResponse.json(out.json, { status: out.status });
  } catch (e) {
    if (e instanceof Unauthorized) return expired();
    return NextResponse.json({ status: 'error', detail: 'Could not reach the API.' }, { status: 502 });
  }
}
