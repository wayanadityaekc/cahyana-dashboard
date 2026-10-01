'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { CARD, STACK, HEAD, NOTE, ERR, EMPTY, GHOST, PILL, PILL_OK, PILL_BAD, PILL_WAIT, dayLabel } from '@/components/ui/panelClasses';
import { getJson, Unauthorized } from '@/lib/api';

// Villas > Calendar (DASHBOARD BRIEF #8). The booking form checks a stay against
// each villa's Airbnb calendar and REFUSES when the calendar is taken OR cannot be
// read. This page shows what that check sees, so a revoked link is visible here
// instead of looking like "no bookings".
//
// The Airbnb link is a secret (it exposes guest names): only its host and shape
// are shown, by the API, never the link.

function when(v) {
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function Villa({ v }) {
  const ok = v.url_set && v.fetch_ok;
  const bad = !v.url_set ? 'No Airbnb link is set on the server. Every stay at this villa is refused as "unknown".'
    : !v.fetch_ok ? `The link did not work (${v.error || 'no answer'}). Stays are refused as "unknown" until it does.` : '';
  const busy = (v.busy || []).slice(0, 40);
  return (
    <section className={CARD} data-villa-cal={v.name}>
      <div className="flex flex-wrap items-baseline gap-x-[0.6rem] gap-y-[0.2rem]">
        <h2 className={HEAD}>{v.name}</h2>
        <span className={`${PILL} ${ok ? PILL_OK : PILL_BAD}`} data-cal-state>{ok ? 'Calendar readable' : 'Calendar NOT readable'}</span>
        {v.stale && <span className={`${PILL} ${PILL_WAIT}`}>Showing saved copy</span>}
      </div>
      {bad && <p className={ERR} role="alert">{bad}</p>}
      <p className={NOTE}>
        Link: {v.url_set ? `set (${v.host || 'unknown host'})` : 'not set'}
        {v.url_set && !v.looks_like_airbnb ? ' - does not look like Airbnb' : ''}
        {v.has_whitespace ? ' - has stray spaces, fix it in Railway' : ''}
        {v.cached_at ? `  |  last read ${when(v.cached_at)}` : ''}
      </p>
      {ok && (
        <>
          <p className={NOTE}>{busy.length ? `${v.busy.length} taken period${v.busy.length === 1 ? '' : 's'}` : 'No taken nights ahead.'}</p>
          {busy.length > 0 && (
            <ul className="list-none m-0 p-0">
              {busy.map((b, i) => (
                <li key={i} className="py-[0.35rem] font-body text-body text-green [&+&]:[border-top:1px_solid_var(--line)]">
                  {dayLabel(b.from, true)} to {dayLabel(b.to, true)} <span className="text-muted text-small">(last night, inclusive)</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

export default function VillaCalendarPanel({ onExpired }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true); setErr('');
    try { setData(await getJson('/api/villa-calendar')); }
    catch (e) { if (e instanceof Unauthorized) onExpired(); else setErr(e.message || 'Could not load the calendar check.'); }
    setBusy(false);
  }, [onExpired]);

  useEffect(() => { load(); }, [load]);

  if (err && !data) return <p className={ERR} role="alert">{err}</p>;
  if (!data) return <p className={EMPTY}>Checking the calendars...</p>;
  const villas = Object.values(data.villas || {});

  return (
    <div className={`${STACK} max-w-[720px]`} data-villa-calendar>
      <div><button type="button" className={GHOST} onClick={load} disabled={busy}><RefreshCw strokeWidth={1.7} aria-hidden="true" />Check again</button></div>
      {data.demo && <p className={NOTE}>The demo has no villa data.</p>}
      {err && <p className={ERR} role="alert">{err}</p>}
      {villas.map((v) => <Villa key={v.name} v={v} />)}
      {!villas.length && !data.demo && <p className={EMPTY}>No villas reported by the server.</p>}
    </div>
  );
}
