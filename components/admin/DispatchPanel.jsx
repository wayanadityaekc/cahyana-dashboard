'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Truck } from 'lucide-react';
import { FIELD_INPUT, FIELD_LABEL } from '@/components/ui/formClasses';
import {
  CARD, STACK, H3, BODY, NOTE, ERR, OKMSG, EMPTY, GHOST, CTA,
  PILL, PILL_OK, PILL_WAIT, PILL_BAD, dayLabel,
} from '@/components/ui/panelClasses';
import { getJson, postJson, Unauthorized } from '@/lib/api';
import { fmtTime } from '@/lib/time';

// Dispatch (DASHBOARD BRIEF #7): pick which driver takes each booking.
//
// What is listed is what the API calls dispatchable - confirmed (new/paid),
// today or later, not a villa stay. An unpaid booking never shows up here, so
// it can never reach a driver.
//
// A booking is several rows (one per day/item). The usual case is one driver
// for the whole booking, so that is the big control on each card; a single day
// can still go to someone else from its own line.

const LINE =
  'flex flex-wrap items-center gap-x-[0.6rem] gap-y-[0.35rem] py-[0.55rem] ' +
  '[&+&]:[border-top:1px_solid_var(--line)]';
const WHEN = 'font-body text-small font-semibold text-green whitespace-nowrap';
const WHAT = 'font-body text-body text-green';
const SMALL = 'font-body text-small text-muted';
const LINE_SELECT = `${FIELD_INPUT} !w-auto min-w-[150px] ml-auto max-[560px]:ml-0 max-[560px]:!w-full`;
const FILTERS = 'flex flex-wrap gap-[var(--space-1)] mb-[var(--space-2)]';
const chip = (on) =>
  'inline-flex items-center gap-[0.35rem] h-[var(--btn-h)] px-[0.8rem] rounded-sm font-body text-small font-semibold cursor-pointer ' +
  '[transition:background-color_var(--dur)_var(--ease),scale_var(--dur-fast)_var(--ease)] ' +
  (on ? 'bg-gold text-white border-none' : 'bg-white text-gold [border:1px_solid_var(--line)] hover:bg-cream');
const GROUP_FORM = 'grid gap-[var(--space-1)] min-[700px]:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] min-[700px]:items-end mt-[var(--space-1)] pt-[var(--space-2)] [border-top:1px_solid_var(--line)]';

// "4.5 (12 reviews)" or "No reviews yet" - never a made-up number (brief #8).
function ratingText(r) {
  if (!r || !r.count) return 'No reviews yet';
  return `${r.avg.toFixed(1)} (${r.count} review${r.count === 1 ? '' : 's'})`;
}
const optLabel = (d) => `${d.name} - ${ratingText(d.rating)}`;

function statusOf(r) {
  if (r.driverId && r.driverStatus === 'accepted') return { word: `Accepted - ${r.driverName}`, tone: PILL_OK };
  if (r.driverId) return { word: `Waiting - ${r.driverName}`, tone: PILL_WAIT };
  if (r.declinedBy) return { word: `Declined by ${r.declinedBy}`, tone: PILL_BAD };
  return { word: 'Unassigned', tone: PILL_BAD };
}

function groupRows(rows) {
  const map = new Map();
  for (const r of rows) {
    const key = r.ref || `row-${r.id}`;
    if (!map.has(key)) map.set(key, { key, ref: r.ref, name: r.name, phone: r.phone, guests: r.guests, rows: [] });
    map.get(key).rows.push(r);
  }
  return [...map.values()].map((g) => ({
    ...g,
    first: g.rows.map((r) => r.date).sort()[0],
    open: g.rows.some((r) => !r.driverId),
  }));
}

