import { redirect } from 'next/navigation';
import { readDriverToken } from '@/lib/driverSession.js';
import { RAIL_PAGE } from '@/components/ui/railClasses';
import DriverLoginForm from '@/components/driver/DriverLoginForm';

export const dynamic = 'force-dynamic';

// Before sign-in a driver gets this and nothing else (brief #7): the sign-in
// form and how to put the app on the Home Screen. No data, no other page.
export default async function DriverLoginPage() {
  if (await readDriverToken()) redirect('/driver');
  return (
    <div className={`${RAIL_PAGE} pt-[var(--space-6)]`}>
      <DriverLoginForm />
    </div>
  );
}
