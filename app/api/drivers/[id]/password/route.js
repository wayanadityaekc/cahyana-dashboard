import { NextResponse } from 'next/server';
import { owner, readBody } from '@/lib/passthrough.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// New password for one driver (typed by the owner). Signs the
// driver out on every device.
export async function POST(req, { params }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ status: 'error', detail: 'Not found.' }, { status: 404 });
  return owner(`/admin/drivers/${id}/password`, { method: 'POST', body: await readBody(req) });
}