function GroupCard({ g, drivers, onAssign, busy }) {
  const assigned = new Set(g.rows.map((r) => r.driverId || 0));
  const common = assigned.size === 1 ? [...assigned][0] : '';
  const [pick, setPick] = useState(common ? String(common) : '');
  const [note, setNote] = useState(g.rows[0].note || '');
  const active = drivers.filter((d) => d.active);
  const many = g.rows.length > 1;

  return (
    <article className={CARD} data-dispatch-group={g.ref || g.key}>
      <div className="flex flex-wrap items-baseline gap-x-[0.6rem] gap-y-[0.2rem]">
        <h3 className={H3}>{g.ref || 'No ref'}</h3>
        <span className={BODY}>{g.name}{g.guests ? ` - ${g.guests} guest${Number(g.guests) > 1 ? 's' : ''}` : ''}</span>
        {g.phone && <span className={SMALL}>{g.phone}</span>}
      </div>

      <div>
        {g.rows.map((r) => {
          const st = statusOf(r);
          return (
            <div key={r.id} className={LINE} data-dispatch-row={r.id}>
              <span className={WHEN}>{dayLabel(r.date)}{r.time ? ` - ${fmtTime(r.time)}` : ''}</span>
              <span className={WHAT}>{r.service || r.type || 'Booking'}</span>
              {r.pickup && <span className={SMALL}>from {r.pickup}</span>}
              {r.dropoff && <span className={SMALL}>to {r.dropoff}</span>}
              {r.flightNumber && <span className={SMALL}>flight {r.flightNumber}</span>}
              <span className={`${PILL} ${st.tone}`} data-row-status>{st.word}</span>
              {r.driverId && <span className={SMALL} data-row-rating>{ratingText(r.driverRating)}</span>}
              {many && (
                <select
                  className={LINE_SELECT}
                  aria-label={`Driver for ${dayLabel(r.date)}`}
                  value={r.driverId ? String(r.driverId) : ''}
                  disabled={busy}
                  onChange={(e) => onAssign([r.id], e.target.value || null)}
                  data-row-driver
                >
                  <option value="">Unassigned</option>
                  {active.map((d) => <option key={d.id} value={d.id}>{optLabel(d)}</option>)}
                </select>
              )}
            </div>
          );
        })}
      </div>

      <form
        className={GROUP_FORM}
        onSubmit={(e) => { e.preventDefault(); onAssign(g.rows.map((r) => r.id), pick || null, note); }}
      >
        <div>
          <label className={FIELD_LABEL} htmlFor={`dr-${g.key}`}>{many ? 'Driver for the whole booking' : 'Driver'}</label>
          <select id={`dr-${g.key}`} className={FIELD_INPUT} value={pick} onChange={(e) => setPick(e.target.value)} data-group-driver>
            <option value="">Unassigned</option>
            {active.map((d) => <option key={d.id} value={d.id}>{optLabel(d)}</option>)}
          </select>
        </div>
        <div>
          <label className={FIELD_LABEL} htmlFor={`nt-${g.key}`}>Note for the driver</label>
          <input
            id={`nt-${g.key}`}
            className={FIELD_INPUT}
            maxLength={500}
            placeholder="e.g. meet at the lobby, child seat"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            data-group-note
          />
        </div>
        <button type="submit" className={CTA} disabled={busy} data-group-assign>
          <Truck strokeWidth={1.7} aria-hidden="true" />{pick ? 'Assign' : 'Save'}
        </button>
      </form>
    </article>
  );
}

export default function DispatchPanel({ onExpired, onGoDrivers }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('open');

  const load = useCallback(async () => {
    setErr('');
    try { setData(await getJson('/api/dispatch')); }
    catch (e) { if (e instanceof Unauthorized) onExpired(); else setErr(e.message || 'Could not load dispatch.'); }
  }, [onExpired]);

  useEffect(() => { load(); }, [load]);

  const groups = useMemo(() => (data ? groupRows(data.rows || []) : []), [data]);
  const open = groups.filter((g) => g.open);
  const shown = (filter === 'open' ? open : groups)
    .slice().sort((a, b) => (b.open - a.open) || String(a.first).localeCompare(String(b.first)));

  const assign = async (rows, driverId, note) => {
    setBusy(true); setErr(''); setMsg('');
    try {
      const body = { rows, driverId: driverId ? Number(driverId) : null };
      if (note !== undefined) body.note = note;
      const { status, json } = await postJson('/api/dispatch', body);
      if (status !== 200) setErr(json.detail || `Server answered ${status}.`);
      else {
        const who = driverId ? (data.drivers.find((d) => String(d.id) === String(driverId)) || {}).name : null;
        setMsg(who ? `Sent to ${who}. They get a notification and can accept or decline.` : 'Saved - back in Unassigned.');
        await load();
      }
    } catch (e) { if (e instanceof Unauthorized) onExpired(); else setErr(e.message || 'Could not save that.'); }
    setBusy(false);
  };

  if (err && !data) return <p className={ERR} role="alert">{err}</p>;
  if (!data) return <p className={EMPTY}>Loading dispatch...</p>;

  const active = (data.drivers || []).filter((d) => d.active);

  return (
    <div className={STACK} data-dispatch>
      {active.length === 0 && (
        <p className={`${NOTE} p-[0.7rem_0.9rem] rounded-[var(--r-md)] bg-cream [border:1px_solid_var(--line)]`} data-no-drivers>
          No active drivers yet.{' '}
          <button type="button" className="text-gold underline underline-offset-2 bg-transparent border-none p-0 cursor-pointer font-body text-small" onClick={onGoDrivers}>
            Add one in Drivers
          </button>{' '}first.
        </p>
      )}

      <div className={FILTERS}>
        <button type="button" className={chip(filter === 'open')} onClick={() => setFilter('open')} aria-pressed={filter === 'open'} data-filter="open">
          Needs a driver <span className="tabular-nums">{open.length}</span>
        </button>
        <button type="button" className={chip(filter === 'all')} onClick={() => setFilter('all')} aria-pressed={filter === 'all'} data-filter="all">
          All upcoming <span className="tabular-nums">{groups.length}</span>
        </button>
        <button type="button" className={`${GHOST} ml-auto`} onClick={load} disabled={busy}>
          <RefreshCw strokeWidth={1.7} aria-hidden="true" />Refresh
        </button>
      </div>

      {err && <p className={ERR} role="alert">{err}</p>}
      {msg && <p className={OKMSG} role="status">{msg}</p>}

      {shown.length === 0 && (
        <p className={EMPTY} data-dispatch-empty>
          {filter === 'open' ? 'Every upcoming booking has a driver.' : 'No confirmed bookings coming up.'}
        </p>
      )}
      {shown.map((g) => (
        <GroupCard key={`${g.key}:${g.rows.map((r) => `${r.driverId}-${r.note}`).join('|')}`} g={g} drivers={data.drivers || []} onAssign={assign} busy={busy} />
      ))}

      <p className={NOTE}>
        Only confirmed bookings appear here (paid, or not charged online). Unpaid bookings never reach a driver.
      </p>
    </div>
  );
}
