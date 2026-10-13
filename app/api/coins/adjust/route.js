import { coinRoute, readBody } from '@/lib/coinRoutes.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Manual correction on one guest. The API checks the range, the note and the balance.
export async function POST(req) {
  const { email, delta, note } = await readBody(req);
  return coinRoute('/admin/coins/adjust', { method: 'POST', body: { email, delta, note }, demo: ['adjust'] });
}
