import { coinRoute, notFound, REF_RE } from '@/lib/coinRoutes.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The coin rows of one booking, "Covered by coin" notes included.
export async function GET(req, { params }) {
  const { ref } = await params;
  if (!REF_RE.test(ref)) return notFound();
  return coinRoute(`/admin/coins/booking/${encodeURIComponent(ref)}`, { demo: ['booking', { ref }] });
}
