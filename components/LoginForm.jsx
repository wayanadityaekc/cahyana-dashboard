'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FIELD_INPUT, FIELD_LABEL } from '@/components/ui/formClasses';
import { BTN_SM } from '@/components/ui/btnClasses';
import { login } from '@/lib/api';

const BOX =
  'max-w-[380px] mx-auto p-[1.6rem] rounded-[var(--r-lg)] bg-white ' +
  '[border:1px_solid_var(--line)] [box-shadow:var(--shadow-md)]';
const TITLE = 'font-head font-medium tracking-[-0.01em] text-h2 text-green m-0 mb-[0.3rem]';
const SUB = 'font-body text-body text-muted m-0 mb-[var(--space-3)]';
const ERR = 'font-body text-small text-err m-0 mt-[var(--space-2)]';
// Geometry from BTN_SM, colour and width here - the split every caller makes.
const SUBMIT =
  `flex w-full mt-[var(--space-3)] ${BTN_SM} bg-cta text-white border-none cursor-pointer ` +
  'disabled:opacity-60 disabled:cursor-not-allowed ' +
  '[transition:background-color_var(--dur)_var(--ease),scale_var(--dur-fast)_var(--ease)] hover:bg-cta-d';
const DEMO =
  'mt-[var(--space-3)] pt-[var(--space-2)] [border-top:1px_solid_var(--line)] ' +
  'font-body text-small text-muted m-0';
const LINKY = 'text-gold underline underline-offset-2 cursor-pointer bg-transparent border-none p-0 font-body text-small';

export default function LoginForm({ demo = null }) {
  const router = useRouter();
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function send(u, p) {
    if (busy) return;
    setBusy(true);
    setErr('');
    try {
      await login(u, p);
      // The cookie is set by the server; nothing to hand forward here.
      router.replace('/');
      router.refresh();
    } catch (e) {
      // Whatever the server said, verbatim: it deliberately answers the same way
      // for a wrong name and a wrong password, and guessing here would undo that.
      setErr(e.message || 'Could not sign in.');
      setBusy(false);
    }
  }

  return (
    <form className={BOX} onSubmit={(e) => { e.preventDefault(); send(user, pass); }}>
      <h1 className={TITLE}>Owner sign in</h1>
      <p className={SUB}>This page only shows data once you are signed in.</p>

      <label className={FIELD_LABEL} htmlFor="adm-user">Username</label>
      <input
        id="adm-user"
        className={FIELD_INPUT}
        value={user}
        onChange={(e) => setUser(e.target.value)}
        autoComplete="username"
        required
      />

      <div className="mt-[var(--space-2)]">
        <label className={FIELD_LABEL} htmlFor="adm-pass">Password</label>
        <input
          id="adm-pass"
          type="password"
          className={FIELD_INPUT}
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          autoComplete="current-password"
          required
        />
      </div>

      <button type="submit" className={SUBMIT} disabled={busy}>
        {busy ? 'Signing in...' : 'Sign in'}
      </button>

      {err && <p className={ERR}>{err}</p>}

      {/* Only rendered when the deployment actually has a demo account. The
          credentials are printed because they are meant to be public - the demo
          never touches the live API, and it is answered by this app, not by it. */}
      {demo && (
        <p className={DEMO}>
          Just looking? Sign in as <strong>{demo.user}</strong> / <strong>{demo.pass}</strong> to
          see the dashboard filled with sample data.{' '}
          <button type="button" className={LINKY} onClick={() => send(demo.user, demo.pass)}>
            Open the demo
          </button>
        </p>
      )}
    </form>
  );
}
