'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BellOff, CalendarCheck, MessageCircle, UserRound, Wallet } from 'lucide-react';
import Navbar from '@/components/Navbar';
import AppBottomNav from '@/components/AppBottomNav';
import RailLayout from '@/components/ui/RailLayout';
import { RAIL_PAGE_SCROLL } from '@/components/ui/railClasses';
import SimpleThread from '@/components/chat/SimpleThread';
import { getJson, Unauthorized } from '@/lib/api';
import { readLocal, writeLocal } from '@/lib/storage';
import JobsTab from './JobsTab';
import EarningsTab from './EarningsTab';
import AccountTab from './AccountTab';
import PushGate from './PushGate';
import usePush from './usePush';

// The driver app (DASHBOARD BRIEF #7). The owner's dashboard shell, with the
// driver's four tabs: the same navbar + phone drawer, the same cream rail on a
// desktop, the same book-bar tab bar on a phone. Nothing here is a copy - the
// components are the owner's, given the driver's words.
//
// There is no token in this file: the driver session is an httpOnly cookie
// (lib/driverSession.js) that only this app's /api/driver/* routes can read.

const TABS = [
  { id: 'bookings', label: 'Bookings', Icon: CalendarCheck },
  { id: 'earnings', label: 'Earnings', Icon: Wallet },
  { id: 'chat', label: 'Chat', Icon: MessageCircle },
  { id: 'account', label: 'Account', Icon: UserRound },
];
const TAB_IDS = new Set(TABS.map((t) => t.id));
const SUBS = {
  bookings: 'Jobs Cahyana has given you. Accept them, or decline so they can go to someone else.',
  earnings: 'What your jobs are worth, month by month.',
  chat: 'Messages with Cahyana. Only Cahyana reads this.',
  account: 'Your login and job alerts on this phone.',
};
const H1 = 'font-head font-medium tracking-[-0.01em] text-display text-green m-0 mb-[0.3rem]';
const SUB = 'font-body text-body text-muted m-0 mb-[var(--space-3)]';
const COUNT = 'ml-auto font-body text-small text-muted tabular-nums';
const WARN =
  'flex items-start gap-[0.5rem] w-full text-left p-[0.7rem_0.9rem] mb-[var(--space-3)] rounded-[var(--r-md)] cursor-pointer ' +
  'bg-cream [border:1px_solid_var(--color-err)] font-body text-small text-err ' +
  '[&>svg]:w-[var(--icon-sm)] [&>svg]:h-[var(--icon-sm)] [&>svg]:shrink-0 [&>svg]:mt-[0.15rem]';
const SEEN_KEY = 'cahyana_driver_chat_seen';
const LATER_KEY = 'cahyana_driver_push_later';

