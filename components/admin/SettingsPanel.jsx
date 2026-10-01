'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bell, ExternalLink, LogOut, ShieldAlert, UserRound } from 'lucide-react';
import { BTN_SM } from '@/components/ui/btnClasses';
import { getJson, postJson, Unauthorized } from '@/lib/api';
import { SITE_URL } from '@/components/Navbar';
import Switch from '@/components/ui/Switch';
import CheckUpdate from '@/components/ui/CheckUpdate';
import { urlB64ToUint8Array, deviceLabel } from '@/lib/pushClient';

// Settings (DASHBOARD BRIEF #4/#5): account, push notifications, about.
//
// PUSH IS PER DEVICE. A subscription belongs to one browser on one device, so
// the toggles below are this device's, and the server keeps them next to that
// device's subscription (cahyana-api/push.js). A phone and a laptop can differ.
//
// The browser is asked for permission ONLY when the owner flips the switch -
// never on page load. A prompt nobody asked for is the one most people deny,
// and a denial cannot be undone from the page.
//
// iPhone: Safari only allows web push for an app added to the Home Screen
// (iOS 16.4+). In a Safari tab the switch is disabled and says so.

const WRAP = 'flex flex-col gap-[var(--space-3)] max-w-[560px]';
const CARD =
  'flex flex-col gap-[var(--space-2)] p-[var(--space-3)] rounded-[var(--r-md)] ' +
  'bg-white [border:1px_solid_var(--line)]';
const HEAD =
  'flex items-center gap-[0.5rem] m-0 font-body text-strong font-semibold text-gold ' +
  '[&>svg]:w-[var(--icon-sm)] [&>svg]:h-[var(--icon-sm)] [&>svg]:shrink-0';
const NOTE = 'font-body text-small text-muted m-0';
const ERR = 'font-body text-small text-err m-0';
const OKMSG = 'font-body text-small text-ok m-0';
const ROWS = 'flex flex-col';
const ROW = 'flex items-center justify-between gap-[var(--space-2)] py-[0.6rem] [&+&]:[border-top:1px_solid_var(--line)]';
const ROW_LABEL = 'font-body text-body text-green';
const BTNS = 'flex flex-wrap gap-[var(--space-1)]';
const GHOST =
  `inline-flex ${BTN_SM} gap-[0.4rem] font-body bg-white text-gold [border:1px_solid_var(--line)] cursor-pointer ` +
  '[&>svg]:w-[var(--icon-sm)] [&>svg]:h-[var(--icon-sm)] [&>svg]:shrink-0 ' +
  '[transition:background-color_var(--dur)_var(--ease),scale_var(--dur-fast)_var(--ease)] hover:bg-cream ' +
  'disabled:opacity-50 disabled:cursor-not-allowed';
const DANGER =
  `inline-flex ${BTN_SM} gap-[0.4rem] font-body bg-white text-err [border:1px_solid_var(--line)] cursor-pointer ` +
  '[&>svg]:w-[var(--icon-sm)] [&>svg]:h-[var(--icon-sm)] [&>svg]:shrink-0 hover:bg-cream';
const LINK = 'inline-flex items-center gap-[0.4rem] font-body text-body text-gold no-underline hover:underline [&>svg]:w-[var(--icon-sm)] [&>svg]:h-[var(--icon-sm)]';

const fmtDate = (iso) => {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return ''; }
};

