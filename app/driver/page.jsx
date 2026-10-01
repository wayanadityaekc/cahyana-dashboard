import { redirect } from 'next/navigation';
import { readDriverToken } from '@/lib/driverSession.js';
import DriverApp from '@/components/driver/DriverApp';

export const dynamic = 'force-dynamic';

// The proxy already turns visitors without a driver cookie away; checked again
// here because a page that decides what to render from a cookie reads it itself.
// The real gate is cahyana-api: every figure comes from a /driver/* route that
// checks the token, its age and that the driver is still active.
export default async function DriverPage() {
  if (!(await readDriverToken())) redirect('/driver/login');
  return <DriverApp />;
}