export default function DriverApp() {
  const router = useRouter();
  const [tab, setTab] = useState('bookings');
  const [me, setMe] = useState(null);
  const [waiting, setWaiting] = useState(0);
  const [unread, setUnread] = useState(0);
  const [later, setLater] = useState(true); // true until read from the session, so the first paint has no gate

  const expired = useCallback(() => { router.replace('/driver/login'); }, [router]);
  const signOut = useCallback(async () => {
    try { await fetch('/api/driver/session', { method: 'DELETE', credentials: 'same-origin' }); } catch { /* goes either way */ }
    router.replace('/driver/login');
  }, [router]);
  const push = usePush(expired);

  // A push opens /driver?tab=<tab> (public/sw.js); read after mount, then dropped.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab');
    if (t && TAB_IDS.has(t)) setTab(t);
    if (t) window.history.replaceState(null, '', window.location.pathname);
    try { setLater(window.sessionStorage.getItem(LATER_KEY) === '1'); } catch { setLater(false); }
  }, []);

  useEffect(() => {
    (async () => {
      try { setMe(await getJson('/api/driver/me')); }
      catch (e) { if (e instanceof Unauthorized) expired(); }
    })();
  }, [expired]);

  // Unread messages from the owner, for the badge. "Seen" is the last message
  // id this phone showed on the Chat tab.
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const msgs = (await getJson('/api/driver/chat')).messages || [];
        const last = msgs.length ? msgs[msgs.length - 1].id : 0;
        if (tab === 'chat') { writeLocal(SEEN_KEY, String(last)); if (alive) setUnread(0); return; }
        const seen = Number(readLocal(SEEN_KEY) || 0);
        if (alive) setUnread(msgs.filter((m) => m.from === 'admin' && m.id > seen).length);
      } catch (e) { if (e instanceof Unauthorized) expired(); }
    };
    tick();
    const t = setInterval(tick, 30000);
    return () => { alive = false; clearInterval(t); };
  }, [tab, expired]);

  const showGate = !later && push.ready && push.configured && !push.subscribed && (push.env?.supported || push.env?.iosTab);
  const pushOff = push.ready && push.configured && !push.subscribed;
  const notLater = () => { try { window.sessionStorage.setItem(LATER_KEY, '1'); } catch { /* fine */ } setLater(true); };

  const countOf = (id) => (id === 'bookings' ? waiting || null : id === 'chat' ? unread || null : null);
  const items = TABS.map((t) => ({
    ...t,
    label: <>{t.label}{countOf(t.id) ? <span className={COUNT}>{countOf(t.id)}</span> : null}</>,
  }));

  return (
    <>
      <Navbar
        sections={TABS.filter((t) => t.id !== 'chat').map((t) => ({ ...t, count: countOf(t.id) }))}
        active={tab}
        onPick={setTab}
        unread={unread}
        onChat={() => setTab('chat')}
        onSignOut={signOut}
        onSettings={() => setTab('account')}
        home="/driver"
        siteLink={false}
        label="Driver sections"
        account={{
          who: me ? me.name : 'Driver',
          title: me ? me.name : 'Driver',
          subtitle: 'Cahyana driver',
          settingsLabel: 'Account',
          SettingsIcon: UserRound,
        }}
      />
      <div className={RAIL_PAGE_SCROLL} data-driver-app>
        <RailLayout
          label="Driver"
          items={items}
          active={tab}
          onSelect={setTab}
          reading
          phoneList={false}
          collapsible
          breadcrumb={[{ label: 'Driver' }]}
          scrollContent
        >
          <h1 className={H1}>{me ? `Hi ${me.name.split(' ')[0]}` : 'Driver'}</h1>
          <p className={SUB}>{SUBS[tab]}</p>

          {pushOff && tab !== 'account' && (
            <button type="button" className={WARN} onClick={() => setTab('account')} data-push-off>
              <BellOff strokeWidth={1.8} aria-hidden="true" />
              <span><strong>Job alerts are off on this phone.</strong> You will not hear about new jobs. Tap to turn them on.</span>
            </button>
          )}

          {tab === 'bookings' && <JobsTab onExpired={expired} onCount={setWaiting} />}
          {tab === 'earnings' && <EarningsTab onExpired={expired} />}
          {tab === 'chat' && (
            <SimpleThread
              url="/api/driver/chat"
              mine="driver"
              title="Cahyana"
              subtitle="Only the owner reads this"
              onExpired={expired}
              placeholder="Message Cahyana"
              heightClass="min-[769px]:h-[min(620px,calc(100dvh-260px))] max-[768px]:h-[calc(100dvh-300px)] max-[768px]:min-h-[360px]"
            />
          )}
          {tab === 'account' && <AccountTab me={me} push={push} onExpired={expired} onSignOut={signOut} />}
        </RailLayout>

        <AppBottomNav active={tab} onPick={setTab} items={TABS} counts={{ bookings: waiting, chat: unread }} />
      </div>
      {showGate && <PushGate push={push} onLater={notLater} />}
    </>
  );
}
