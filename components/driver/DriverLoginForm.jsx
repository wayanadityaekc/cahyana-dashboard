'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Share } from 'lucide-react';
import { FIELD_INPUT, FIELD_LABEL } from '@/components/ui/formClasses';
import { BTN_SM } from '@/components/ui/btnClasses';
import { pushEnv } from '@/lib/pushClient';

// The driver sign-in (DASHBOARD BRIEF #7). Same card as the owner's sign-in.
// No "create account" and no "forgot password": the owner made this login and
// is the one who resets it - said on the form so nobody hunts for a link.

const BOX =
  'max-w-[380px] mx-auto p-[1.6rem] rounded-[var(--r-lg)] bg-white ' +
  '[border:1px_solid_var(--line)]';
const TITLE = 'font-head font-medium tracking-[-0.01em] text-h2 text-green m-0 mb-[0.3rem]';
const SUB = 'font-body text-body text-muted m-0 mb-[var(--space-3)]';
const ERR = 'font-body text-small text-err m-0 mt-[var(--space-2)]';
const SUBMIT =
  `flex w-full mt-[var(--space-3)] ${BTN_SM} bg-cta text-white border-none cursor-pointer ` +
  'disabled:opacity-60 disabled:cursor-not-allowed ' +
  '[transition:background-color_var(--dur)_var(--ease),scale_var(--dur-fast)_var(--ease)] hover:bg-cta-d';
const INSTALL =
  'max-w-[380px] mx-auto mt-[var(--space-2)] p-[0.9rem_1rem] rounded-[var(--r-md)] bg-cream ' +
  '[border:1px_solid_var(--line)] font-body text-small text-green flex gap-[0.6rem] ' +
  '[&>svg]:w-[var(--icon-sm)] [&>svg]:h-[var(--icon-sm)] [&>svg]:shrink-0 [&>svg]:mt-[0.1rem]';
const INSTALL_BTN =
  `inline-flex ${BTN_SM} mt-[0.5rem] bg-white text-gold [border:1px_solid_var(--line)] cursor-pointer gap-[0.4rem] font-body ` +
  '[transition:background-color_var(--dur)_var(--ease),scale_var(--dur-fast)_var(--ease)] hover:bg-cream';

export default function DriverLoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [env, setEnv] = useState(null);
  const [prompt, setPrompt] = useState(null);

  // Browser-only facts, read after mount.
  useEffect(() => {
    setEnv(pushEnv());
    const onPrompt = (e) => { e.preventDefault(); setPrompt(e); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setErr('');
    try {
      // fetch, not postJson: postJson reads any 401 as "session expired", and on
      // THIS form a 401 is simply the wrong password.
      const res = await fetch('/api/driver/session', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status !== 200) throw new Error(json.detail || 'Could not sign in.');
      router.replace('/driver');
      router.refresh();
    } catch (x) {
      setErr(x.message || 'Could not sign in.');
      setBusy(false);
    }
  }

  return (
    <>
      <form className={BOX} onSubmit={submit} data-driver-login>
        <img src="/logo.webp" alt="The Cahyana Logo" width="1005" height="324" className="h-[34px] w-auto block mb-[var(--space-2)]" />
        <h1 className={TITLE}>Driver sign in</h1>
        <p className={SUB}>Use the username and password Cahyana gave you.</p>

        <label className={FIELD_LABEL} htmlFor="drv-user">Username</label>
        <input id="drv-user" className={FIELD_INPUT} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" required />

        <div className="mt-[var(--space-2)]">
          <label className={FIELD_LABEL} htmlFor="drv-pass">Password</label>
          <input id="drv-pass" type="password" className={FIELD_INPUT} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </div>

        <button type="submit" className={SUBMIT} disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}</button>
        {err && <p className={ERR} role="alert">{err}</p>}
        <p className="font-body text-small text-muted m-0 mt-[var(--space-2)]">Forgot your password? Ask Cahyana for a new one.</p>
      </form>

      {env && !env.installed && (
        <div className={INSTALL} data-install-hint>
          {env.ios ? <Share strokeWidth={1.7} aria-hidden="true" /> : <Download strokeWidth={1.7} aria-hidden="true" />}
          <div>
            <strong>Put this app on your Home Screen.</strong>{' '}
            {env.ios
              ? 'In Safari tap Share, then "Add to Home Screen", and open it from there. Job alerts only work that way on iPhone.'
              : 'It opens like an app and gets job alerts.'}
            {prompt && (
              <div>
                <button type="button" className={INSTALL_BTN} onClick={async () => { prompt.prompt(); await prompt.userChoice.catch(() => {}); setPrompt(null); }} data-install-btn>
                  <Download strokeWidth={1.7} aria-hidden="true" className="w-[var(--icon-sm)] h-[var(--icon-sm)]" />Install app
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
