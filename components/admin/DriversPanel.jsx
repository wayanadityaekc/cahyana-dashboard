'use client';

import { useCallback, useEffect, useState } from 'react';
import { Copy, KeyRound, Power, UserPlus, Pencil } from 'lucide-react';
import { FIELD_INPUT, FIELD_LABEL } from '@/components/ui/formClasses';
import {
  CARD, STACK, HEAD, H3, NOTE, ERR, EMPTY, BTNS, GHOST, CTA, DANGER,
  PILL, PILL_OK, PILL_BAD,
} from '@/components/ui/panelClasses';
import { getJson, postJson, Unauthorized } from '@/lib/api';

// Drivers (DASHBOARD BRIEF #7): the owner creates every driver login by hand.
// No self-signup, no env variables. The password is typed here or generated,
// and shown ONCE so it can be handed to the driver - the server keeps only a
// hash, so it can never be shown again (a reset makes a new one).

const GRID = 'grid gap-[var(--space-2)] min-[700px]:grid-cols-2';
const SECRET =
  'flex flex-wrap items-center gap-[var(--space-1)] p-[0.7rem_0.9rem] rounded-[var(--r-md)] bg-cream ' +
  '[border:1px_solid_var(--color-ok)]';
const CODE = 'font-mono text-[0.95rem] font-semibold text-green tracking-[0.04em] select-all';

function Secret({ who, username, password, onDone }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(`Username: ${username}\nPassword: ${password}`); setCopied(true); }
    catch { /* the text is selectable either way */ }
  };
  return (
    <div className={SECRET} role="status" data-new-password>
      <div className="flex-1 min-w-[200px]">
        <p className={NOTE}>Give this to {who} now. It will not be shown again.</p>
        <p className="font-body text-body text-green m-0 mt-[0.2rem]">
          Username <span className={CODE} data-secret-user>{username}</span>
          {'  '}Password <span className={CODE} data-secret-pass>{password}</span>
        </p>
      </div>
      <div className={BTNS}>
        <button type="button" className={GHOST} onClick={copy}><Copy strokeWidth={1.7} aria-hidden="true" />{copied ? 'Copied' : 'Copy'}</button>
        <button type="button" className={GHOST} onClick={onDone}>Done</button>
      </div>
    </div>
  );
}

