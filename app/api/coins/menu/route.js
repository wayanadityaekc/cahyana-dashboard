import { coinRoute, readBody } from '@/lib/coinRoutes.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Add or edit one villa perk. Switched off, never deleted (the API has no delete).
export async function POST(req) {
  const { id, property, label, coins, active, serviceId } = await readBody(req);
  const body = { id, property, label, coins, active, serviceId };
  return coinRoute('/admin/coins/menu', { method: 'POST', body, demo: ['saveMenu'] });
}
