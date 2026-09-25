'use client';

import { useCallback, useEffect, useState } from 'react';
import { RotateCcw, AlertTriangle } from 'lucide-react';
import { FIELD_INPUT } from '@/components/ui/formClasses';
import { BTN_SM } from '@/components/ui/btnClasses';
import { getJson, postJson, Unauthorized } from '@/lib/api';

// Change a price without a deploy.
//
// The number typed here is RUPIAH, because rupiah is the source of truth for
// every price on this site - USD and the rest are derived from it. The panel
// shows the derived USD next to the field so it is never a surprise, but it is
// read-only: a second editable currency is a second number that can drift.

const GROUPS = { tour: 'Tours', combo: 'Tour packages', place: 'Destinations',
  experience: 'Experiences', performance: 'Performances', transfer: 'Transfers', villa: 'Villas' };

const WRAP = 'flex flex-col gap-[var(--space-2)]';
const TOOLS = 'flex items-center gap-[var(--space-2)] mb-[var(--space-3)] flex-wrap';
const GROUP = 'font-body text-label font-medium tracking-[0.14em] uppercase text-muted m-0 mt-[var(--space-3)] mb-[var(--space-1)]';
const ROW =
  'flex items-center flex-wrap gap-x-[var(--space-2)] gap-y-[0.5rem] p-[0.7rem_0.9rem] rounded-[var(--r-md)] ' +
  'bg-white [border:1px_solid_var(--line)]';
const ROW_ON = 'bg-cream';
const NAME = 'font-body text-body text-green flex-1 min-w-[150px]';
const WAS = 'font-body text-small text-muted line-through';
const USD = 'font-body text-small text-muted tabular-nums w-[52px] text-right';
const GHOST =
  `inline-flex ${BTN_SM} gap-[0.35rem] bg-white text-gold [border:1px_solid_var(--line)] cursor-pointer ` +
  '[&>svg]:w-[var(--icon-sm)] [&>svg]:h-[var(--icon-sm)] [&>svg]:shrink-0 ' +
  '[transition:background-color_var(--dur)_var(--ease),scale_var(--dur-fast)_var(--ease)] hover:bg-cream';
const SAVE =
  `inline-flex ${BTN_SM} bg-cta text-white border-none cursor-pointer disabled:opacity-60 ` +
  '[transition:background-color_var(--dur)_var(--ease),scale_var(--dur-fast)_var(--ease)] hover:bg-cta-d';
const NOTE = 'font-body text-small text-muted m-0';
const ERR = 'font-body text-small text-err m-0 basis-full';
const BANNER =
  'p-[0.9rem] rounded-[var(--r-md)] bg-cream [border:1px_solid_var(--line)] mb-[var(--space-3)] ' +
  'font-body text-body text-green [&>svg]:inline [&>svg]:w-[var(--icon-sm)] [&>svg]:h-[var(--icon-sm)] [&>svg]:mr-[0.4rem]';

const rp = (n) => (n == null ? '' : Number(n).toLocaleString('en-US'));
// The field shows grouped digits while it is being typed. A dropped zero is the
// mistake this whole screen is defended against, and 90,000 next to 900,000 is
// spottable at a glance where 90000 next to 900000 is not.
const digits = (v) => String(v).replace(/[^\d]/g, '');
const grouped = (v) => (digits(v) ? Number(digits(v)).toLocaleString('en-US') : '');

