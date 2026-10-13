'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { STACK, ERR, EMPTY, GHOST } from '@/components/ui/panelClasses';
import CoinRules from '@/components/admin/CoinRules';
import CoinMenu from '@/components/admin/CoinMenu';
import CoinGuest from '@/components/admin/CoinGuest';
import { getJson, Unauthorized } from '@/lib/api';

// Owner > Coins: the rules, the villa perk menu, and one guest at a time. Rules
// and menu come from one answer (/api/coins/rules); the guest lookup stands on
// its own so it still works when that answer fails.
export default function CoinsPanel({ onExpired }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setErr('');
    try {
      setData(await getJson('/api/coins/rules'));
    } catch (e) {
      if (e instanceof Unauthorized) onExpired();
      else setErr(e.message || 'Could not load the coin rules.');
    }
  }, [onExpired]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className={`${STACK} max-w-[720px]`} data-coins-panel>
      {err && (
        <div className="flex flex-wrap items-center gap-[var(--space-1)]">
          <p className={ERR} role="alert" data-coins-err>Sorry, we could not load the coin rules. {err}</p>
          <button type="button" className={GHOST} onClick={load}><RefreshCw strokeWidth={1.7} aria-hidden="true" />Try again</button>
        </div>
      )}
      {!data && !err && <p className={EMPTY} data-coins-loading>Loading coin rules...</p>}
      {data && <CoinRules data={data} onSaved={(rules) => setData((prev) => ({ ...prev, ...rules }))} onExpired={onExpired} />}
      {data && <CoinMenu menu={data.menu || []} onChanged={load} onExpired={onExpired} />}
      <CoinGuest onExpired={onExpired} />
    </div>
  );
}