function CreateForm({ onCreated, onExpired }) {
  const [f, setF] = useState({ name: '', phone: '', username: '', password: '' });
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((v) => ({ ...v, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const { status, json } = await postJson('/api/drivers', f);
      if (status !== 200) setErr({ field: json.field, text: json.detail || `Server answered ${status}.` });
      else { onCreated({ who: f.name, username: json.username, password: json.password }); setF({ name: '', phone: '', username: '', password: '' }); }
    } catch (x) { if (x instanceof Unauthorized) onExpired(); else setErr({ text: x.message }); }
    setBusy(false);
  };
  const inv = (k) => (err && err.field === k ? 'true' : undefined);

  return (
    <form className={CARD} onSubmit={submit} data-driver-create>
      <h2 className={HEAD}><UserPlus strokeWidth={1.7} aria-hidden="true" />Add a driver</h2>
      <div className={GRID}>
        <div>
          <label className={FIELD_LABEL} htmlFor="drv-name">Name</label>
          <input id="drv-name" className={FIELD_INPUT} value={f.name} onChange={set('name')} maxLength={80} required aria-invalid={inv('name')} />
        </div>
        <div>
          <label className={FIELD_LABEL} htmlFor="drv-phone">Phone (optional)</label>
          <input id="drv-phone" className={FIELD_INPUT} value={f.phone} onChange={set('phone')} maxLength={40} inputMode="tel" />
        </div>
        <div>
          <label className={FIELD_LABEL} htmlFor="drv-user">Username</label>
          <input id="drv-user" className={FIELD_INPUT} value={f.username} onChange={set('username')} maxLength={32} autoCapitalize="none" autoComplete="off" required aria-invalid={inv('username')} />
        </div>
        <div>
          <label className={FIELD_LABEL} htmlFor="drv-pass">Password</label>
          <input id="drv-pass" className={FIELD_INPUT} value={f.password} onChange={set('password')} maxLength={128} autoComplete="new-password" placeholder="Leave empty to generate one" aria-invalid={inv('password')} />
        </div>
      </div>
      <p className={NOTE}>Username: 3-32 letters, numbers, dot, dash or underscore. Password: at least 8 characters.</p>
      {err && <p className={ERR} role="alert">{err.text}</p>}
      <div className={BTNS}>
        <button type="submit" className={CTA} disabled={busy}><UserPlus strokeWidth={1.7} aria-hidden="true" />{busy ? 'Adding' : 'Add driver'}</button>
      </div>
    </form>
  );
}

function DriverCard({ d, onChanged, onSecret, onExpired }) {
  const [mode, setMode] = useState(null); // null | 'edit' | 'password'
  const [name, setName] = useState(d.name);
  const [phone, setPhone] = useState(d.phone || '');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const call = async (path, body, after) => {
    setBusy(true); setErr('');
    try {
      const { status, json } = await postJson(path, body);
      if (status !== 200) setErr(json.detail || `Server answered ${status}.`);
      else { setMode(null); await after(json); }
    } catch (x) { if (x instanceof Unauthorized) onExpired(); else setErr(x.message); }
    setBusy(false);
  };

  const toggle = () => {
    const msg = d.active
      ? `Deactivate ${d.name}? They are signed out at once and can no longer sign in. Their jobs stay assigned - move them in Dispatch.`
      : `Reactivate ${d.name}? They can sign in again with their current password.`;
    // eslint-disable-next-line no-alert
    if (!window.confirm(msg)) return;
    call(`/api/drivers/${d.id}`, { active: !d.active }, onChanged);
  };

  return (
    <article className={CARD} data-driver={d.username}>
      <div className="flex flex-wrap items-baseline gap-x-[0.6rem] gap-y-[0.2rem]">
        <h3 className={H3}>{d.name}</h3>
        <span className={`${PILL} ${d.active ? PILL_OK : PILL_BAD}`}>{d.active ? 'Active' : 'Deactivated'}</span>
      </div>
      <p className={NOTE}>
        Username <strong className="text-green">{d.username}</strong>
        {d.phone ? `  |  ${d.phone}` : ''}
        {`  |  ${d.upcoming} upcoming job${d.upcoming === 1 ? '' : 's'}`}
      </p>

      {mode === 'edit' && (
        <form className={GRID} onSubmit={(e) => { e.preventDefault(); call(`/api/drivers/${d.id}`, { name, phone }, onChanged); }}>
          <div>
            <label className={FIELD_LABEL} htmlFor={`en-${d.id}`}>Name</label>
            <input id={`en-${d.id}`} className={FIELD_INPUT} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
          </div>
          <div>
            <label className={FIELD_LABEL} htmlFor={`ep-${d.id}`}>Phone</label>
            <input id={`ep-${d.id}`} className={FIELD_INPUT} value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} />
          </div>
          <div className={BTNS}>
            <button type="submit" className={CTA} disabled={busy}>Save</button>
            <button type="button" className={GHOST} onClick={() => setMode(null)}>Cancel</button>
          </div>
        </form>
      )}

      {mode === 'password' && (
        <form className="flex flex-col gap-[var(--space-1)]" onSubmit={(e) => { e.preventDefault(); call(`/api/drivers/${d.id}/password`, pw ? { password: pw } : {}, (j) => { setPw(''); onSecret({ who: d.name, username: d.username, password: j.password }); }); }}>
          <label className={FIELD_LABEL} htmlFor={`pw-${d.id}`}>New password</label>
          <input id={`pw-${d.id}`} className={FIELD_INPUT} value={pw} onChange={(e) => setPw(e.target.value)} maxLength={128} autoComplete="new-password" placeholder="Leave empty to generate one" />
          <p className={NOTE}>{d.name} is signed out on every device and must sign in with the new password.</p>
          <div className={BTNS}>
            <button type="submit" className={CTA} disabled={busy} data-reset-save>Set password</button>
            <button type="button" className={GHOST} onClick={() => setMode(null)}>Cancel</button>
          </div>
        </form>
      )}

      {err && <p className={ERR} role="alert">{err}</p>}

      {!mode && (
        <div className={BTNS}>
          <button type="button" className={GHOST} onClick={() => setMode('edit')}><Pencil strokeWidth={1.7} aria-hidden="true" />Edit</button>
          <button type="button" className={GHOST} onClick={() => setMode('password')} data-reset><KeyRound strokeWidth={1.7} aria-hidden="true" />New password</button>
          <button type="button" className={d.active ? DANGER : GHOST} onClick={toggle} disabled={busy} data-toggle-active>
            <Power strokeWidth={1.7} aria-hidden="true" />{d.active ? 'Deactivate' : 'Reactivate'}
          </button>
        </div>
      )}
    </article>
  );
}

export default function DriversPanel({ onExpired }) {
  const [list, setList] = useState(null);
  const [err, setErr] = useState('');
  const [secret, setSecret] = useState(null);

  const load = useCallback(async () => {
    try { setList((await getJson('/api/drivers')).drivers || []); }
    catch (e) { if (e instanceof Unauthorized) onExpired(); else setErr(e.message || 'Could not load drivers.'); }
  }, [onExpired]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className={`${STACK} max-w-[760px]`} data-drivers>
      {secret && <Secret {...secret} onDone={() => setSecret(null)} />}
      <CreateForm onExpired={onExpired} onCreated={async (s) => { setSecret(s); await load(); }} />
      {err && <p className={ERR} role="alert">{err}</p>}
      {!list && !err && <p className={EMPTY}>Loading drivers...</p>}
      {list && list.length === 0 && <p className={EMPTY}>No drivers yet. Add the first one above.</p>}
      {list && list.map((d) => (
        <DriverCard key={`${d.id}:${d.active}:${d.name}:${d.phone}`} d={d} onChanged={load} onSecret={setSecret} onExpired={onExpired} />
      ))}
      {list && list.length > 0 && (
        <p className={NOTE}>
          Drivers sign in at <strong>/driver</strong> on this same address, and can add it to their Home Screen from there.
        </p>
      )}
    </div>
  );
}
