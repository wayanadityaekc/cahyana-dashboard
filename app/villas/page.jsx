import { redirect } from 'next/navigation';
import { readSession } from '@/lib/session.js';
import VillasDashboard from '@/components/VillasDashboard';

export const dynamic = 'force-dynamic';

export default async function VillasPage() {
  const s = await readSession();
  if (!s) redirect('/login');
  return <VillasDashboard demo={s.demo} />;
}
