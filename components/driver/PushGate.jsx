'use client';

import { useEffect, useRef } from 'react';
import { BellRing, Share } from 'lucide-react';
import { CTA } from '@/components/ui/panelClasses';
import useScrollLock from '@/lib/useScrollLock';

// The firm ask (DASHBOARD BRIEF #7 Q4: "push them firmly to turn notifications
// on, not just a quiet toggle buried in settings, since missing a push could
// mean missing a job assignment").
//
// A full-screen card over the app, every time the app opens, until this phone
// has alerts on. "Not now" exists because a browser only lets the permission
// prompt follow a tap - but it only lasts until the app is opened again, and
// the Bookings tab keeps a red reminder meanwhile.
//
// Never shown when the server has no push keys: asking a driver for something
// that cannot work would teach them to ignore the ask.

const SHELL = 'fixed inset-0 z-[200] grid place-items-center p-[var(--space-2)] bg-[rgba(26,26,26,0.55)]';
const BOX =
  'w-full max-w-[400px] p-[1.6rem] rounded-[var(--r-xl)] bg-white [border:1px_solid_var(--line)] ' +
  'flex flex-col gap-[var(--space-2)] text-left';
const ICON = 'w-12 h-12 rounded-[50%] grid place-items-center bg-cream text-cta [&>svg]:w-6 [&>svg]:h-6';
const TITLE = 'font-head font-medium tracking-[-0.01em] text-h2 text-green m-0';
const BODY = 'font-body text-body text-green m-0 leading-[var(--lh-body)]';
const LATER = 'self-center bg-transparent border-none p-0 cursor-pointer font-body text-small text-muted underline underline-offset-2';
const ERR = 'font-body text-small text-err m-0';

export default function PushGate({ push, onLater }) {
  const btn = useRef(null);
  useScrollLock(true);
  useEffect(() => { btn.current?.focus(); }, []);
  const env = push.env || {};
  const denied = env.permission === 'denied';

  return (
    <div className={SHELL} role="dialog" aria-modal="true" aria-labelledby="gate-title" data-push-gate>
      <div className={BOX}>
        <span className={ICON} aria-hidden="true">{env.iosTab ? <Share strokeWidth={1.8} /> : <BellRing strokeWidth={1.8} />}</span>
        <h2 id="gate-title" className={TITLE}>{env.iosTab ? 'Add the app to your Home Screen' : 'Turn on job alerts'}</h2>
        {env.iosTab ? (
          <p className={BODY}>
            New jobs arrive as notifications. On iPhone that only works from the Home Screen app:
            tap <strong>Share</strong> in Safari, then <strong>Add to Home Screen</strong>, open
            <strong> Driver</strong> from there and turn alerts on.
          </p>
        ) : denied ? (
          <p className={BODY}>
            Notifications are blocked for this app, so you will not hear about new jobs. Open your
            phone settings, allow notifications for this app or browser, then come back.
          </p>
        ) : (
          <p className={BODY}>
            Cahyana sends every new job and every message as a notification. Without it you only
            see a job when you happen to open the app - and it might go to another driver.
          </p>
        )}
        {push.err && <p className={ERR} role="alert">{push.err}</p>}
        {!env.iosTab && !denied && (
          <button type="button" ref={btn} className={`${CTA} w-full`} disabled={push.busy} onClick={push.enable} data-gate-enable>
            <BellRing strokeWidth={1.8} aria-hidden="true" />{push.busy ? 'Turning on...' : 'Turn on notifications'}
          </button>
        )}
        <button type="button" ref={env.iosTab || denied ? btn : undefined} className={LATER} onClick={onLater} data-gate-later>
          Not now - remind me next time
        </button>
      </div>
    </div>
  );
}
