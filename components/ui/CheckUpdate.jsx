'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { GHOST, NOTE } from '@/components/ui/panelClasses';

// Manual "Check for updates" (settings, owner and driver). Asks the server which
// build it is serving; if it differs from the one running, drops the worker's
// caches and reloads. Same id = already current, and says so.
const RUNNING = process.env.NEXT_PUBLIC_BUILD_ID || '';

export default function CheckUpdate() {
  const [state, setState] = useState('idle'); // idle | checking | current | updating | error

  const check = async () => {
    setState('checking');
    try {
      const res = await fetch('/api/build', { cache: 'no-store' });
      const { id } = await res.json();
      if (!res.ok || !id) throw new Error('bad');
      if (RUNNING && id === RUNNING) { setState('current'); return; }
      setState('updating');
      try {
        const regs = await navigator.serviceWorker?.getRegistrations();
        await Promise.all((regs || []).map((r) => r.update().catch(() => {})));
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      } catch { /* reload anyway */ }
      window.location.reload();
    } catch { setState('error'); }
  };

  const text = {
    idle: '',
    checking: 'Checking...',
    updating: 'Updating...',
    current: 'You have the latest version.',
    error: 'Could not check. Check your connection and try again.',
  }[state];

  return (
    <>
      <div>
        <button type="button" className={GHOST} onClick={check} disabled={state === 'checking' || state === 'updating'} data-check-update>
          <RefreshCw strokeWidth={1.7} aria-hidden="true" />Check for updates
        </button>
      </div>
      {text && <p className={NOTE} role="status" data-update-status>{text}</p>}
    </>
  );
}
