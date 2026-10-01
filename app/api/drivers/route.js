import { owner, readBody } from '@/lib/passthrough.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Owner > Drivers: list and create. The new password comes back ONCE in the
// create answer, to be handed to the driver in person.
export async function GET() { return owner('/admin/drivers', { demoEmpty: { drivers: [] } }); }
export async function POST(req) { return owner('/admin/drivers', { method: 'POST', body: await readBody(req) }); }
