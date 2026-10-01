'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Bell, CalendarCheck, CalendarDays, History, Percent, RefreshCw, Star, Tag } from 'lucide-react';
import RailLayout from '@/components/ui/RailLayout';
import AppBottomNav from '@/components/AppBottomNav';
import Navbar from '@/components/Navbar';
import { RAIL_PAGE_SCROLL } from '@/components/ui/railClasses';
import { FIELD_INPUT } from '@/components/ui/formClasses';
import BookingCard from '@/components/admin/BookingCard';
import PricesPanel from '@/components/admin/PricesPanel';
import SettingsPanel from '@/components/admin/SettingsPanel';
import VillaCalendarPanel from '@/components/admin/VillaCalendarPanel';
import ComingSoon from '@/components/admin/ComingSoon';
import { GHOST } from '@/components/ui/panelClasses';
import { getJson, logout, Unauthorized } from '@/lib/api';

// The Ubud Private Villas dashboard (DASHBOARD BRIEF #8). Same shell as the tours
// dashboard - navbar, drawer, rail, tab bar - with only villa things in it.
// Villa stays come from /api/bookings?scope=villa, villa prices from
// /api/prices?scope=villa; neither can carry a tour line.
//
// Discounts and Ratings exist as pages but are not wired (Wayan, #8 Q2: "build
// the pages/placeholders, I'll decide the rules later").

const SECTIONS = [
  { id: 'attention', label: 'Needs attention', Icon: AlertTriangle },
  { id: 'upcoming', label: 'Upcoming stays', Icon: CalendarDays },
  { id: 'past', label: 'Past stays', Icon: History },
  { id: 'calendar', label: 'Calendar', Icon: CalendarCheck, split: true },
  { id: 'prices', label: 'Prices', Icon: Tag },
  { id: 'discounts', label: 'Discounts', Icon: Percent },
  { id: 'ratings', label: 'Ratings', Icon: Star },
  { id: 'settings', label: 'Settings', Icon: Bell, split: true },
];
const SECTION_IDS = new Set(SECTIONS.map((s) => s.id));
const BOOKING_TABS = ['attention', 'upcoming', 'past'];
const CRUMB = [{ label: 'Villas' }];

const H1 = 'font-head font-medium tracking-[-0.01em] text-display text-green m-0 mb-[0.3rem]';
const SUB = 'font-body text-body text-muted m-0 mb-[var(--space-3)]';
const TOOLS = 'flex items-center gap-[var(--space-2)] mb-[var(--space-3)] flex-wrap';
const EMPTY = 'font-body text-body text-muted m-0 py-[var(--space-3)]';
const ERR = 'font-body text-body text-err m-0 py-[var(--space-3)]';
const COUNT = 'ml-auto font-body text-small text-muted tabular-nums';
const SUBS = {
  attention: 'Villa bookings with a payment that needs a look.',
  upcoming: 'Confirmed stays that have not finished yet.',
  past: 'Stays that are over.',
  calendar: 'Can the booking form read each villa\'s Airbnb calendar, and which nights are taken.',
  prices: 'Price per night. A stay is the nightly price times the nights.',
  discounts: 'Villa discounts.',
  ratings: 'Villa ratings.',
  settings: 'Your account, and which notifications reach this device.',
};

function matches(g, q) {
  if (!q) return true;
  const hay = [g.ref, g.name, g.phone, g.email, ...g.lines.map((l) => l.service)].filter(Boolean).join(' ').toLowerCase();
  return hay.includes(q);
}

