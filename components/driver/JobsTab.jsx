'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, MapPin, Phone, Plane, RefreshCw, StickyNote, Users, X } from 'lucide-react';
import {
  CARD, STACK, HEAD, H3, NOTE, ERR, OKMSG, EMPTY, BTNS, GHOST, CTA, DANGER,
  PILL, PILL_OK, PILL_WAIT, dayLabel,
} from '@/components/ui/panelClasses';
import { getJson, postJson, Unauthorized } from '@/lib/api';
import { fmtTime } from '@/lib/time';

// Bookings tab (DASHBOARD BRIEF #7): only the jobs assigned to THIS driver.
// What a job shows is exactly what the API's allowlist sends (brief #7 Q2):
// first name + last initial, phone, pickup, time, guests, flight, the owner's
// note. No guest email and no price ever reach this page.
//
// Accept or decline (Q5). A decline sends the job back to the owner's
// Unassigned list, so it asks first.

const FACTS = 'flex flex-col gap-[0.35rem]';
const FACT =
  'flex items-start gap-[0.5rem] font-body text-body text-green m-0 ' +
  '[&>svg]:w-[var(--icon-sm)] [&>svg]:h-[var(--icon-sm)] [&>svg]:shrink-0 [&>svg]:mt-[0.15rem] [&>svg]:text-muted';
const WHEN = 'font-body text-strong font-semibold text-green m-0';
const SECTION = 'font-body text-label font-medium tracking-[0.08em] uppercase text-muted m-0 mt-[var(--space-2)]';
const TEL = 'text-gold underline underline-offset-2';

function JobCard({ j, past, busy, onRespond }) {
  const accepted = j.status === 'accepted';
  return (
    <article className={CARD} data-job={j.id}>
      <div className="flex flex-wrap items-baseline gap-x-[0.6rem] gap-y-[0.2rem]">
        <p className={WHEN}>{dayLabel(j.date)}{j.time ? ` - ${fmtTime(j.time)}` : ''}</p>
        <span className={`${PILL} ${accepted ? PILL_OK : PILL_WAIT} ml-auto`} data-job-status>
          {past ? 'Done' : accepted ? 'Accepted' : 'New - please answer'}
        </span>
      </div>
      <h3 className={H3}>{j.service || 'Job'}{j.ref ? <span className="font-normal text-muted"> - {j.ref}</span> : null}</h3>
      <div className={FACTS}>
        <p className={FACT}><Users strokeWidth={1.7} aria-hidden="true" />{j.guestName || 'Guest'}{j.guests ? `, ${j.guests} guest${Number(j.guests) > 1 ? 's' : ''}` : ''}</p>
        {j.phone && <p className={FACT}><Phone strokeWidth={1.7} aria-hidden="true" /><a className={TEL} href={`tel:${j.phone.replace(/[^\d+]/g, '')}`}>{j.phone}</a></p>}
        {(j.pickup || j.dropoff) && (
          <p className={FACT}><MapPin strokeWidth={1.7} aria-hidden="true" />{[j.pickup && `From ${j.pickup}`, j.dropoff && `to ${j.dropoff}`].filter(Boolean).join(' ')}</p>
        )}
        {j.flightNumber && <p className={FACT}><Plane strokeWidth={1.7} aria-hidden="true" />Flight {j.flightNumber}</p>}
        {j.note && <p className={FACT} data-job-note><StickyNote strokeWidth={1.7} aria-hidden="true" />{j.note}</p>}
      </div>
      {!past && (
        <div className={BTNS}>
          {!accepted && (
            <button type="button" className={CTA} disabled={busy} onClick={() => onRespond([j.id], 'accept')} data-accept>
              <Check strokeWidth={2} aria-hidden="true" />Accept
            </button>
          )}
          <button type="button" className={DANGER} disabled={busy} onClick={() => onRespond([j.id], 'decline')} data-decline>
            <X strokeWidth={2} aria-hidden="true" />Decline
          </button>
        </div>
      )}
    </article>
  );
}

export default function JobsTab({ onExpired, onCount }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setErr('');
    try {
      const j = await getJson('/api/driver/jobs');
      setData(j);
      if (onCount) onCount([...j.todayJobs, ...j.upcoming].filter((x) => x.status !== 'accepted').length);
    } catch (e) { if (e instanceof Unauthorized) onExpired(); else setErr(e.message || 'Could not load your jobs.'); }
  }, [onExpired, onCount]);

  useEffect(() => {
    load();
    // A new assignment should appear without a pull: re-read when the app comes
    // back to the front (a push tap does exactly that).
    const onVis = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVis);
    const t = setInterval(onVis, 60000);
    return () => { document.removeEventListener('visibilitychange', onVis); clearInterval(t); };
  }, [load]);

  const respond = async (ids, action) => {
    if (action === 'decline') {
      // eslint-disable-next-line no-alert
      if (!window.confirm(ids.length > 1 ? `Decline these ${ids.length} jobs? They go back to Cahyana to give to another driver.` : 'Decline this job? It goes back to Cahyana to give to another driver.')) return;
    }
    setBusy(true); setErr(''); setMsg('');
    try {
      const { status, json } = await postJson('/api/driver/jobs/respond', { ids, action });
      if (status !== 200) setErr(json.detail || `Server answered ${status}.`);
      else setMsg(action === 'accept' ? 'Accepted. Cahyana can see it.' : 'Declined. Cahyana has been told.');
      await load();
    } catch (e) { if (e instanceof Unauthorized) onExpired(); else setErr(e.message); }
    setBusy(false);
  };

  if (err && !data) return <p className={ERR} role="alert">{err}</p>;
  if (!data) return <p className={EMPTY}>Loading your jobs...</p>;

  const ahead = [...data.todayJobs, ...data.upcoming];
  const waiting = ahead.filter((j) => j.status !== 'accepted');

  return (
    <div className={`${STACK} max-w-[640px]`} data-jobs>
      <div className={BTNS}>
        {waiting.length > 1 && (
          <button type="button" className={CTA} disabled={busy} onClick={() => respond(waiting.map((j) => j.id), 'accept')} data-accept-all>
            <Check strokeWidth={2} aria-hidden="true" />Accept all {waiting.length}
          </button>
        )}
        <button type="button" className={`${GHOST} ml-auto`} onClick={load} disabled={busy}>
          <RefreshCw strokeWidth={1.7} aria-hidden="true" />Refresh
        </button>
      </div>
      {err && <p className={ERR} role="alert">{err}</p>}
      {msg && <p className={OKMSG} role="status">{msg}</p>}

      <h2 className={SECTION}>Today</h2>
      {data.todayJobs.length === 0 && <p className={NOTE}>No jobs today.</p>}
      {data.todayJobs.map((j) => <JobCard key={j.id} j={j} busy={busy} onRespond={respond} />)}

      <h2 className={SECTION}>Upcoming</h2>
      {data.upcoming.length === 0 && <p className={NOTE}>Nothing booked for you yet. New jobs arrive with a notification.</p>}
      {data.upcoming.map((j) => <JobCard key={j.id} j={j} busy={busy} onRespond={respond} />)}

      {data.past.length > 0 && (
        <details className="mt-[var(--space-2)]">
          <summary className={`${HEAD} cursor-pointer`}>Past jobs (last 60 days)</summary>
          <div className={`${STACK} mt-[var(--space-2)]`}>
            {data.past.map((j) => <JobCard key={j.id} j={j} past busy={busy} onRespond={respond} />)}
          </div>
        </details>
      )}
    </div>
  );
}
