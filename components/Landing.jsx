'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Compass, Home } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { RAIL_PAGE } from '@/components/ui/railClasses';
import { getJson, logout, Unauthorized } from '@/lib/api';

// The home page (DASHBOARD BRIEF #8): two tiles, two completely separate
// dashboards. One login opens both; each tile shows ONE live number so the page
// is useful before you click.
//
// This page loads the two scoped booking lists only to count them. It shows no
// booking, price or guest.

const H1 = 'font-head font-medium tracking-[-0.01em] text-display text-green m-0 mb-[0.3rem]';
const SUB = 'font-body text-body text-muted m-0 mb-[var(--space-4)]';
const GRID = 'grid gap-[var(--space-3)] min-[769px]:grid-cols-2 max-w-[860px]';
const TILE =
  'group flex flex-col gap-[var(--space-2)] p-[var(--space-3)] rounded-[var(--r-lg)] bg-white no-underline ' +
  '[border:1px_solid_var(--line)] min-h-[200px] ' +
  '[transition:background-color_var(--dur)_var(--ease),scale_var(--dur-fast)_var(--ease)] hover:bg-cream';
const ICON = 'w-12 h-12 rounded-[50%] grid place-items-center bg-cream text-gold [&>svg]:w-6 [&>svg]:h-6 group-hover:bg-white';
const NAME = 'font-head font-medium tracking-[-0.01em] text-h2 text-green m-0';
const FACT = 'font-body text-body text-muted m-0';
const GO = 'mt-auto inline-flex items-center gap-[0.4rem] font-body text-small font-semibold text-gold [&>svg]:w-[var(--icon-sm)] [&>svg]:h-[var(--icon-sm)]';
const BIG = 'font-body text-green font-semibold tabular-nums';

export default function Landing({ demo = false }) {
  const router = useRouter();
  const [cue, setCue] = useState(null);
  const [villa, setVilla] = useState(null);
  const expired = useCallback(() => { router.replace('/login'); }, [router]);
  const signOut = useCallback(async () => { await logout(); router.replace('/login'); }, [router]);

  useEffect(() => {
    (async () => {
      try {
        setCue(await getJson('/api/bookings?scope=cue'));
        setVilla(await getJson('/api/bookings?scope=villa'));
      } catch (e) { if (e instanceof Unauthorized) expired(); }
    })();
  }, [expired]);

  const n = (d, k) => (d ? (d[k] || []).length : null);

  return (
    <>
      <Navbar
        sections={[]}
        active=""
        onPick={() => {}}
        showChat={false}
        onChat={() => {}}
        onSignOut={signOut}
        onSettings={() => router.push('/cue?tab=settings')}
        demo={demo}
        label="Dashboards"
      />
      <div className={`${RAIL_PAGE} pt-[calc(var(--header-h,58px)+var(--space-4))]`} data-landing>
        <h1 className={H1}>Dashboards</h1>
        <p className={SUB}>Two businesses, kept apart. Pick the one you are working on.</p>
        <div className={GRID}>
          <a className={TILE} href="/cue" data-tile="cue">
            <span className={ICON}><Compass strokeWidth={1.6} aria-hidden="true" /></span>
            <h2 className={NAME}>Cahyana Ubud Experience</h2>
            <p className={FACT}>Tours, transfers and charters: bookings, prices, drivers, reviews and chat.</p>
            <p className={FACT} data-tile-fact>
              {cue ? <><span className={BIG}>{n(cue, 'attention')}</span> need attention, <span className={BIG}>{n(cue, 'upcoming')}</span> upcoming</> : 'Loading...'}
            </p>
            <span className={GO}>Open <ArrowRight strokeWidth={1.8} aria-hidden="true" /></span>
          </a>
          <a className={TILE} href="/villas" data-tile="villas">
            <span className={ICON}><Home strokeWidth={1.6} aria-hidden="true" /></span>
            <h2 className={NAME}>Ubud Private Villas</h2>
            <p className={FACT}>The two villas: stays, nightly prices and the Airbnb calendar.</p>
            <p className={FACT} data-tile-fact>
              {villa ? <><span className={BIG}>{n(villa, 'upcoming')}</span> upcoming stay{n(villa, 'upcoming') === 1 ? '' : 's'}</> : 'Loading...'}
            </p>
            <span className={GO}>Open <ArrowRight strokeWidth={1.8} aria-hidden="true" /></span>
          </a>
        </div>
      </div>
    </>
  );
}
