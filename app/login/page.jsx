import { redirect } from 'next/navigation';
import { readSession } from '@/lib/session.js';
import { RAIL_PAGE } from '@/components/ui/railClasses';
import LoginForm from '@/components/LoginForm';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  if (await readSession()) redirect('/');

  // The demo credentials are read on the SERVER and passed down. They are public
  // by design, but reading them in the browser would mean shipping env access to
  // the client for no reason.
  const demo =
    String(process.env.DEMO_ENABLED || '') === 'true' && process.env.DEMO_USER && process.env.DEMO_PASS
      ? { user: process.env.DEMO_USER, pass: process.env.DEMO_PASS }
      : null;

  return (
    <div className={`${RAIL_PAGE} pt-[var(--space-6)]`}>
      <LoginForm demo={demo} />
    </div>
  );
}
