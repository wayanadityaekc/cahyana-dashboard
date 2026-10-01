'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Eye, EyeOff, Star } from 'lucide-react';
import { BTN_SM } from '@/components/ui/btnClasses';
import { getJson, postJson, Unauthorized } from '@/lib/api';

// Moderating the reviews guests write.
//
// They publish STRAIGHT to the site - the booking gate already ran server-side
// before the row was inserted (signed in, the booking is theirs, the date has
// passed, it was actually paid). So this screen is not "approve before it
// shows". It is "pull it back down" when the CONTENT turns out to be a problem:
// abuse, spam, or somebody's phone number typed into a public box.
//
// NOTHING IS DELETED. Hiding sets a status, so the row and its words survive and
// a mistake is undoable. That matters more than it sounds: the alternative is
// destroying a real guest's words on one tap, with nothing to restore.
//
// A hidden review also leaves the STAR AVERAGE, not just the list - a card that
// kept counting a review nobody can read would be quietly lying.

const WRAP = 'flex flex-col gap-[var(--space-3)]';
const TABS = 'flex gap-[0.4rem] flex-wrap mb-[var(--space-2)]';
const TAB = `inline-flex ${BTN_SM} bg-white text-gold [border:1px_solid_var(--line)] cursor-pointer hover:bg-cream`;
const TAB_ON = `inline-flex ${BTN_SM} bg-cream text-gold [border:1px_solid_var(--line)] cursor-pointer font-semibold`;
const CARD =
  'flex flex-col gap-[0.5rem] p-[var(--space-3)] rounded-[var(--r-md)] bg-white [border:1px_solid_var(--line)]';
const CARD_OFF = `${CARD} bg-cream`;
const TOP = 'flex items-start justify-between gap-[var(--space-2)] flex-wrap';
const WHO = 'font-body text-strong font-semibold text-gold m-0';
const META = 'font-body text-small text-muted m-0';
const BODY = 'font-body text-body text-green m-0 [line-height:var(--lh-body)] whitespace-pre-wrap';
const STARS = 'inline-flex items-center gap-[2px] [&>svg]:w-[14px] [&>svg]:h-[14px]';
const BADGE =
  'inline-flex items-center px-[0.5rem] h-[1.4rem] rounded-[var(--r-sm)] font-body text-label ' +
  'font-medium tracking-[0.1em] uppercase';
const BADGE_OFF = `${BADGE} bg-white text-muted [border:1px_solid_var(--line)]`;
const BADGE_WAIT = `${BADGE} bg-white text-err [border:1px_solid_var(--color-err)]`;
const BANNER =
  'flex items-start gap-[0.5rem] p-[0.7rem_0.9rem] rounded-[var(--r-md)] font-body text-small ' +
  '[&>svg]:w-[var(--icon-sm)] [&>svg]:h-[var(--icon-sm)] [&>svg]:shrink-0 [&>svg]:mt-[0.15rem]';
const INFO = `${BANNER} bg-cream [border:1px_solid_var(--line)] text-green`;
const WARN = `${BANNER} bg-white [border:1px_solid_var(--color-err)] text-err`;
const NOTE = 'font-body text-small text-muted m-0';
const GHOST = `inline-flex ${BTN_SM} bg-white text-gold [border:1px_solid_var(--line)] cursor-pointer hover:bg-cream disabled:opacity-50`;

const VIEWS = [
  { id: '', label: 'All' },
  { id: 'approved', label: 'On the site' },
  { id: 'hidden', label: 'Hidden' },
];

