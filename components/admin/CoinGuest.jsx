'use client';

import { useState } from 'react';
import { Search, UserRound } from 'lucide-react';
import { FIELD_INPUT, FIELD_LABEL } from '@/components/ui/formClasses';
import { CARD, HEAD, NOTE, ERR, OKMSG, BODY, GHOST, CTA, EMPTY, dayLabel } from '@/components/ui/panelClasses';
import ConfirmBar from '@/components/ui/ConfirmBar';
import { getJson, postJson, Unauthorized } from '@/lib/api';
import { sourceWord, statusWord, signed, isLive } from '@/lib/coinLabels';

// One guest's coins, found by the email on their account: balance, what expires
// next, the history, and a manual correction. A minus asks first - it takes coins
// away from a real guest.

const ROW = 'flex flex-wrap items-end gap-[var(--space-1)]';
const BIG = 'font-body text-h2 font-semibold text-gold m-0 tabular-nums';
const LIST = 'flex flex-col m-0 p-0 list-none';
const ITEM = 'flex flex-wrap items-baseline gap-x-[0.6rem] gap-y-[0.1rem] py-[0.45rem] [&+&]:[border-top:1px_solid_var(--line)]';
const DELTA = 'font-body text-body font-semibold tabular-nums min-w-[2.5rem]';
const DEAD = 'line-through text-muted';

function HistoryRow({ row }) {
  const live = isLive(row.status);
  const tone = row.delta > 0 ? 'text-ok' : 'text-err';
  const status = statusWord(row.status);
  return (
    <li className={ITEM} data-coin-history-row>
      <span className={`${DELTA} ${live ? tone : DEAD}`}>{signed(row.delta)}</span>
      <span className={BODY}>{sourceWord(row.source)}{row.ref ? ` - ${row.ref}` : ''}</span>
      <span className={NOTE}>{dayLabel(row.date, true)}{status ? ` - ${status}` : ''}{row.expires && live && row.delta > 0 ? ` - expires ${dayLabel(row.expires, true)}` : ''}</span>
    </li>
  );
}

export default function CoinGuest({ onExpired }) {
  const [email, setEmail] = useState('');
  const [found, setFound] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [delta, setDelta] = useState('');
  const [note, setNote] = useState('');
  const [adjErr, setAdjErr] = useState('');
  const [adjOk, setAdjOk] = useState('');
  const [asking, setAsking] = useState(false);

  async function lookUp(event) {
    if (event) event.preventDefault();
    const typed = email.trim();
    if (!typed.includes('@')) { setErr('Type the email address on the guest\'s account.'); return; }
    setBusy(true); setErr(''); setFound(null); setAdjErr(''); setAdjOk('');
    try {
      setFound(await getJson(`/api/coins/account?email=${encodeURIComponent(typed)}`));
    } catch (e) {
      if (e instanceof Unauthorized) onExpired();
      else setErr(e.message || 'Could not look that up.');
    }
    setBusy(false);
  }

  async function apply() {
    setBusy(true); setAdjErr(''); setAdjOk('');
    try {
      const { status, json } = await postJson('/api/coins/adjust', { email: found.account.email, delta: Number(delta), note: note.trim() });
      if (status !== 200) {
        setAdjErr(json.balance != null ? `${json.detail || 'Refused'} - the balance is ${json.balance}.` : json.detail || `Server answered ${status}.`);
      } else {
        setFound((prev) => ({ ...prev, ...json }));
        setAdjOk(`Done. ${signed(delta)} coins, balance now ${json.balance}.`);
        setDelta(''); setNote('');
      }
    } catch (e) {
      if (e instanceof Unauthorized) onExpired();
      else setAdjErr(e.message || 'Could not save.');
    }
    setAsking(false);
    setBusy(false);
  }

  // Both sides check: the range and the note here, then the API again.
  function start() {
    setAdjErr(''); setAdjOk('');
    const n = Number(delta);
    if (!Number.isInteger(n) || n === 0 || n < -100 || n > 100) { setAdjErr('Coins must be a whole number from -100 to 100, not 0.'); return; }
    if (!note.trim()) { setAdjErr('Write a note: why the coins change. The guest\'s history keeps it.'); return; }
    if (n < 0) { setAsking(true); return; }
    apply();
  }

  const history = found ? found.history || [] : [];

  return (
    <section className={CARD} data-coin-guest>
      <h2 className={HEAD}><UserRound strokeWidth={1.7} aria-hidden="true" />Guest coins</h2>
      <form className={ROW} onSubmit={lookUp}>
        <span className="flex-1 min-w-[200px]">
          <label className={FIELD_LABEL} htmlFor="coin-email">Guest email</label>
          <input id="coin-email" className={FIELD_INPUT} type="email" autoComplete="off" placeholder="guest@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </span>
        <button type="submit" className={GHOST} disabled={busy} data-coin-lookup><Search strokeWidth={1.7} aria-hidden="true" />{busy && !found ? 'Looking' : 'Look up'}</button>
      </form>
      {err && <p className={ERR} role="alert" data-coin-guest-err>{err}</p>}
      {!found && !err && <p className={NOTE}>Guests sign in with their email, so their coins live on that address.</p>}

      {found && (
        <div className="flex flex-col gap-[var(--space-2)]" data-coin-account={found.account.email}>
          <div className="flex flex-wrap items-end gap-[var(--space-3)]">
            <span>
              <span className={NOTE}>Balance</span>
              <p className={BIG} data-coin-balance>{found.balance}</p>
            </span>
            <p className={NOTE} data-coin-expiry>
              {found.nextExpiry ? `${found.nextExpiry.coins} coin${found.nextExpiry.coins === 1 ? '' : 's'} expire on ${dayLabel(found.nextExpiry.date, true)}` : 'Nothing expiring.'}
            </p>
          </div>

          {history.length === 0
            ? <p className={EMPTY}>No coins yet. They arrive when this guest's first booking is paid.</p>
            : <ul className={LIST} aria-label="Coin history">{history.map((row, index) => <HistoryRow key={index} row={row} />)}</ul>}

          <div className={ROW}>
            <span>
              <label className={FIELD_LABEL} htmlFor="coin-delta">Add or take coins</label>
              <input id="coin-delta" className={`${FIELD_INPUT} !w-[96px]`} type="number" inputMode="numeric" min={-100} max={100} placeholder="-2 or 3" value={delta} onChange={(e) => setDelta(e.target.value)} />
            </span>
            <span className="flex-1 min-w-[200px]">
              <label className={FIELD_LABEL} htmlFor="coin-note">Note (required)</label>
              <input id="coin-note" className={FIELD_INPUT} maxLength={200} placeholder="Why" value={note} onChange={(e) => setNote(e.target.value)} />
            </span>
            {!asking && <button type="button" className={CTA} disabled={busy} onClick={start} data-coin-apply>Apply</button>}
          </div>
          {asking && (
            <ConfirmBar
              message={`Take ${Math.abs(Number(delta))} coin${Math.abs(Number(delta)) === 1 ? '' : 's'} from ${found.account.email}? Their balance is ${found.balance}.`}
              confirmLabel="Take coins"
              busy={busy}
              onConfirm={apply}
              onCancel={() => setAsking(false)}
            />
          )}
          {adjErr && <p className={ERR} role="alert" data-coin-adjust-err>{adjErr}</p>}
          {adjOk && <p className={OKMSG} data-coin-adjust-ok>{adjOk}</p>}
        </div>
      )}
    </section>
  );
}
