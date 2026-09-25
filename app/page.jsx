import { redirect } from 'next/navigation';
import { readSession } from '@/lib/session.js';
import Dashboard from '@/components/Dashboard';

export const dynamic = 'force-dynamic';

// The middleware already turns visitors without a cookie away; this checks again
// on the server because a page that decides what to render from a cookie should
// read that cookie itself, not trust that something upstream did.
export default async function Page() {
  const s = await readSession();
  if (!s) redirect('/login');
  return <Dashboard demo={s.demo} />;
}
