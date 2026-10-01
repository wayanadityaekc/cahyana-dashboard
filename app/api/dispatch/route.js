import { owner, readBody } from '@/lib/passthrough.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Owner > Dispatch: confirmed upcoming booking lines + who drives them.
export async function GET() { return owner('/admin/dispatch', { demoEmpty: { rows: [], drivers: [], today: '' } }); }
export async function POST(req) { return owner('/admin/dispatch', { method: 'POST', body: await readBody(req) }); }