export default function PricesPanel({ onExpired }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  // Per row: what is typed, what the server is asking us to confirm, what went wrong.
  const [draft, setDraft] = useState({});
  const [ask, setAsk] = useState({});
  const [rowErr, setRowErr] = useState({});

  const load = useCallback(async () => {
    setBusy(true); setErr('');
    try {
      setData(await getJson('/api/prices'));
      setDraft({}); setAsk({}); setRowErr({});
    } catch (e) {
      if (e instanceof Unauthorized) onExpired();
      else setErr(e.message || 'Could not load prices.');
    }
    setBusy(false);
  }, [onExpired]);

  useEffect(() => { load(); }, [load]);

  async function save(name, body) {
    setBusy(true);
    setRowErr((p) => ({ ...p, [name]: '' }));
    try {
      const { status, json: out } = await postJson('/api/prices', { name, ...body });
      if (status === 409) {
        // A big move is allowed, but the server makes us say so out loud first.
        setAsk((p) => ({ ...p, [name]: out.detail || 'Confirm this change.' }));
      } else if (status !== 200) {
        setRowErr((p) => ({ ...p, [name]: out.detail || `Server answered ${status}.` }));
      } else {
        setAsk((p) => ({ ...p, [name]: '' }));
        setDraft((p) => ({ ...p, [name]: undefined }));
        await load();
      }
    } catch (e) {
      if (e instanceof Unauthorized) onExpired();
      else setRowErr((p) => ({ ...p, [name]: e.message || 'Could not save.' }));
    }
    setBusy(false);
  }

  if (err) return <p className="font-body text-body text-err m-0 py-[var(--space-3)]">{err}</p>;
  if (!data) return <p className="font-body text-body text-muted m-0 py-[var(--space-3)]">Loading prices...</p>;

  const query = q.trim().toLowerCase();
  const rows = data.items.filter((r) => !query || r.name.toLowerCase().includes(query));
  const groups = [...new Set(rows.map((r) => r.category))];
  const drift = data.drift || [];

  return (
    <div>
      {drift.length > 0 && (
        <p className={BANNER}>
          <AlertTriangle strokeWidth={1.7} aria-hidden="true" />
          {drift.length} price{drift.length > 1 ? 's are' : ' is'} changed here but still
          {' '}old on the website itself - guests are charged the new price, but the price
          {' '}printed on the cards and sent to Google stays old until the site is rebuilt.
        </p>
      )}

      <div className={TOOLS}>
        <input
          className={`${FIELD_INPUT} !w-auto flex-1 min-w-[180px]`}
          placeholder="Search a tour, place or transfer"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search prices"
        />
        <span className={NOTE}>{'≈'} Rp {rp(data.rate)} per USD</span>
      </div>

      {rows.length === 0 && <p className={NOTE}>Nothing matches that search.</p>}

      {groups.map((cat) => (
        <div key={cat}>
          <p className={GROUP}>{GROUPS[cat] || cat}</p>
          <div className={WRAP}>
            {rows.filter((r) => r.category === cat).map((r) => {
              const typed = draft[r.name];
              const raw = typed === undefined ? String(r.idr) : digits(typed);
              const changed = String(r.idr) !== raw;
              const on = r.overrideIdr != null;
              return (
                <div key={r.name} className={`${ROW} ${on ? ROW_ON : ''}`}>
                  <span className={NAME}>{r.name}</span>

                  {/* The shipped number stays visible, so "what did I change it from"
                      never needs remembering. */}
                  {on && <span className={WAS}>Rp {rp(r.baseIdr)}</span>}

                  <span className={NOTE}>Rp</span>
                  <input
                    className={`${FIELD_INPUT} !w-[118px] text-right tabular-nums`}
                    inputMode="numeric"
                    value={grouped(raw)}
                    aria-label={`Price for ${r.name} in rupiah`}
                    onChange={(e) => setDraft((p) => ({ ...p, [r.name]: digits(e.target.value) }))}
                    onKeyDown={(e) => { if (e.key === 'Enter' && changed) save(r.name, { idr: Number(raw) }); }}
                  />
                  <span className={USD}>${r.usd}</span>

                  {changed && (
                    <button type="button" className={SAVE} disabled={busy}
                            onClick={() => save(r.name, { idr: Number(raw) })}>
                      Save
                    </button>
                  )}
                  {on && !changed && (
                    <button type="button" className={GHOST} disabled={busy}
                            onClick={() => save(r.name, { clear: true })}>
                      <RotateCcw strokeWidth={1.7} aria-hidden="true" />
                      Reset
                    </button>
                  )}

                  {ask[r.name] && (
                    <p className={ERR}>
                      {ask[r.name]}{' '}
                      <button type="button" className={`${SAVE} ml-[0.4rem]`} disabled={busy}
                              onClick={() => save(r.name, { idr: Number(raw), confirm: true })}>
                        Confirm
                      </button>
                    </p>
                  )}
                  {rowErr[r.name] && <p className={ERR}>{rowErr[r.name]}</p>}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