function Stars({ n }) {
  return (
    <span className={STARS} aria-label={`${n} out of 5`} data-stars={n}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          // Filled up to the rating, outline after it. fill is explicit because
          // Lucide draws outlines by default and a half-drawn row reads as broken.
          className={i <= n ? 'text-amber' : 'text-muted'}
          fill={i <= n ? 'currentColor' : 'none'}
          strokeWidth={1.6}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

const fmtDate = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function ReviewsPanel({ onExpired }) {
  const [view, setView] = useState('');
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(0);
  const [saved, setSaved] = useState('');

  const load = useCallback(async () => {
    try {
      // Tour reviews only: villa reviews belong to the Villas dashboard (brief #8).
      const j = await getJson(`/api/reviews?scope=cue${view ? `&status=${view}` : ''}`);
      setData(j);
    } catch (e) {
      if (e instanceof Unauthorized) return onExpired();
      setErr(e.message || 'Could not load the reviews.');
    }
    return undefined;
  }, [view, onExpired]);

  useEffect(() => { setData(null); setErr(''); load(); }, [load]);

  const rows = useMemo(() => (data && data.reviews) || [], [data]);
  const counts = (data && data.counts) || {};

  const act = async (id, action) => {
    setBusy(id);
    setErr('');
    setSaved('');
    try {
      const { status, json } = await postJson('/api/reviews', { action, id });
      if (status !== 200) { setErr(json.detail || `Server answered ${status}.`); return; }
      if (json.demo) {
        // Nothing was saved; the banner says so. Reflected locally anyway so the
        // flow can be seen - the same choice ContentPanel makes for typing.
        setData((d) => ({
          ...d,
          reviews: (d.reviews || []).map((r) =>
            r.id === id ? { ...r, status: action === 'hide' ? 'hidden' : 'approved' } : r),
        }));
        setSaved('Demo: nothing was actually changed.');
        return;
      }
      setSaved(action === 'hide'
        ? 'Hidden. It is off the site and out of the star average - you can put it back.'
        : 'Back on the site.');
      load();
    } catch (e) {
      if (e instanceof Unauthorized) { onExpired(); return; }
      setErr(e.message || 'Could not save.');
    } finally {
      setBusy(0);
    }
  };

  if (!data) return <p className={NOTE}>{err || 'Loading...'}</p>;

  return (
    <div className={WRAP}>
      {data.demo && (
        <p className={INFO}>
          <AlertTriangle aria-hidden="true" />
          <span>Demo: these are sample reviews, and hiding one changes nothing.</span>
        </p>
      )}

      <div className={TABS} data-views>
        {VIEWS.map((v) => (
          <button
            key={v.id || 'all'}
            type="button"
            className={v.id === view ? TAB_ON : TAB}
            data-view={v.id || 'all'}
            onClick={() => setView(v.id)}
          >
            {v.label}
            {v.id && counts[v.id] != null ? ` (${counts[v.id]})` : ''}
          </button>
        ))}
      </div>

      {counts.pending ? (
        <p className={INFO}>
          <AlertTriangle aria-hidden="true" />
          <span>
            {counts.pending} old review{counts.pending > 1 ? 's' : ''} never went live - they were
            written before reviews published automatically.
          </span>
        </p>
      ) : null}

      {err && <p className={WARN}><AlertTriangle aria-hidden="true" /><span>{err}</span></p>}
      {saved && <p className={INFO}><CheckCircle2 aria-hidden="true" /><span>{saved}</span></p>}

      {rows.length === 0 ? (
        <p className={NOTE}>
          {view === 'hidden' ? 'Nothing hidden.' : 'No reviews yet.'}
        </p>
      ) : (
        rows.map((r) => {
          const off = r.status !== 'approved';
          return (
            <div key={r.id} className={off ? CARD_OFF : CARD} data-review={r.id} data-status={r.status}>
              <div className={TOP}>
                <div>
                  <p className={WHO}>
                    {r.name}
                    {r.country ? <span className={META}> · {r.country}</span> : null}
                  </p>
                  <p className={META}>
                    {r.service || 'No tour named'} · {fmtDate(r.created_at)}
                    {r.booking_ref ? ` · ${r.booking_ref}` : ''}
                  </p>
                </div>
                <Stars n={Number(r.rating) || 0} />
              </div>

              <p className={BODY}>{r.message}</p>

              <div className={TOP}>
                {r.status === 'hidden' && <span className={BADGE_OFF} data-badge>Hidden</span>}
                {r.status === 'pending' && <span className={BADGE_WAIT} data-badge>Never published</span>}
                {r.status === 'approved' && <span className={NOTE}>On the site</span>}

                <button
                  type="button"
                  className={GHOST}
                  disabled={busy === r.id}
                  data-act={r.status === 'approved' ? `hide-${r.id}` : `show-${r.id}`}
                  onClick={() => act(r.id, r.status === 'approved' ? 'hide' : 'unhide')}
                >
                  {r.status === 'approved'
                    ? <><EyeOff aria-hidden="true" style={{ width: 14, height: 14, marginRight: 5 }} />Hide from site</>
                    : <><Eye aria-hidden="true" style={{ width: 14, height: 14, marginRight: 5 }} />Put back on site</>}
                </button>
              </div>
            </div>
          );
        })
      )}

      <p className={NOTE}>
        Hiding never deletes anything - the review is kept, just off the site, so you can put it
        back. Guests write these themselves after a trip they paid for.
      </p>
    </div>
  );
}
