'use client';

import { useCallback, useEffect, useState } from 'react';
import { getJson, postJson, Unauthorized } from '@/lib/api';
import { pushEnv, urlB64ToUint8Array } from '@/lib/pushClient';

// Push for the driver app (DASHBOARD BRIEF #7 Q4: "close to mandatory"). One
// hook, used by the sign-in gate that asks firmly and by the Account tab, so
// both always agree on whether this phone gets job alerts.
//
// No per-event switches: a driver who misses "new job" misses a job. It is on
// or off for the device, nothing else.
export default function usePush(onExpired) {
  const [state, setState] = useState({ ready: false, configured: false, env: null, subscribed: false, endpoint: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const fail = useCallback((e, fallback) => {
    if (e instanceof Unauthorized) { onExpired(); return; }
    setErr((e && e.message) || fallback);
  }, [onExpired]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const env = pushEnv();
      let cfg = { configured: false, publicKey: '' };
      try { cfg = await getJson('/api/driver/push/config'); } catch (e) { fail(e, 'Could not load notification settings.'); }
      let subscribed = false, endpoint = '';
      if (env.supported && cfg.configured) {
        try {
          const reg = await navigator.serviceWorker.ready;
          const s = await reg.pushManager.getSubscription();
          if (s) {
            endpoint = s.endpoint;
            const { status, json } = await postJson('/api/driver/push/status', { endpoint });
            subscribed = status === 200 && !!json.subscribed;
          }
        } catch { /* no worker yet - the button still works */ }
      }
      if (alive) setState({ ready: true, configured: !!cfg.configured, publicKey: cfg.publicKey || '', env, subscribed, endpoint });
    })();
    return () => { alive = false; };
  }, [fail]);

  const enable = useCallback(async () => {
    setErr(''); setMsg('');
    if (!state.configured) { setErr('Notifications are not set up on the server yet. Tell Cahyana.'); return false; }
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setState((v) => ({ ...v, env: { ...v.env, permission: perm } }));
        setErr('Notifications are blocked. Allow them in your phone settings for this app.');
        return false;
      }
      const reg = await navigator.serviceWorker.ready;
      const s = (await reg.pushManager.getSubscription())
        || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(state.publicKey) });
      const { status, json } = await postJson('/api/driver/push/subscribe', { subscription: s.toJSON() });
      if (status !== 200) { setErr(json.detail || `Server answered ${status}.`); return false; }
      setState((v) => ({ ...v, subscribed: true, endpoint: s.endpoint, env: { ...v.env, permission: 'granted' } }));
      setMsg('Job alerts are on for this phone.');
      return true;
    } catch (e) { fail(e, 'Could not turn notifications on.'); return false; }
    finally { setBusy(false); }
  }, [state.configured, state.publicKey, fail]);

  const disable = useCallback(async () => {
    setErr(''); setMsg(''); setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const s = await reg.pushManager.getSubscription();
      if (s) {
        await postJson('/api/driver/push/unsubscribe', { endpoint: s.endpoint });
        await s.unsubscribe().catch(() => {});
      }
      setState((v) => ({ ...v, subscribed: false, endpoint: '' }));
      setMsg('Job alerts are off for this phone. You may miss new jobs.');
    } catch (e) { fail(e, 'Could not turn notifications off.'); }
    finally { setBusy(false); }
  }, [fail]);

  const test = useCallback(async () => {
    setErr(''); setMsg('');
    try {
      const { status, json } = await postJson('/api/driver/push/test', { endpoint: state.endpoint });
      if (status !== 200) setErr(json.detail || `Server answered ${status}.`);
      else setMsg(json.sent ? 'Test sent - it should arrive in a few seconds.' : 'The server could not reach this phone.');
    } catch (e) { fail(e, 'Could not send the test.'); }
  }, [state.endpoint, fail]);

  return { ...state, busy, err, msg, enable, disable, test };
}
