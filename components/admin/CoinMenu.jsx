'use client';

import { useEffect, useState } from 'react';
import { Gift, Plus } from 'lucide-react';
import { FIELD_INPUT, FIELD_LABEL } from '@/components/ui/formClasses';
import { CARD, HEAD, H3, NOTE, ERR, GHOST, CTA, EMPTY } from '@/components/ui/panelClasses';
import Switch from '@/components/ui/Switch';
import { postJson, Unauthorized } from '@/lib/api';
import { COIN_VILLAS } from '@/lib/coinLabels';

// The villa perk menu: what a guest's coins can cover at each villa. A perk is
// switched off, never deleted - the API has no delete, so a "Covered by coin"
// note on an old stay always still points at a real row.

const ROW = 'flex flex-wrap items-center gap-[var(--space-1)] py-[0.45rem] [&+&]:[border-top:1px_solid_var(--line)]';
const LABEL_IN = `${FIELD_INPUT} !w-auto flex-1 min-w-[160px]`;
const COINS_IN = `${FIELD_INPUT} !w-[76px]`;
const ADD = 'flex flex-wrap items-end gap-[var(--space-1)] pt-[var(--space-1)]';

function validItem(label, coins) {
  const n = Number(coins);
  if (!String(label).trim()) return 'Give the perk a name.';
  if (String(label).trim().length > 120) return 'Keep the name under 120 characters.';
  if (!Number.isInteger(n) || n < 1 || n > 100) return 'Coins must be a whole number from 1 to 100.';
  return '';
}

function PerkRow({ item, onSave }) {
  const [label, setLabel] = useState(item.item_label);
  const [coins, setCoins] = useState(String(item.coin_cost));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => { setLabel(item.item_label); setCoins(String(item.coin_cost)); }, [item.item_label, item.coin_cost]);

  const changed = label !== item.item_label || coins !== String(item.coin_cost);

  async function send(active) {
    const problem = validItem(label, coins);
    if (problem) { setErr(problem); return; }
    setBusy(true); setErr('');
    setErr(await onSave({ id: item.id, property: item.property, label: label.trim(), coins: Number(coins), active, serviceId: item.service_id || undefined }));
    setBusy(false);
  }

  return (
    <div className={ROW} data-perk={item.id} data-perk-active={item.active ? 'on' : 'off'}>
      <input className={LABEL_IN} value={label} maxLength={120} aria-label="Perk name" onChange={(e) => setLabel(e.target.value)} />
      <input className={COINS_IN} type="number" inputMode="numeric" min={1} max={100} value={coins} aria-label="Coins" onChange={(e) => setCoins(e.target.value)} />
      <Switch id={`perk-on-${item.id}`} checked={Boolean(item.active)} disabled={busy} label={item.active ? 'Switch off' : 'Switch on'} onChange={(on) => send(on)} />
      <span className={NOTE}>{item.active ? 'On' : 'Off'}</span>
      {changed && <button type="button" className={GHOST} disabled={busy} onClick={() => send(Boolean(item.active))} data-perk-save>Save</button>}
      {err && <p className={`${ERR} basis-full`} role="alert">{err}</p>}
    </div>
  );
}

function AddPerk({ property, onSave }) {
  const [label, setLabel] = useState('');
  const [coins, setCoins] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const key = property.replace(/\s+/g, '-').toLowerCase();

  async function add() {
    const problem = validItem(label, coins);
    if (problem) { setErr(problem); return; }
    setBusy(true); setErr('');
    const failed = await onSave({ property, label: label.trim(), coins: Number(coins), active: true });
    if (!failed) { setLabel(''); setCoins(''); }
    setErr(failed);
    setBusy(false);
  }

  return (
    <div className={ADD} data-perk-add={key}>
      <span className="flex-1 min-w-[160px]">
        <label className={FIELD_LABEL} htmlFor={`perk-new-${key}`}>New perk</label>
        <input id={`perk-new-${key}`} className={FIELD_INPUT} value={label} maxLength={120} placeholder="What the coins cover" onChange={(e) => setLabel(e.target.value)} />
      </span>
      <span>
        <label className={FIELD_LABEL} htmlFor={`perk-coins-${key}`}>Coins</label>
        <input id={`perk-coins-${key}`} className={COINS_IN} type="number" inputMode="numeric" min={1} max={100} value={coins} onChange={(e) => setCoins(e.target.value)} />
      </span>
      <button type="button" className={CTA} disabled={busy} onClick={add} data-perk-add-btn><Plus strokeWidth={1.7} aria-hidden="true" />Add</button>
      {err && <p className={`${ERR} basis-full`} role="alert">{err}</p>}
    </div>
  );
}

export default function CoinMenu({ menu = [], onChanged, onExpired }) {
  // Returns '' when saved, otherwise the sentence to show under the row.
  async function save(body) {
    try {
      const { status, json } = await postJson('/api/coins/menu', body);
      if (status !== 200) return json.detail || `Server answered ${status}.`;
      onChanged();
      return '';
    } catch (e) {
      if (e instanceof Unauthorized) { onExpired(); return ''; }
      return e.message || 'Could not save.';
    }
  }

  const villas = [...new Set([...COIN_VILLAS, ...menu.map((item) => item.property)])];

  return (
    <section className={CARD} data-coin-menu>
      <h2 className={HEAD}><Gift strokeWidth={1.7} aria-hidden="true" />Villa perks</h2>
      <p className={NOTE}>What coins can cover at each villa. Switch a perk off to stop offering it; old stays keep their note.</p>
      {villas.map((property) => {
        const items = menu.filter((item) => item.property === property);
        return (
          <div key={property} className="flex flex-col" data-perk-villa={property}>
            <h3 className={H3}>{property}</h3>
            {items.length === 0 && <p className={EMPTY}>No perks at {property} yet. Add the first one below.</p>}
            {items.map((item) => <PerkRow key={item.id} item={item} onSave={save} />)}
            <AddPerk property={property} onSave={save} />
          </div>
        );
      })}
    </section>
  );
}
