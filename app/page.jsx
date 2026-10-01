import { redirect } from 'next/navigation';
import { readSession } from '@/lib/session.js';
import Landing from '@/components/Landing';

export const dynamic = 'force-dynamic';

// Home = the two tiles (DASHBOARD BRIEF #8). The tours dashboard moved to /cue.
//
// OLD LINKS KEEP WORKING: a push notification or a bookmark that opened
// "/?tab=upcoming" is sent on to "/cue?tab=upcoming". Only a known section name is
// forwarded, built here - the query string is never echoed into the redirect.
const CUE_TABS = new Set([
  'attention', 'upcoming', 'past', 'undated', 'dispatch', 'drivers',
  'prices', 'promo', 'content', 'reviews', 'chat', 'settings',
]);

export default async function Page({ searchParams }) {
  const s = await readSession();
  if (!s) redirect('/login');
  const tab = (await searchParams).tab;
  if (typeof tab === 'string' && CUE_TABS.has(tab)) redirect(`/cue?tab=${tab}`);
  return <Landing demo={s.demo} />;
}
