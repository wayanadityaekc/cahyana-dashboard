'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, Coins, Gift, Undo2 } from 'lucide-react';
import { FIELD_INPUT, FIELD_LABEL } from '@/components/ui/formClasses';
import { NOTE, ERR, OKMSG, BODY, GHOST, DANGER, CTA } from '@/components/ui/panelClasses';
import ConfirmBar from '@/components/ui/ConfirmBar';
import { getJson, postJson, Unauthorized } from '@/lib/api';
import { sourceWord, statusWord, signed, isLive, COVERED } from '@/lib/coinLabels';

const WRAP = 'mt-[0.6rem] pt-[0.6rem] [border-top:1px_solid_var(--line)] flex flex-col gap-[var(--space-1)]';
const TOGGLE =
  'inline-flex items-center gap-[0.4rem] self-start bg-transparent border-none p-0 cursor-pointer font-body text-small font-semibold text-gold ' +
  '[&>svg]:w-[var(--icon-sm)] [&>svg]:h-[var(--icon-sm)] [transition:color_var(--dur)_var(--ease)] hover:text-gold-d';
const LIST = 'flex flex-col m-0 p-0 list-none';
const ITEM = 'flex flex-wrap items-baseline gap-x-[0.5rem] gap-y-[0.1rem] py-[0.35rem] [&+&]:[border-top:1px_solid_var(--line)]';
const DELTA = 'font-body text-body font-semibold tabular-nums min-w-[2.2rem]';
// The note villa staff act on: never charge the guest for this.
export const COVERED_NOTE =
  'flex items-start gap-[0.4rem] m-0 p-[0.45rem_0.7rem] rounded-[var(--r-sm)] bg-cream [border:1px_solid_var(--color-ok)] ' +
  'font-body text-small font-semibold text-green [&>svg]:w-[var(--icon-sm)] [&>svg]:h-[var(--icon-sm)] [&>svg]:shrink-0 [&>svg]:mt-[0.1rem] [&>svg]:text-ok';
const PICK = 'flex flex-wrap gap-[var(--space-1)]';
const OPTION =
  'inline-flex items-center gap-[0.4rem] h-[var(--btn-h)] px-[0.8rem] rounded-sm font-body text-small cursor-pointer ' +
  '[transition:background-color_var(--dur)_var(--ease),border-color_var(--dur)_var(--ease)]';
const OPTION_OFF = `${OPTION} bg-white text-gold [border:1px_solid_var(--line)] hover:bg-cream`;
const OPTION_ON = `${OPTION} bg-cream text-gold-d [border:1px_solid_var(--color-gold)]`;

function goLogin() { window.location.assign('/login'); }

function CoinRow({ row }) {
  const live = isLive(row.status);
  const covered = row.note && row.note.startsWith(COVERED) && live;
  const status = statusWord(row.status);
  return (
    <li className={ITEM} data-booking-coin-row={row.source}>
      <span className={`${DELTA} ${live ? (row.delta > 0 ? 'text-ok' : 'text-err') : 'text-muted line-through'}`}>{signed(row.delta)}</span>
      <span className={BODY}>{sourceWord(row.source)}</span>
      {status && <span className={NOTE}>{status}</span>}
      {row.note && !covered && <span className={NOTE}>{row.note}</span>}
      {covered && (
        <p className={`${COVERED_NOTE} basis-full`} data-covered-note>
          <Gift strokeWidth={1.8} aria-hidden="true" /><span>{row.note}. Do not charge the guest for it.</span>
        </p>
      )}
    </li>
  );
}

function RedeemPerk({ refKey, property, onDone }) {
  const [menu, setMenu] = useState(null);
  const [err, setErr] = useState('');
  const [picked, setPicked] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await getJson('/api/coins/rules');
        if (alive) setMenu((data.menu || []).filter((item) => item.property === property && item.active));
      } catch (e) {
        if (e instanceof Unauthorized) goLogin();
        else if (alive) setErr(e.message || 'Could not load the perk menu.');
      }
    })();
    return () => { alive = false; };
  }, [property]);

  async function redeem() {
    setBusy(true); setErr('');
    try {
      const { status, json } = await postJson('/api/coins/redeem', { ref: refKey, itemId: picked.id });
      if (status !== 200) {
        setErr(`${json.detail || json.reason || `Server answered ${status}`}${json.balance != null ? ` (balance ${json.balance})` : ''}.`);
        setPicked(null);
      } else onDone(`${json.note || `${COVERED} ${picked.item_label}`}. Guest balance now ${json.balance}.`);
    } catch (e) {
      if (e instanceof Unauthorized) goLogin();
      else setErr(e.message || 'Could not redeem.');
    }
    setBusy(false);
  }

  if (err && !menu) return <p className={ERR} role="alert">{err}</p>;
  if (!menu) return <p className={NOTE}>Loading the perk menu...</p>;
  if (menu.length === 0) return <p className={NOTE} data-redeem-empty>No perks are switched on for {property}. Add one in Coins, Villa perks.</p>;

  return (
    <div className="flex flex-col gap-[var(--space-1)]" data-redeem-picker>
      <span className={FIELD_LABEL}>Perk at {property}</span>
      <div className={PICK} role="group" aria-label="Perk">
        {menu.map((item) => (
          <button key={item.id} type="button" aria-pressed={picked?.id === item.id} className={picked?.id === item.id ? OPTION_ON : OPTION_OFF}
            onClick={() => setPicked(item)} data-redeem-item={item.id}>
            {item.item_label} <span className="tabular-nums text-muted">{item.coin_cost} coin{item.coin_cost === 1 ? '' : 's'}</span>
          </button>
        ))}
      </div>
      {picked && (
        <ConfirmBar
          message={`Use ${picked.coin_cost} of the guest's coins for "${picked.item_label}" on ${refKey}?`}
          confirmLabel="Use coins"
          busy={busy}
          onConfirm={redeem}
          onCancel={() => setPicked(null)}
        />
      )}
      {err && <p className={ERR} role="alert" data-redeem-err>{err}</p>}
    </div>
  );
}

