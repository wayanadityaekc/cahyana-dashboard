import { NextResponse } from 'next/server';
import { owner, readBody } from '@/lib/passthrough.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bad = () => NextResponse.json({ status: 'error', detail: 'Not found.' }, { status: 404 });

export async function GET(req, { params }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) return bad();
  const after = new URL(req.url).searchParams.get('after');
  return owner(`/admin/driver-chats/${id}${/^\d+$/.test(after || '') ? `?after=${after}` : ''}`, { demoEmpty: { messages: [] } });
}

export async function POST(req, { params }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) return bad();
  const b = await readBody(req);
  return owner(`/admin/driver-chats/${id}/reply`, { method: 'POST', body: { body: b.body } });
}
