'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CalendarDays, History, HelpCircle, RefreshCw, LogOut, Tag } from 'lucide-react';
import RailLayout from '@/components/ui/RailLayout';
import { RAIL_PAGE } from '@/components/ui/railClasses';
import { BTN_SM } from '@/components/ui/btnClasses';
import { FIELD_INPUT } from '@/components/ui/formClasses';
import BookingCard from '@/components/admin/BookingCard';
import PricesPanel from '@/components/admin/PricesPanel';
import { getJson, logout, Unauthorized } from '@/lib/api';

// The owner's view of the bookings.
//
// RailLayout is the shell the public site uses for Our Company, My Trips and the
// guide articles, so this page inherits the sticky rail, the phone's two screens
// and the page gutter without a fourth copy of any of it. The sections are the
// four buckets the API splits bookings into, plus prices.
//
// There is no token in this file. The session is an httpOnly cookie this code
// cannot read; every fetch goes to this app's own /api routes, which carry it.

const SECTIONS = [
  { id: 'attention', label: 'Needs attention', Icon: AlertTriangle },
  { id: 'upcoming', label: 'Upcoming', Icon: CalendarDays },
  { id: 'past', label: 'Past', Icon: History },
  { id: 'undated', label: 'No date', Icon: HelpCircle, split: true },
  // Separated from the four booking buckets: those are one list seen four ways,
  // this is a different job. Same reason the site's rail splits About from Legal.
  { id: 'prices', label: 'Prices', Icon: Tag, split: true },
];
const BOOKING_TABS = ['attention', 'upcoming', 'past', 'undated'];

const H1 = 'font-head font-medium tracking-[-0.01em] text-display text-green m-0 mb-[0.3rem]';
const SUB = 'font-body text-body text-muted m-0 mb-[var(--space-3)]';
const TOOLS = 'flex items-center gap-[var(--space-2)] mb-[var(--space-3)] flex-wrap';
const GHOST =
  `inline-flex ${BTN_SM} gap-[0.4rem] bg-white text-gold [border:1px_solid_var(--line)] cursor-pointer ` +
  '[&>svg]:w-[var(--icon-sm)] [&>svg]:h-[var(--icon-sm)] [&>svg]:shrink-0 ' +
  '[transition:background-color_var(--dur)_var(--ease),scale_var(--dur-fast)_var(--ease)] hover:bg-cream';
const EMPTY = 'font-body text-body text-muted m-0 py-[var(--space-3)]';
const ERR = 'font-body text-body text-err m-0 py-[var(--space-3)]';
const COUNT = 'ml-auto font-body text-small text-muted tabular-nums';
const BANNER =
  'flex items-start gap-[0.5rem] p-[0.7rem_0.9rem] mb-[var(--space-3)] rounded-[var(--r-md)] ' +
  'bg-cream [border:1px_solid_var(--line)] font-body text-small text-green ' +
  '[&>svg]:w-[var(--icon-sm)] [&>svg]:h-[var(--icon-sm)] [&>svg]:shrink-0 [&>svg]:mt-[0.15rem]';

// A booking is searched by what the owner actually has in hand when they go
// looking: a ref from an email, a name, a phone number.
function matches(g, q) {
  if (!q) return true;
  const hay = [g.ref, g.name, g.phone, g.email, ...g.lines.map((l) => l.service)]
    .filter(Boolean).join(' ').toLowerCase();
  return hay.includes(q);
}

export default function Dashboard({ demo = false }) {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState('upcoming');
  // Phone: land straight on the bookings, not on the menu. This page HAS an
  // obvious default (Upcoming), and an owner opening it wants the bookings, not
  // a list of section names. Back still reaches the list from here.
  const [reading, setReading] = useState(true);
  const [q, setQ] = useState('');

  // An expired session is not an error to read: send them to the door.
  const expired = useCallback(() => { router.replace('/login'); }, [router]);

  const load = useCallback(async () => {
    setBusy(true);
    setErr('');
    try {
      setData(await getJson('/api/bookings'));
    } catch (e) {
      if (e instanceof Unauthorized) expired();
      else setErr(e.message || 'Could not load bookings.');
    }
    setBusy(false);
  }, [expired]);

  useEffect(() => { load(); }, [load]);

  const isBookings = BOOKING_TABS.includes(tab);
  const query = q.trim().toLowerCase();
  const rows = data && isBookings ? (data[tab] || []).filter((g) => matches(g, query)) : [];
  const items = SECTIONS.map((s) => ({
    ...s,
    label: (
      <>
        {s.label}
        {data && data[s.id] && <span className={COUNT}>{(data[s.id] || []).length}</span>}
      </>
    ),
  }));

  return (
    <div className={RAIL_PAGE}>
      <h1 className={H1}>Dashboard</h1>
      <p className={SUB}>
        {isBookings
          ? `Bookings as they stand${data?.today ? ` - today in Bali is ${data.today}` : ''}.`
          : 'Change a price here and it applies straight away, no deploy.'}
      </p>

      {/* Said once, at the top, on every section: nobody should mistake a
          sample booking for a real guest, or a demo price edit for a live one. */}
      {demo && (
        <p className={BANNER}>
          <AlertTriangle strokeWidth={1.7} aria-hidden="true" />
          <span>
            <strong>Demo data.</strong> These bookings are made up and nothing here
            reaches the live system. Price edits are real edits held in your own
            browser session - refresh and they stay, sign out and they are gone.
          </span>
        </p>
      )}

      <RailLayout
        label="Bookings"
        items={items}
        active={tab}
        onSelect={(id) => { setTab(id); setReading(true); }}
        reading={reading}
        onBack={() => setReading(false)}
      >
        <div className={TOOLS}>
          {isBookings && (
            <>
              <input
                className={`${FIELD_INPUT} !w-auto flex-1 min-w-[180px]`}
                placeholder="Search ref, name, phone"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label="Search bookings"
              />
              <button type="button" className={GHOST} onClick={load} disabled={busy}>
                <RefreshCw strokeWidth={1.7} aria-hidden="true" />
                {busy ? 'Loading' : 'Refresh'}
              </button>
            </>
          )}
          {/* Sign out lives HERE, not in the rail's help card, because on a phone
              that card sits on the section list - so it would be hidden behind a
              menu tap. Measured: unreachable at 390 and 768. Signing out of an
              admin view is not something to bury. */}
          <button
            type="button"
            className={GHOST}
            onClick={async () => { await logout(); router.replace('/login'); }}
          >
            <LogOut strokeWidth={1.7} aria-hidden="true" />
            Sign out
          </button>
        </div>

        {!isBookings && <PricesPanel onExpired={expired} />}

        {isBookings && err && <p className={ERR}>{err}</p>}
        {isBookings && !err && !data && <p className={EMPTY}>Loading bookings...</p>}
        {isBookings && !err && data && rows.length === 0 && (
          <p className={EMPTY}>{query ? 'Nothing matches that search.' : 'Nothing here.'}</p>
        )}
        {isBookings && rows.map((g) => <BookingCard key={g.ref || g.id} g={g} />)}
      </RailLayout>
    </div>
  );
}
