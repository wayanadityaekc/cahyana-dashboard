'use client';

import { useEffect, useState } from 'react';
import { Coins } from 'lucide-react';
import { FIELD_INPUT } from '@/components/ui/formClasses';
import { CARD, HEAD, NOTE, ERR, OKMSG, BTNS, CTA } from '@/components/ui/panelClasses';
import { postJson, Unauthorized } from '@/lib/api';
import { COIN_CATEGORIES, EARN_LABEL, PCT_LABEL } from '@/lib/coinLabels';

// The two numbers per category: coins a paid booking earns, and how much one coin
// takes off a line. Both ranges are the API's (earn 0-50, % 1-100), checked here
// first so a typo is caught before the round trip, and again by the API.

const TABLE = 'w-full border-collapse font-body text-body text-green';
const TH = 'text-left font-body text-small font-medium text-muted pb-[var(--space-1)] pr-[var(--space-2)]';
const TD = 'py-[0.35rem] pr-[var(--space-2)] align-middle';
const NUM = `${FIELD_INPUT} !w-[88px]`;

const SHORT = { tour: 'Tour', experience: 'Experience', transfer: 'Transfer', charter: 'Charter', villa: 'Villa' };
const EARN_RANGE = [0, 50];
const PCT_RANGE = [1, 100];

function toText(obj = {}) {
  return COIN_CATEGORIES.reduce((acc, cat) => ({ ...acc, [cat]: obj[cat] != null ? String(obj[cat]) : '' }), {});
}

function whole(value, [min, max]) {
  const n = Number(value);
  return value !== '' && Number.isInteger(n) && n >= min && n <= max ? n : null;
}

// The package bonus per stay package (coin_package_bonus), from the API rules answer.
// Read-only here; an array or a { package: coins } map is accepted.
function packageRows(data) {
  const raw = data.packageBonus || data.package_bonus;
  if (!raw) return null;
  if (Array.isArray(raw)) return raw.map((row) => ({ id: row.package_id || row.packageId || row.id, coins: row.bonus_coins ?? row.coins }));
  return Object.keys(raw).map((id) => ({ id, coins: raw[id] }));
}

export default function CoinRules({ data, onSaved, onExpired }) {
  const [earn, setEarn] = useState(() => toText(data.earn));
  const [pct, setPct] = useState(() => toText(data.pct));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState('');

  useEffect(() => { setEarn(toText(data.earn)); setPct(toText(data.pct)); }, [data.earn, data.pct]);

  async function save() {
    setErr(''); setDone('');
    const badEarn = COIN_CATEGORIES.find((cat) => whole(earn[cat], EARN_RANGE) == null);
    const badPct = COIN_CATEGORIES.find((cat) => whole(pct[cat], PCT_RANGE) == null);
    if (badEarn) { setErr(`${EARN_LABEL[badEarn]}: coins earned must be a whole number from 0 to 50.`); return; }
    if (badPct) { setErr(`${PCT_LABEL[badPct]}: % off per coin must be a whole number from 1 to 100.`); return; }
    setBusy(true);
    try {
      const body = {
        earn: COIN_CATEGORIES.reduce((acc, cat) => ({ ...acc, [cat]: Number(earn[cat]) }), {}),
        pct: COIN_CATEGORIES.reduce((acc, cat) => ({ ...acc, [cat]: Number(pct[cat]) }), {}),
      };
      const { status, json } = await postJson('/api/coins/rules', body);
      if (status !== 200) setErr(json.detail || `Server answered ${status}.`);
      else { setDone('Saved. New bookings use these numbers from now on.'); onSaved({ earn: json.earn, pct: json.pct }); }
    } catch (e) {
      if (e instanceof Unauthorized) onExpired();
      else setErr(e.message || 'Could not save.');
    }
    setBusy(false);
  }

  const bonus = packageRows(data);

  return (
    <section className={CARD} data-coin-rules>
      <h2 className={HEAD}><Coins strokeWidth={1.7} aria-hidden="true" />Coin rules</h2>
      <p className={NOTE}>Coins are earned when a booking is paid and last 3 years: per booking line for tours, experiences, transfers and charters, per night for a villa. One coin takes the % below off one line of that category.</p>
      <table className={TABLE}>
        <thead>
          <tr><th className={TH}>Category</th><th className={TH}>Coins earned</th><th className={TH}>% off per coin</th></tr>
        </thead>
        <tbody>
          {COIN_CATEGORIES.map((cat) => (
            <tr key={cat}>
              <td className={TD}>{SHORT[cat]}</td>
              <td className={TD}>
                <input className={NUM} type="number" inputMode="numeric" min={EARN_RANGE[0]} max={EARN_RANGE[1]}
                  aria-label={`Coins earned, ${EARN_LABEL[cat]}`} value={earn[cat]} data-earn={cat}
                  onChange={(e) => setEarn((prev) => ({ ...prev, [cat]: e.target.value }))} />
              </td>
              <td className={TD}>
                <input className={NUM} type="number" inputMode="numeric" min={PCT_RANGE[0]} max={PCT_RANGE[1]}
                  aria-label={`Percent off per coin, ${PCT_LABEL[cat]}`} value={pct[cat]} data-pct={cat}
                  onChange={(e) => setPct((prev) => ({ ...prev, [cat]: e.target.value }))} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className={NOTE}>Coins cannot be used on a program while a sale runs. A villa stay takes coins only from a returning villa guest.</p>
      <div data-package-bonus>
        {bonus && bonus.length > 0
          ? <p className={NOTE}>Package bonus: {bonus.map((row) => `${row.id} +${row.coins}`).join(', ')}.</p>
          : <p className={NOTE}>Package bonus coins: not set up on the server yet.</p>}
      </div>
      {err && <p className={ERR} role="alert" data-rules-err>{err}</p>}
      {done && <p className={OKMSG} data-rules-ok>{done}</p>}
      <div className={BTNS}>
        <button type="button" className={CTA} onClick={save} disabled={busy} data-rules-save>{busy ? 'Saving' : 'Save rules'}</button>
      </div>
    </section>
  );
}
