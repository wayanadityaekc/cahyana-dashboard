'use client';

import { useCallback, useEffect, useState } from 'react';
import { Percent, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { FIELD_INPUT, FIELD_LABEL } from '@/components/ui/formClasses';
import { BTN_SM } from '@/components/ui/btnClasses';
import { getJson, postJson, Unauthorized } from '@/lib/api';

// The low-season sale: one percentage, one end date, programs only.
//
// It is a PRICE change, not a payment option, and that is why there is no
// "stacks with referral" switch here to get wrong: a sale cannot be set below
// the referral discount, so it is always the bigger of the two and the code
// simply steps aside while it runs. The API refuses a smaller number; this panel
// says so before the owner types one.
//
// It is also why transfers and charters are not listed: those are priced off a
// car and a driver, so a cut there is nearly all margin.

const WRAP = 'flex flex-col gap-[var(--space-3)] max-w-[520px]';
const CARD =
  'flex flex-col gap-[var(--space-2)] p-[var(--space-3)] rounded-[var(--r-md)] ' +
  'bg-white [border:1px_solid_var(--line)]';
const BANNER =
  'flex items-start gap-[0.5rem] p-[0.7rem_0.9rem] rounded-[var(--r-md)] font-body text-small ' +
  '[&>svg]:w-[var(--icon-sm)] [&>svg]:h-[var(--icon-sm)] [&>svg]:shrink-0 [&>svg]:mt-[0.15rem]';
const LIVE = `${BANNER} bg-cream [border:1px_solid_var(--line)] text-green`;
const OFF = `${BANNER} bg-white [border:1px_solid_var(--line)] text-muted`;
const ROW = 'flex items-end gap-[var(--space-2)] flex-wrap';
const NOTE = 'font-body text-small text-muted m-0';
const ERR = 'font-body text-small text-err m-0';
const PRIMARY = `inline-flex ${BTN_SM} bg-cta text-white border-0 cursor-pointer hover:bg-cta-d`;
const GHOST =
  `inline-flex ${BTN_SM} bg-white text-gold [border:1px_solid_var(--line)] cursor-pointer hover:bg-cream`;

const LABELS = { tour: 'Tours', combo: 'Tour packages', place: 'Destinations',
  experience: 'Experiences', performance: 'Performances' };

export default function PromoPanel({ onExpired }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [label, setLabel] = useState('');

  const load = useCallback(async () => {
    try {
      const j = await getJson('/api/promo');
      setData(j);
      // Seed the form from what is stored, so "change 10 to 15" is one edit
      // rather than retyping the whole thing.
      if (j.stored) {
        setPct(String(j.stored.pct));
        setEndsOn(j.stored.endsOn || '');
        setLabel(j.stored.label || '');
      }
    } catch (e) {
      if (e instanceof Unauthorized) return onExpired();
      setErr(e.message || 'Could not load the sale.');
    }
    return undefined;
  }, [onExpired]);

  useEffect(() => { load(); }, [load]);

  const send = async (body) => {
    setBusy(true);
    setErr('');
    try {
      // postJson returns the ENVELOPE - { status, json } - not the body. Reading
      // it as the body left `data.live` undefined, so a successful save looked
      // exactly like nothing happening: no sale reported, no error shown, no
      // Stop button. getJson above does return the body, which is what makes
      // this easy to get wrong.
      const { status, json } = await postJson('/api/promo', body);
      if (status !== 200) {
        setErr(json.detail || `Server answered ${status}.`);
        return;
      }
      setData(json);
      if (body.stop) { setPct(''); setEndsOn(''); setLabel(''); }
    } catch (e) {
      if (e instanceof Unauthorized) return onExpired();
      setErr(e.message || 'Could not save.');
    } finally {
      setBusy(false);
    }
    return undefined;
  };

  if (!data) return <p className={NOTE}>Loading...</p>;

  const live = data.live;
  const stored = data.stored;
  // Stored but not live means the end date has passed. Saying that is the
  // difference between "the save failed" and "it ran its course".
  const expired = !live && stored;

  return (
    <div className={WRAP}>
      {live ? (
        <p className={LIVE}>
          <CheckCircle2 aria-hidden="true" />
          <span>
            <strong>{live.pct}% off</strong> every program right now
            {live.endsOn ? `, until ${live.endsOn}` : ', with no end date set'}
            {live.label ? ` (${live.label})` : ''}. {data.note}
          </span>
        </p>
      ) : (
        <p className={OFF}>
          <Percent aria-hidden="true" />
          <span>
            {expired
              ? `No sale running - the last one (${stored.pct}%) ended on ${stored.endsOn}. Today in Bali is ${data.today}.`
              : 'No sale running. Guests are paying the normal price.'}
          </span>
        </p>
      )}

      <div className={CARD}>
        <div className={ROW}>
          <span>
            <label className={FIELD_LABEL} htmlFor="promo-pct">Percent off</label>
            <input
              id="promo-pct"
              className={`${FIELD_INPUT} !w-[110px]`}
              type="number"
              inputMode="numeric"
              min={data.minPct}
              max={data.maxPct}
              value={pct}
              onChange={(e) => setPct(e.target.value)}
            />
          </span>
          <span>
            <label className={FIELD_LABEL} htmlFor="promo-ends">Last day</label>
            <input
              id="promo-ends"
              className={`${FIELD_INPUT} !w-[170px]`}
              type="date"
              value={endsOn}
              onChange={(e) => setEndsOn(e.target.value)}
            />
          </span>
        </div>

        <span>
          <label className={FIELD_LABEL} htmlFor="promo-label">Name it (for you, not the guest)</label>
          <input
            id="promo-label"
            className={FIELD_INPUT}
            type="text"
            maxLength={80}
            placeholder="Low season"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </span>

        <p className={NOTE}>
          Applies to {Object.keys(LABELS).filter((k) => (data.categories || []).includes(k)).map((k) => LABELS[k]).join(', ').toLowerCase()}.
          Transfers, charters and the pick-up fee are not discounted. Minimum {data.minPct}% - below that
          a guest holding a referral code would be worse off than before.
        </p>

        {err && <p className={ERR}><AlertTriangle aria-hidden="true" style={{ display: 'inline', width: 14, height: 14, marginRight: 4 }} />{err}</p>}

        <div className={ROW}>
          <button type="button" className={PRIMARY} disabled={busy} data-save
            onClick={() => send({ pct: Number(pct), endsOn, label })}>
            {live ? 'Update sale' : 'Start sale'}
          </button>
          {live && (
            <button type="button" className={GHOST} disabled={busy} data-stop
              onClick={() => send({ stop: true })}>
              Stop it now
            </button>
          )}
        </div>
      </div>

      <p className={NOTE}>
        Prices on the site update within about half a minute. The struck-through
        original is shown next to the new price wherever a price is rendered from
        the catalog - cards, the book bar and the booking card.
      </p>
    </div>
  );
}