export default function BookingCoins({ group, side = 'cue' }) {
  const refKey = group.ref;
  const stay = group.lines.find((line) => line.type === 'villa');
  // Closed on tours (the admin limiter is shared, so one request per opened card); open on villas so staff see every note.
  const [open, setOpen] = useState(side === 'villa');
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [mode, setMode] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');

  const load = useCallback(async () => {
    setErr('');
    try {
      const data = await getJson(`/api/coins/booking/${encodeURIComponent(refKey)}`);
      setRows(data.rows || []);
    } catch (e) {
      if (e instanceof Unauthorized) goLogin();
      else setErr(e.message || 'Could not load the coins.');
    }
  }, [refKey]);

  useEffect(() => { if (open && rows === null) load(); }, [open, rows, load]);

  async function refund() {
    setBusy(true); setErr('');
    try {
      const { status, json } = await postJson('/api/coins/reverse', { ref: refKey, note: note.trim() || 'Refunded' });
      if (status !== 200) setErr(json.detail || `Server answered ${status}.`);
      else {
        setDone(`Coins refunded: ${json.reversed} earned row${json.reversed === 1 ? '' : 's'} removed, ${json.returned} spent row${json.returned === 1 ? '' : 's'} given back.`);
        setMode(''); setNote('');
        load();
      }
    } catch (e) {
      if (e instanceof Unauthorized) goLogin();
      else setErr(e.message || 'Could not refund the coins.');
    }
    setBusy(false);
  }

  // Booking refs are what the API keys coins on; a row without one has none.
  if (!refKey) return null;

  const liveRows = (rows || []).filter((row) => isLive(row.status));

  return (
    <div className={WRAP} data-booking-coins={refKey}>
      <button type="button" className={TOGGLE} aria-expanded={open} onClick={() => setOpen((wasOpen) => !wasOpen)} data-coins-toggle>
        <Coins strokeWidth={1.7} aria-hidden="true" />Coins
        {rows && <span className="font-normal text-muted tabular-nums">{liveRows.length} row{liveRows.length === 1 ? '' : 's'}</span>}
        <ChevronDown strokeWidth={1.7} aria-hidden="true" className={open ? 'rotate-180' : ''} />
      </button>

      {open && (
        <>
          {err && <p className={ERR} role="alert" data-booking-coins-err>{err}</p>}
          {!rows && !err && <p className={NOTE}>Loading coins...</p>}
          {rows && rows.length === 0 && <p className={NOTE} data-booking-coins-empty>No coins on this booking. Coins are earned when it is paid.</p>}
          {rows && rows.length > 0 && <ul className={LIST} aria-label={`Coins on ${refKey}`}>{rows.map((row, index) => <CoinRow key={index} row={row} />)}</ul>}
          {done && <p className={OKMSG} data-booking-coins-ok>{done}</p>}

          {rows && mode === '' && (
            <div className="flex flex-wrap gap-[var(--space-1)]">
              {stay && <button type="button" className={CTA} onClick={() => { setDone(''); setMode('redeem'); }} data-redeem-open><Gift strokeWidth={1.7} aria-hidden="true" />Redeem perk</button>}
              {rows.length > 0 && <button type="button" className={DANGER} onClick={() => { setDone(''); setMode('refund'); }} data-refund-open><Undo2 strokeWidth={1.7} aria-hidden="true" />Refund coins</button>}
            </div>
          )}

          {mode === 'refund' && (
            <ConfirmBar
              message={`Refund the coins on ${refKey}? Coins it earned are removed and coins it spent go back to the guest. Do this after you refund the booking by hand.`}
              confirmLabel="Refund coins"
              busy={busy}
              onConfirm={refund}
              onCancel={() => setMode('')}
            >
              <span>
                <label className={FIELD_LABEL} htmlFor={`refund-note-${refKey}`}>Note (optional)</label>
                <input id={`refund-note-${refKey}`} className={FIELD_INPUT} maxLength={200} placeholder="Refunded" value={note} onChange={(e) => setNote(e.target.value)} />
              </span>
            </ConfirmBar>
          )}

          {mode === 'redeem' && stay && (
            <>
              <RedeemPerk refKey={refKey} property={stay.service} onDone={(message) => { setDone(message); setMode(''); load(); }} />
              <button type="button" className={`${GHOST} self-start`} onClick={() => setMode('')} data-redeem-close>Close</button>
            </>
          )}
        </>
      )}
    </div>
  );
}
