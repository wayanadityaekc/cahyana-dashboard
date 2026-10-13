import { coinRoute, readBody } from '@/lib/coinRoutes.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Spend a guest's coins on a villa perk for one stay. Writes the "Covered by coin" note.
export async function POST(req) {
  const { ref, itemId } = await readBody(req);
  return coinRoute('/admin/coins/redeem', { method: 'POST', body: { ref, itemId }, demo: ['redeem'] });
}
