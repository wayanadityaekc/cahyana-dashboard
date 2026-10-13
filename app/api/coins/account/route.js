import { coinRoute, badRequest } from '@/lib/coinRoutes.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// One guest's balance, next expiry and history, by account email.
export async function GET(req) {
  const email = (new URL(req.url).searchParams.get('email') || '').trim();
  if (!email || email.length > 254 || !email.includes('@')) return badRequest('Type the guest\'s email address.');
  return coinRoute(`/admin/coins/account?email=${encodeURIComponent(email)}`, { demo: ['account', { email }] });
}
