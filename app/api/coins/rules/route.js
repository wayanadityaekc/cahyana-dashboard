import { coinRoute, readBody } from '@/lib/coinRoutes.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Owner > Coins: earn and % rules plus the villa perk menu (GET), save the rules (POST).
export async function GET() { return coinRoute('/admin/coins/rules', { demo: ['rules'] }); }

export async function POST(req) {
  const { earn, pct } = await readBody(req);
  const body = { earn: earn || {}, pct: pct || {} };
  return coinRoute('/admin/coins/rules', { method: 'POST', body, demo: ['saveRules'] });
}
