'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Share, SquarePlus, X } from 'lucide-react';
import { FIELD_INPUT } from '@/components/ui/formClasses';
import { BTN_SM } from '@/components/ui/btnClasses';
import { pushEnv } from '@/lib/pushClient';
import useScrollLock from '@/lib/useScrollLock';

// The driver sign-in (DASHBOARD BRIEF #7, cut down in #12). Username, password,
// Sign in, Install - and nothing else: no title, no sentences, no field labels
// (the fields say what they are in their placeholder, and carry aria-labels for
// screen readers). Same card as the owner's sign-in.
//
// Signing in never depends on installing: the form works the same in a tab and
// in the installed app.
//
// Install is one button with two behaviours:
//   Android / desktop Chrome - the browser's own one-tap install prompt.
//   iPhone (no such prompt exists) - a popup with the manual steps.
// Where a browser offers neither (prompt already used, other browsers) the same
// popup shows the manual steps, so the button never does nothing.

const BOX =
  'max-w-[380px] mx-auto p-[1.6rem] rounded-[var(--r-lg)] bg-white ' +
  '[border:1px_solid_var(--line)] flex flex-col gap-[var(--space-2)]';
const ERR = 'font-body text-small text-err m-0';
const SUBMIT =
  `flex w-full ${BTN_SM} bg-cta text-white border-none cursor-pointer ` +
  'disabled:opacity-60 disabled:cursor-not-allowed ' +
  '[transition:background-color_var(--dur)_var(--ease),scale_var(--dur-fast)_var(--ease)] hover:bg-cta-d';
const INSTALL_BTN =
  `flex w-full gap-[0.4rem] ${BTN_SM} bg-white text-gold [border:1px_solid_var(--line)] cursor-pointer font-body ` +
  '[&>svg]:w-[var(--icon-sm)] [&>svg]:h-[var(--icon-sm)] ' +
  '[transition:background-color_var(--dur)_var(--ease),scale_var(--dur-fast)_var(--ease)] hover:bg-cream';
const SHELL = 'fixed inset-0 z-[200] grid place-items-center p-[var(--space-2)] bg-[rgba(26,26,26,0.55)]';
const SHEET =
  'relative w-full max-w-[380px] p-[1.6rem] rounded-[var(--r-xl)] bg-white [border:1px_solid_var(--line)] ' +
  'flex flex-col gap-[var(--space-2)] font-body text-body text-green';
const STEP = 'flex items-center gap-[0.7rem] m-0 [&>svg]:w-[var(--icon-md)] [&>svg]:h-[var(--icon-md)] [&>svg]:shrink-0 [&>svg]:text-gold';
const CLOSE =
  'absolute top-[0.7rem] right-[0.7rem] w-8 h-8 grid place-items-center rounded-[var(--r-md)] bg-transparent border-none ' +
  'cursor-pointer text-muted hover:bg-cream [&>svg]:w-[var(--icon-sm)] [&>svg]:h-[var(--icon-sm)]';

function InstallSteps({ ios, onClose }) {
  const box = useRef(null);
  useScrollLock(true);
  useEffect(() => {
    box.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className={SHELL} onClick={onClose} data-install-sheet>
      <div className={SHEET} ref={box} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Add to Home Screen" onClick={(e) => e.stopPropagation()}>
        <button type="button" className={CLOSE} onClick={onClose} aria-label="Close"><X strokeWidth={1.7} aria-hidden="true" /></button>
        {ios ? (
          <>
            <p className={STEP}><Share strokeWidth={1.7} aria-hidden="true" />Tap Share in Safari</p>
            <p className={STEP}><SquarePlus strokeWidth={1.7} aria-hidden="true" />Tap Add to Home Screen</p>
            <p className={STEP}><Download strokeWidth={1.7} aria-hidden="true" />Open Driver from your Home Screen</p>
          </>
        ) : (
          <>
            <p className={STEP}><Download strokeWidth={1.7} aria-hidden="true" />Open your browser menu</p>
            <p className={STEP}><SquarePlus strokeWidth={1.7} aria-hidden="true" />Tap Install app or Add to Home screen</p>
          </>
        )}
      </div>
    </div>
  );
}

export default function DriverLoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [env, setEnv] = useState(null);
  const [prompt, setPrompt] = useState(null);
  const [steps, setSteps] = useState(false);

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

  async function install() {
    // The browser's own prompt where there is one (Android, desktop Chrome)...
    if (prompt) {
      const p = prompt;
      setPrompt(null);                    // a prompt event can be used once
      p.prompt();
      await p.userChoice.catch(() => {});
      return;
    }
    // ...the manual steps everywhere else (iPhone has no one-tap install).
    setSteps(true);
  }

  return (
    <>
      <form className={BOX} onSubmit={submit} data-driver-login>
        <img src="/logo.webp" alt="The Cahyana Logo" width="1005" height="324" className="h-[34px] w-auto block self-start" />
        <input
          id="drv-user" className={FIELD_INPUT} value={username} onChange={(e) => setUsername(e.target.value)}
          placeholder="Username" aria-label="Username" autoComplete="username" autoCapitalize="none" required
        />
        <input
          id="drv-pass" type="password" className={FIELD_INPUT} value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder="Password" aria-label="Password" autoComplete="current-password" required
        />
        <button type="submit" className={SUBMIT} disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}</button>
        {err && <p className={ERR} role="alert">{err}</p>}
        {env && !env.installed && (
          <button type="button" className={INSTALL_BTN} onClick={install} data-install-btn>
            <Download strokeWidth={1.7} aria-hidden="true" />Install
          </button>
        )}
      </form>
      {steps && <InstallSteps ios={!!(env && env.ios)} onClose={() => setSteps(false)} />}
    </>
  );
}
