import { redirect } from 'next/navigation';
import { readSession } from '@/lib/session.js';
import Dashboard from '@/components/Dashboard';

export const dynamic = 'force-dynamic';

// The tours dashboard (DASHBOARD BRIEF #8: it used to live at "/").
export default async function CuePage() {
  const s = await readSession();
  if (!s) redirect('/login');
  return <Dashboard demo={s.demo} />;
}
