import { owner } from '@/lib/passthrough.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Owner > Chat > Drivers: one private thread per driver.
export async function GET() { return owner('/admin/driver-chats', { demoEmpty: { threads: [] } }); }
