'use client';

import { Bell, KeyRound, LogOut, UserRound } from 'lucide-react';
import Switch from '@/components/ui/Switch';
import { CARD, STACK, HEAD, NOTE, ERR, OKMSG, BTNS, GHOST } from '@/components/ui/panelClasses';

// Account (DASHBOARD BRIEF #7): who is signed in, job alerts on this phone,
// sign out. The owner made this login and sets its password; the driver never
// changes or resets it - a forgotten one is reset by the owner.

const ROW = 'flex items-center justify-between gap-[var(--space-2)] py-[0.6rem]';

export default function AccountTab({ me, push, onExpired, onSignOut }) {
  const env = push.env || {};
  let pushNote = '';
  if (!push.ready) pushNote = 'Checking...';
  else if (!env.supported && !env.iosTab) pushNote = 'This browser cannot show notifications. Use Chrome on Android, or Safari on iPhone from the Home Screen.';
  else if (env.iosTab) pushNote = 'On iPhone, add this app to your Home Screen first (Share > Add to Home Screen), then turn alerts on from there.';
  else if (!push.configured) pushNote = 'Notifications are not set up on the server yet. Tell Cahyana.';
  else if (env.permission === 'denied') pushNote = 'Notifications are blocked. Allow them in your phone settings for this app, then come back.';
  else if (push.subscribed) pushNote = 'On. You get an alert for every new job and every message from Cahyana.';
  else pushNote = 'Off. You will NOT know about new jobs until you open the app.';
  const canToggle = push.ready && env.supported && !env.iosTab && push.configured && env.permission !== 'denied' && !push.busy;

  return (
    <div className={`${STACK} max-w-[560px]`} data-account>
      <section className={CARD} aria-labelledby="acc-who">
        <h2 id="acc-who" className={HEAD}><UserRound strokeWidth={1.7} aria-hidden="true" />Account</h2>
        <p className={NOTE} data-acc-name>{me ? `Signed in as ${me.name} (${me.username}).` : 'Loading...'}</p>
        <div className={BTNS}>
          <button type="button" className={GHOST} onClick={onSignOut} data-acc-signout><LogOut strokeWidth={1.7} aria-hidden="true" />Sign out</button>
        </div>
      </section>

      <section className={CARD} aria-labelledby="acc-push">
        <h2 id="acc-push" className={HEAD}><Bell strokeWidth={1.7} aria-hidden="true" />Job alerts</h2>
        <div className={ROW}>
          <span className="font-body text-body text-green">Notifications on this phone</span>
          <Switch id="drv-push" label="Notifications on this phone" checked={!!push.subscribed} disabled={!canToggle} onChange={(on) => (on ? push.enable() : push.disable())} />
        </div>
        <p className={`${NOTE} ${push.ready && !push.subscribed ? '!text-err' : ''}`} data-push-note>{pushNote}</p>
        <div className={BTNS}>
          <button type="button" className={GHOST} onClick={push.test} disabled={!push.subscribed} data-push-test><Bell strokeWidth={1.7} aria-hidden="true" />Send test</button>
        </div>
        {push.err && <p className={ERR} role="alert">{push.err}</p>}
        {push.msg && <p className={OKMSG} role="status">{push.msg}</p>}
      </section>

      <section className={CARD} aria-labelledby="acc-pw">
        <h2 id="acc-pw" className={HEAD}><KeyRound strokeWidth={1.7} aria-hidden="true" />Password</h2>
        <p className={NOTE}>Cahyana sets your password. To change it or if you forgot it, ask Cahyana.</p>
      </section>
    </div>
  );
}
