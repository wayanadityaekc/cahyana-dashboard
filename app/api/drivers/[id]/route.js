import { NextResponse } from 'next/server';
import { owner, readBody } from '@/lib/passthrough.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Rename, change phone, deactivate / reactivate one driver.
export async function POST(req, { params }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ status: 'error', detail: 'Not found.' }, { status: 404 });
  return owner(`/admin/drivers/${id}`, { method: 'POST', body: await readBody(req) });
}
