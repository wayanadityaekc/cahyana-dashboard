import { coinRoute, readBody } from '@/lib/coinRoutes.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// A booking was refunded by hand: earned coins removed, spent coins given back.
export async function POST(req) {
  const { ref, note } = await readBody(req);
  return coinRoute('/admin/coins/reverse', { method: 'POST', body: { ref, note }, demo: ['reverse'] });
}
