'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Percent, AlertTriangle, CalendarDays, History, HelpCircle, RefreshCw, LogOut, Tag, MessageCircle , Star } from 'lucide-react';
import RailLayout from '@/components/ui/RailLayout';
import AppBottomNav from '@/components/AppBottomNav';
import { RAIL_PAGE } from '@/components/ui/railClasses';
import { BTN_SM } from '@/components/ui/btnClasses';
import { FIELD_INPUT } from '@/components/ui/formClasses';
import BookingCard from '@/components/admin/BookingCard';
import PricesPanel from '@/components/admin/PricesPanel';
import PromoPanel from '@/components/admin/PromoPanel';
import ContentPanel from '@/components/admin/ContentPanel';
import ReviewsPanel from '@/components/admin/ReviewsPanel';
import ChatPanel from '@/components/admin/ChatPanel';
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
  // Next to Prices because it IS a price change - one percentage off every
  // program, with an end date. Not a payment option; see PromoPanel.
  { id: 'promo', label: 'Sale', Icon: Percent },
  // The site's own words. A change here is a commit and a rebuild, not a
  // setting - see ContentPanel.
  { id: 'content', label: 'Content', Icon: FileText },
  // What guests said in public. Read-and-take-down, not approve-before-it-shows:
  // reviews publish themselves once the booking gate has passed.
  { id: 'reviews', label: 'Reviews', Icon: Star },
  // Guests the site's support panel could not answer. Its own job, like prices -
  // not a fifth way of looking at the bookings.
  { id: 'chat', label: 'Chat', Icon: MessageCircle },
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
  // Guest messages nobody has answered yet, shown on the rail the same way the
  // booking buckets show their counts.
  const [unread, setUnread] = useState(null);

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
  const isChat = tab === 'chat';
  const isPromo = tab === 'promo';
  const isContent = tab === 'content';
  const isReviews = tab === 'reviews';
  const query = q.trim().toLowerCase();
  const rows = data && isBookings ? (data[tab] || []).filter((g) => matches(g, query)) : [];
  const items = SECTIONS.map((s) => ({
    ...s,
    label: (
      <>
        {s.label}
        {s.id === 'chat'
          ? unread > 0 && <span className={COUNT}>{unread}</span>
          : data && data[s.id] && <span className={COUNT}>{(data[s.id] || []).length}</span>}
      </>
    ),
  }));

  return (
    <div className={RAIL_PAGE}>
      <h1 className={H1}>Dashboard</h1>
      <p className={SUB}>
        {isBookings
          ? `Bookings as they stand${data?.today ? ` - today in Bali is ${data.today}` : ''}.`
          : isChat
            ? 'Guests the chat on the site could not answer by itself.'
            : isPromo
              ? 'One percentage off every program, with a last day. Programs only.'
              : isContent
                ? 'The words on the site. Publishing rebuilds it - about three minutes.'
                : isReviews
                  ? 'What guests wrote after their trip. You can take one down; nothing is deleted.'
                  : 'Change a price here and it applies straight away, no deploy.'}
      </p>

      {/* Said once, at the top, on every section: nobody should mistake a
          sample booking for a real guest, or a demo price edit for a live one. */}
      {demo && (
        <p className={BANNER}>
          <AlertTriangle strokeWidth={1.7} aria-hidden="true" />
          <span>
            <strong>Demo data.</strong> These bookings and chats are made up and
            nothing here reaches the live system. Price edits and chat replies are
            real edits held in your own browser session - refresh and they stay,
            sign out and they are gone.
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

        {isChat && <ChatPanel onExpired={expired} onUnread={setUnread} />}
        {isPromo && <PromoPanel onExpired={expired} />}
        {isContent && <ContentPanel onExpired={expired} />}
        {isReviews && <ReviewsPanel onExpired={expired} />}
        {/* The catch-all must exclude EVERY named section. Forget one and that
            tab silently renders the Prices panel instead - it happened when the
            Content section was added. */}
        {!isBookings && !isChat && !isPromo && !isContent && !isReviews && <PricesPanel onExpired={expired} />}

        {isBookings && err && <p className={ERR}>{err}</p>}
        {isBookings && !err && !data && <p className={EMPTY}>Loading bookings...</p>}
        {isBookings && !err && data && rows.length === 0 && (
          <p className={EMPTY}>{query ? 'Nothing matches that search.' : 'Nothing here.'}</p>
        )}
        {isBookings && rows.map((g) => <BookingCard key={g.ref || g.id} g={g} />)}
      </RailLayout>

      {/* Same two pieces of state the rail drives, so the bar and the rail can
          never disagree about which section is open. */}
      <AppBottomNav
        active={tab}
        onPick={(id) => { setTab(id); setReading(true); }}
        counts={{
          attention: data ? (data.attention || []).length : 0,
          upcoming: data ? (data.upcoming || []).length : 0,
          chat: unread || 0,
        }}
      />
    </div>
  );
}