export default function VillasDashboard({ demo = false }) {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState('upcoming');
  const [q, setQ] = useState('');

  const expired = useCallback(() => { router.replace('/login'); }, [router]);
  const signOut = useCallback(async () => { await logout(); router.replace('/login'); }, [router]);

  const load = useCallback(async () => {
    setBusy(true); setErr('');
    try { setData(await getJson('/api/bookings?scope=villa')); }
    catch (e) { if (e instanceof Unauthorized) expired(); else setErr(e.message || 'Could not load the stays.'); }
    setBusy(false);
  }, [expired]);

  useEffect(() => { load(); }, [load]);

  // /villas?tab=<section> from a link or notification, read after mount and dropped.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab');
    if (t && SECTION_IDS.has(t)) setTab(t);
    if (t) window.history.replaceState(null, '', window.location.pathname);
  }, []);

  const isBookings = BOOKING_TABS.includes(tab);
  const query = q.trim().toLowerCase();
  const rows = data && isBookings ? (data[tab] || []).filter((g) => matches(g, query)) : [];
  const countOf = (id) => (data && BOOKING_TABS.includes(id) ? (data[id] || []).length : null);
  const items = SECTIONS.map((s) => ({
    ...s,
    label: <>{s.label}{countOf(s.id) != null && <span className={COUNT}>{countOf(s.id)}</span>}</>,
  }));

  return (
    <>
      <Navbar
        sections={SECTIONS.map((s) => ({ ...s, count: countOf(s.id) }))}
        active={tab}
        onPick={setTab}
        onChat={() => {}}
        showChat={false}
        onSignOut={signOut}
        onSettings={() => setTab('settings')}
        demo={demo}
        dash="villas"
        label="Villa sections"
        account={{ subtitle: 'Ubud Private Villas' }}
      />
      <div className={RAIL_PAGE_SCROLL} data-villas-dashboard>
        <RailLayout
          label="Villas"
          items={items}
          active={tab}
          onSelect={setTab}
          reading
          phoneList={false}
          collapsible
          breadcrumb={CRUMB}
          scrollContent
        >
          <h1 className={H1}>Villas</h1>
          <p className={SUB}>{SUBS[tab]}</p>

          {isBookings && (
            <div className={TOOLS}>
              <input className={`${FIELD_INPUT} !w-auto flex-1 min-w-[180px]`} placeholder="Search ref, name, phone" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search stays" />
              <button type="button" className={GHOST} onClick={load} disabled={busy}>
                <RefreshCw strokeWidth={1.7} aria-hidden="true" />{busy ? 'Loading' : 'Refresh'}
              </button>
            </div>
          )}

          {tab === 'calendar' && <VillaCalendarPanel onExpired={expired} />}
          {tab === 'prices' && <PricesPanel onExpired={expired} scope="villa" />}
          {tab === 'discounts' && (
            <ComingSoon title="Villa discounts" Icon={Percent}>
              There is no villa discount yet. The tours Sale does not touch villas on purpose. When you decide the
              rule (how much, for which villa, until when), it will be set here.
            </ComingSoon>
          )}
          {tab === 'ratings' && (
            <ComingSoon title="Villa ratings" Icon={Star}>
              There is no villa review form yet, so there is nothing to rate or show. When you decide how guests
              review a stay, their ratings will appear here.
            </ComingSoon>
          )}
          {tab === 'settings' && <SettingsPanel onExpired={expired} onSignOut={signOut} />}

          {isBookings && err && <p className={ERR}>{err}</p>}
          {isBookings && !err && !data && <p className={EMPTY}>Loading stays...</p>}
          {isBookings && !err && data && rows.length === 0 && <p className={EMPTY}>{query ? 'Nothing matches that search.' : 'Nothing here.'}</p>}
          {isBookings && rows.map((g) => <BookingCard key={g.ref || g.id} g={g} side="villa" />)}
        </RailLayout>

        <AppBottomNav
          active={tab}
          onPick={setTab}
          items={[
            { id: 'attention', label: 'Attention', Icon: AlertTriangle },
            { id: 'upcoming', label: 'Upcoming', Icon: CalendarDays },
            { id: 'past', label: 'Past', Icon: History },
            { id: 'prices', label: 'Prices', Icon: Tag },
          ]}
          counts={{ attention: data ? (data.attention || []).length : 0, upcoming: data ? (data.upcoming || []).length : 0 }}
        />
      </div>
    </>
  );
}
