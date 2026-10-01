import { NextResponse } from 'next/server';
import { driver, readBody } from '@/lib/passthrough.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The driver app's pass-through to cahyana-api's /driver/*. Only these names go
// through - the upstream path is never built from whatever the browser sends.
const GETS = new Set(['me', 'jobs', 'earnings', 'reviews', 'chat', 'push/config']);
const POSTS = new Set(['jobs/respond', 'chat', 'push/status', 'push/subscribe', 'push/unsubscribe', 'push/test']);

const notFound = () => NextResponse.json({ status: 'error', detail: 'Not found.' }, { status: 404 });

export async function GET(req, { params }) {
  const p = (await params).path.join('/');
  if (!GETS.has(p)) return notFound();
  const after = new URL(req.url).searchParams.get('after');
  const q = p === 'chat' && /^\d+$/.test(after || '') ? `?after=${after}` : '';
  return driver(`/driver/${p}${q}`);
}

export async function POST(req, { params }) {
  const p = (await params).path.join('/');
  if (!POSTS.has(p)) return notFound();
  return driver(`/driver/${p}`, { method: 'POST', body: await readBody(req) });
}