export default function SettingsPanel({ onExpired, onSignOut }) {
  const [me, setMe] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [env, setEnv] = useState({ supported: true, permission: 'default', iosTab: false });
  const [sub, setSub] = useState(null); // PushSubscription on this device
  const [subscribed, setSubscribed] = useState(false);
  const [prefs, setPrefs] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const fail = useCallback((e, fallback) => {
    if (e instanceof Unauthorized) { onExpired(); return; }
    setErr((e && e.message) || fallback);
  }, [onExpired]);

  // Everything browser-only is read after mount - the first paint must match
  // what the server rendered.
  useEffect(() => {
    let alive = true;
    (async () => {
      try { const j = await getJson('/api/account'); if (alive) setMe(j); } catch (e) { fail(e, 'Could not load the account.'); }
      let c = null;
      try { c = await getJson('/api/push/config'); if (alive) setCfg(c); } catch (e) { fail(e, 'Could not load notification settings.'); }

      const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
      const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const installed = document.documentElement.dataset.standalone === '1' || navigator.standalone === true;
      if (alive) setEnv({ supported, permission: supported ? Notification.permission : 'unsupported', iosTab: ios && !installed });
      const defaults = Object.fromEntries(((c && c.events) || []).map((e) => [e.id, e.on]));
      if (alive) setPrefs(defaults);
      if (!supported || !c || c.demo) return;
      try {
        const reg = await navigator.serviceWorker.ready;
        const s = await reg.pushManager.getSubscription();
        if (!alive || !s) return;
        setSub(s);
        const { status, json } = await postJson('/api/push/status', { endpoint: s.endpoint });
        if (alive && status === 200) { setSubscribed(!!json.subscribed); if (json.prefs) setPrefs(json.prefs); }
      } catch { /* no worker yet - the switch still works */ }
    })();
    return () => { alive = false; };
  }, [fail]);

  const enable = async () => {
    setErr(''); setMsg('');
    if (!cfg || !cfg.configured) { setErr('Push is not set up on the server yet.'); return; }
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      setEnv((v) => ({ ...v, permission: perm }));
      if (perm !== 'granted') { setErr('Notifications are blocked for this site in your browser settings.'); return; }
      const reg = await navigator.serviceWorker.ready;
      const s = (await reg.pushManager.getSubscription())
        || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(cfg.publicKey) });
      const { status, json } = await postJson('/api/push/subscribe', { subscription: s.toJSON(), prefs, label: deviceLabel() });
      if (status !== 200) { setErr(json.detail || `Server answered ${status}.`); return; }
      setSub(s); setSubscribed(true); if (json.prefs) setPrefs(json.prefs);
      setMsg('Push is on for this device.');
    } catch (e) { fail(e, 'Could not turn push on.'); }
    finally { setBusy(false); }
  };

  const disable = async () => {
    setErr(''); setMsg(''); setBusy(true);
    try {
      if (sub) {
        await postJson('/api/push/unsubscribe', { endpoint: sub.endpoint });
        await sub.unsubscribe().catch(() => {});
      }
      setSub(null); setSubscribed(false);
      setMsg('Push is off for this device.');
    } catch (e) { fail(e, 'Could not turn push off.'); }
    finally { setBusy(false); }
  };

  const setEvent = async (id, on) => {
    const next = { ...prefs, [id]: on };
    setPrefs(next);
    if (!sub || !subscribed) return;
    setErr('');
    try {
      const { status, json } = await postJson('/api/push/prefs', { endpoint: sub.endpoint, prefs: next });
      if (status !== 200) { setErr(json.detail || `Server answered ${status}.`); setPrefs(prefs); }
    } catch (e) { fail(e, 'Could not save that.'); setPrefs(prefs); }
  };

  const test = async () => {
    setErr(''); setMsg('');
    try {
      const { status, json } = await postJson('/api/push/test', { endpoint: sub.endpoint });
      if (status !== 200) setErr(json.detail || `Server answered ${status}.`);
      else setMsg(json.sent ? 'Test sent - it should arrive in a few seconds.' : 'The server could not reach this device.');
    } catch (e) { fail(e, 'Could not send the test.'); }
  };

  const signOutAll = async () => {
    // eslint-disable-next-line no-alert
    if (!window.confirm('Sign out on every device, including this one?')) return;
    try {
      const { status, json } = await postJson('/api/account', { action: 'logout-all' });
      if (status !== 200) { setErr(json.detail || `Server answered ${status}.`); return; }
      onExpired();
    } catch (e) { fail(e, 'Could not sign out everywhere.'); }
  };

  const demo = !!(cfg && cfg.demo) || !!(me && me.demo);
  const blocked = env.permission === 'denied';
  const canToggle = !demo && env.supported && !env.iosTab && !blocked && cfg && cfg.configured && !busy;

  let pushNote = '';
  if (demo) pushNote = 'Push is off in the demo - the demo never talks to the live system.';
  else if (!env.supported) pushNote = 'This browser does not support push notifications.';
  else if (env.iosTab) pushNote = 'On iPhone, add the dashboard to your Home Screen first (Share > Add to Home Screen), then turn push on from there.';
  else if (cfg && !cfg.configured) pushNote = 'Push is not set up on the server yet.';
  else if (blocked) pushNote = 'Notifications are blocked for this site. Allow them in your browser settings, then come back here.';
  else if (subscribed) pushNote = 'Allowed on this device.';
  else pushNote = 'Your browser will ask for permission when you switch this on.';

  return (
    <div className={WRAP} data-settings>
      <section className={CARD} aria-labelledby="set-account">
        <h2 id="set-account" className={HEAD}><UserRound strokeWidth={1.7} aria-hidden="true" />Account</h2>
        <p className={NOTE} data-set-user>
          {me ? (me.demo ? 'Signed in to the demo account.' : `Signed in as ${me.user || 'the owner'}.`) : 'Loading...'}
          {me && me.expiresAt ? ` This session ends ${fmtDate(me.expiresAt)}.` : ''}
        </p>
        <p className={NOTE}>The password is kept in Railway (ADMIN_PASS), not here.</p>
        <div className={BTNS}>
          <button type="button" className={GHOST} onClick={onSignOut}><LogOut strokeWidth={1.7} aria-hidden="true" />Sign out</button>
          <button type="button" className={DANGER} onClick={signOutAll} aria-label="Sign out on all devices" data-set-logout-all><ShieldAlert strokeWidth={1.7} aria-hidden="true" />All devices</button>
        </div>
      </section>

      <section className={CARD} aria-labelledby="set-push">
        <h2 id="set-push" className={HEAD}><Bell strokeWidth={1.7} aria-hidden="true" />Notifications</h2>
        <div className={ROWS}>
          <div className={ROW}>
            <span className={ROW_LABEL}>Push on this device</span>
            <Switch
              id="push-master"
              label="Push on this device"
              checked={subscribed}
              disabled={!canToggle}
              onChange={(on) => (on ? enable() : disable())}
            />
          </div>
        </div>
        <p className={NOTE} data-push-note>{pushNote}</p>
        <div className={ROWS} data-push-events>
          {((cfg && cfg.events) || []).map((e) => (
            <div key={e.id} className={ROW}>
              <span className={ROW_LABEL}>{e.label}</span>
              <Switch
                id={`push-${e.id}`}
                label={e.label}
                checked={!!prefs[e.id]}
                disabled={!subscribed || busy}
                onChange={(on) => setEvent(e.id, on)}
              />
            </div>
          ))}
        </div>
        <div className={BTNS}>
          <button type="button" className={GHOST} onClick={test} disabled={!subscribed} data-push-test>
            <Bell strokeWidth={1.7} aria-hidden="true" />Send test
          </button>
        </div>
        {err && <p className={ERR} role="alert">{err}</p>}
        {msg && <p className={OKMSG} role="status">{msg}</p>}
      </section>

      <section className={CARD} aria-labelledby="set-about">
        <h2 id="set-about" className={HEAD}>About</h2>
        <a className={LINK} href={SITE_URL} target="_blank" rel="noopener"><ExternalLink strokeWidth={1.7} aria-hidden="true" />Live website</a>
        <CheckUpdate />
        <p className={NOTE}>
          Cahyana dashboard{process.env.NEXT_PUBLIC_BUILD_TIME ? ` - built ${fmtDate(process.env.NEXT_PUBLIC_BUILD_TIME)}` : ''}
          {process.env.NEXT_PUBLIC_BUILD_SHA ? ` (${process.env.NEXT_PUBLIC_BUILD_SHA.slice(0, 7)})` : ''}.
        </p>
      </section>
    </div>
  );
}
